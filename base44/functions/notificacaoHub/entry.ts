import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import webpush from 'npm:web-push@3.6.7';

/**
 * notificacaoHub — Hub Central de Notificações do Nexus360
 *
 * Endpoint chamado pelos apps satélites (Neural Fin Flow, Gestão de Compras,
 * RH Nexus, Neural Site) para disparar avisos aos usuários usando a
 * infraestrutura de push/WhatsApp já cadastrada AQUI no Nexus360.
 *
 * Autenticação: token compartilhado NEXUS_HUB_TOKEN
 *   - Header 'x-hub-token: <token>'  OU  query '?token=<token>'
 *
 * Payload:
 *   user_email:  string (obrigatório) — e-mail do usuário (mesmo em todos os apps)
 *   titulo:      string (obrigatório)
 *   mensagem:    string (obrigatório)
 *   url_destino: string (opcional) — URL completa do app satélite a abrir no clique
 *   app_origem:  string (opcional) — ex: 'neural_fin', 'compras', 'rh_nexus'
 *
 * Fluxo:
 *   1. Resolve o usuário pelo e-mail
 *   2. Lê notificacoes_config do usuário
 *   3. receber_push (default true) → Web Push nos devices ativos
 *   4. receber_whatsapp ligado OU nenhum device ativo → WhatsApp no telefone_particular
 *   5. Tudo auditado no WakeUpLog
 */

async function registrarLog(base44, data) {
  try {
    await base44.asServiceRole.entities.WakeUpLog.create({ provider: 'web_push', ...data });
  } catch (e) {
    console.error('[notificacaoHub] falha ao registrar WakeUpLog:', e.message);
  }
}

async function enviarPushDireto(base44, { target_user_id, title, body, action_url }) {
  const devices = await base44.asServiceRole.entities.UserDevice.filter({
    user_id: target_user_id,
    is_active: true,
    push_provider: 'web_push'
  });
  const elegiveis = devices.filter((d) => d.can_wake_message !== false);

  if (elegiveis.length === 0) {
    await registrarLog(base44, { tipo: 'message', target_user_id, status: 'skipped', reason: 'no_active_device', title, body, action_url });
    return { sent: 0, failed: 0, reason: 'no_active_device' };
  }

  const pushPayload = JSON.stringify({ title, body, tipo: 'message', action_url, icon: null, tag: 'nexus-hub' });
  let sent = 0;
  let failed = 0;

  for (const dev of elegiveis) {
    if (!dev.push_endpoint) continue;
    const subscription = { endpoint: dev.push_endpoint, keys: { p256dh: dev.push_keys_p256dh, auth: dev.push_keys_auth } };
    const inicio = Date.now();
    try {
      await webpush.sendNotification(subscription, pushPayload);
      sent++;
      await base44.asServiceRole.entities.UserDevice.update(dev.id, { last_success_at: new Date().toISOString(), failure_count: 0, last_failure_reason: null });
      await registrarLog(base44, { tipo: 'message', target_user_id, device_id: dev.device_id, platform: dev.platform, status: 'sent', reason: 'ok', title, body, action_url, duration_ms: Date.now() - inicio });
    } catch (err) {
      failed++;
      const code = err.statusCode || err.status || 0;
      const morto = code === 410 || code === 404;
      await base44.asServiceRole.entities.UserDevice.update(dev.id, {
        is_active: morto ? false : dev.is_active,
        revoked_at: morto ? new Date().toISOString() : dev.revoked_at,
        last_failure_at: new Date().toISOString(),
        failure_count: (dev.failure_count || 0) + 1,
        last_failure_reason: morto ? `endpoint_gone_${code}` : `provider_error_${code}`
      });
      await registrarLog(base44, { tipo: 'message', target_user_id, device_id: dev.device_id, platform: dev.platform, status: 'failed', reason: morto ? `endpoint_gone_${code}` : 'provider_error', title, body, action_url, provider_status_code: code, error_message: String(err.message || err), duration_ms: Date.now() - inicio });
    }
  }
  return { sent, failed };
}

// Envia texto simples via primeira integração WhatsApp conectada (Z-API ou W-API)
async function enviarWhatsAppTexto(base44, telefone, texto) {
  const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
  if (!integracoes || integracoes.length === 0) {
    return { success: false, error: 'nenhuma_integracao_conectada' };
  }
  const int = integracoes[0];
  const isWAPI = int.api_provider === 'w_api';

  let digits = String(telefone).replace(/\D/g, '');
  if (!digits.startsWith('55')) digits = '55' + digits;

  let endpoint, headers;
  if (isWAPI) {
    endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${int.instance_id_provider}`;
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${int.api_key_provider}` };
  } else {
    endpoint = `${int.base_url_provider || 'https://api.z-api.io'}/instances/${int.instance_id_provider}/token/${int.api_key_provider}/send-text`;
    headers = { 'Content-Type': 'application/json', 'Client-Token': int.security_client_token_header };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: digits, message: texto })
  });
  const result = await res.json().catch(() => ({}));
  const ok = res.ok && !result.error;
  return { success: ok, provider: isWAPI ? 'w_api' : 'z_api', integracao: int.nome_instancia, error: ok ? null : (result.error || `http_${res.status}`) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Autenticação por token compartilhado ─────────────────────────
    const HUB_TOKEN = Deno.env.get('NEXUS_HUB_TOKEN');
    if (!HUB_TOKEN) {
      return Response.json({ success: false, error: 'NEXUS_HUB_TOKEN não configurado' }, { status: 500 });
    }
    const url = new URL(req.url);
    const tokenRecebido = req.headers.get('x-hub-token') || url.searchParams.get('token');
    if (tokenRecebido !== HUB_TOKEN) {
      return Response.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { user_email, titulo, mensagem, url_destino = '/', app_origem = 'externo' } = payload;

    if (!user_email || !titulo || !mensagem) {
      return Response.json({ success: false, error: 'user_email, titulo e mensagem são obrigatórios' }, { status: 400 });
    }

    // ── Resolver usuário pelo e-mail ──────────────────────────────────
    const emailNorm = String(user_email).trim().toLowerCase();
    let usuarios = await base44.asServiceRole.entities.User.filter({ email: emailNorm });
    if (!usuarios || usuarios.length === 0) {
      const todos = await base44.asServiceRole.entities.User.list();
      usuarios = (todos || []).filter((u) => (u.email || '').toLowerCase() === emailNorm);
    }
    if (usuarios.length === 0) {
      return Response.json({ success: false, error: `Usuário não encontrado: ${emailNorm}` }, { status: 404 });
    }
    const usuario = usuarios[0];
    const config = usuario.notificacoes_config || {};

    // ── VAPID ─────────────────────────────────────────────────────────
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@nexus360.com';

    const resultado = { app_origem, usuario: usuario.email, push: null, whatsapp: null };

    // ── 1) PUSH (default ligado) ──────────────────────────────────────
    if (config.receber_push !== false && VAPID_PUBLIC && VAPID_PRIVATE) {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
      resultado.push = await enviarPushDireto(base44, {
        target_user_id: usuario.id,
        title: titulo,
        body: mensagem,
        action_url: url_destino
      });
    } else {
      resultado.push = { sent: 0, reason: 'push_desligado' };
    }

    // ── 2) WHATSAPP (opção ligada OU fallback sem device) ────────────
    const semDevice = (resultado.push?.sent || 0) === 0;
    const deveWhatsApp = config.receber_whatsapp === true || (semDevice && usuario.telefone_particular);
    if (deveWhatsApp && usuario.telefone_particular) {
      const texto = `🔔 *${titulo}*\n\n${mensagem}${url_destino && url_destino !== '/' ? `\n\n👉 ${url_destino}` : ''}`;
      resultado.whatsapp = await enviarWhatsAppTexto(base44, usuario.telefone_particular, texto);
      await registrarLog(base44, {
        tipo: 'message',
        target_user_id: usuario.id,
        status: resultado.whatsapp.success ? 'sent' : 'failed',
        reason: `hub_whatsapp_${app_origem}`,
        title: titulo,
        body: mensagem,
        action_url: url_destino,
        error_message: resultado.whatsapp.error || null
      });
    } else if (deveWhatsApp) {
      resultado.whatsapp = { success: false, error: 'sem_telefone_particular' };
    }

    return Response.json({ success: true, ...resultado });
  } catch (error) {
    console.error('[notificacaoHub] ❌ Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});