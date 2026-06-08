import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import webpush from 'npm:web-push@3.6.7';

/**
 * notificarWakeUpMensagem — gatilho de automação (entity MessageThread / update+create)
 *
 * Quando uma thread externa recebe uma mensagem NOVA de contato, dispara
 * uma notificação Web Push (Wake-Up) para todos os atendentes que podem
 * ver a conversa — replicando EXATAMENTE o critério e o formato do alerta
 * interno (NovasMensagensAlert) que aparece dentro do app.
 *
 * Funciona mesmo com o app FECHADO (via Service Worker + Web Push).
 *
 * IMPORTANTE: o push é enviado INLINE (web-push direto), NÃO via
 * functions.invoke('enviarWakeUpPush'). A invocação função→função a partir
 * de uma automação (sem token de usuário) é barrada pelo Base44 com 403.
 */

// Envia Web Push diretamente para todos os devices ativos de um usuário.
// Registra cada tentativa no WakeUpLog (mesma auditoria do enviarWakeUpPush).
async function enviarPushDireto(base44, { target_user_id, sender_user_id = null, tipo = 'message', title, body, action_url, icon = null, thread_id = null }) {
  if (sender_user_id && sender_user_id === target_user_id) {
    return { sent: 0, reason: 'sender_excluded' };
  }

  const devices = await base44.asServiceRole.entities.UserDevice.filter({
    user_id: target_user_id,
    is_active: true,
    push_provider: 'web_push'
  });
  const elegiveis = devices.filter((d) => (tipo === 'call' ? d.can_wake_call !== false : d.can_wake_message !== false));

  if (elegiveis.length === 0) {
    await registrarLog(base44, { tipo, target_user_id, status: 'skipped', reason: 'no_active_device', title, body, action_url, sender_user_id, thread_id });
    return { sent: 0, reason: 'no_active_device' };
  }

  const pushPayload = JSON.stringify({ title, body, tipo, action_url, icon, tag: thread_id ? `thread-${thread_id}` : `nexus-${tipo}` });
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
      await registrarLog(base44, { tipo, target_user_id, device_id: dev.device_id, platform: dev.platform, status: 'sent', reason: 'ok', title, body, action_url, sender_user_id, thread_id, duration_ms: Date.now() - inicio });
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
      await registrarLog(base44, { tipo, target_user_id, device_id: dev.device_id, platform: dev.platform, status: 'failed', reason: morto ? `endpoint_gone_${code}` : 'provider_error', title, body, action_url, sender_user_id, thread_id, provider_status_code: code, error_message: String(err.message || err), duration_ms: Date.now() - inicio });
    }
  }
  return { sent, failed };
}

async function registrarLog(base44, data) {
  try {
    await base44.asServiceRole.entities.WakeUpLog.create({ provider: 'web_push', ...data });
  } catch (e) {
    console.error('[notificarWakeUpMensagem] falha ao registrar WakeUpLog:', e.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@nexus360.com';
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return Response.json({ success: false, error: 'VAPID não configurado' }, { status: 500 });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const evt = payload?.event || {};
    let thread = payload?.data || null;
    let oldData = payload?.old_data || null;

    // Se o payload veio truncado, busca a thread atual
    if (payload?.payload_too_large && evt?.entity_id) {
      thread = await base44.asServiceRole.entities.MessageThread.get(evt.entity_id);
    }
    if (!thread) {
      return Response.json({ success: true, skipped: 'sem_thread' });
    }

    const isInterna = thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group';

    // Vibração REFORÇADA ("dobro") usada nas internas e também nas externas.
    const VIBRATE_DOBRO = [500, 200, 500, 200, 500];

    // ── Guards comuns ─────────────────────────────────────────────────
    if (!thread.last_message_at) {
      return Response.json({ success: true, skipped: 'sem_timestamp' });
    }
    if (evt?.type === 'update' && oldData && oldData.last_message_at === thread.last_message_at) {
      return Response.json({ success: true, skipped: 'mensagem_nao_mudou' });
    }

    // ══════════════════════════════════════════════════════════════════
    // CAMINHO INTERNO (usuário → usuário / grupo de setor)
    // Notifica os participants EXCETO o remetente, com vibração dobrada.
    // ══════════════════════════════════════════════════════════════════
    if (isInterna) {
      // Em internas, a última mensagem foi enviada por um USER (não contato)
      if (thread.last_message_sender === 'contact') {
        return Response.json({ success: true, skipped: 'interna_sem_remetente_user' });
      }

      // A thread não guarda o ID do remetente da última msg → busca a última Message
      let remetenteId = null;
      try {
        const ultimas = await base44.asServiceRole.entities.Message.filter(
          { thread_id: thread.id }, '-created_date', 1
        );
        if (ultimas?.length > 0 && ultimas[0].sender_type === 'user') {
          remetenteId = ultimas[0].sender_id || null;
        }
      } catch { /* sem remetente identificado, notifica todos */ }

      const participantes = (thread.participants || []).filter((id) => id && id !== remetenteId);
      if (participantes.length === 0) {
        return Response.json({ success: true, skipped: 'interna_sem_destinatarios' });
      }

      const remetenteNome = thread.last_message_sender_name || 'Mensagem interna';
      const tituloInterno = thread.is_group_chat
        ? `${thread.group_name || 'Grupo'} • ${remetenteNome}`
        : remetenteNome;

      let previewInt = thread.last_message_content || '';
      const mtInt = thread.last_media_type;
      if (mtInt === 'audio') previewInt = '🎤 Mensagem de voz';
      else if (mtInt === 'image') previewInt = '📷 Imagem';
      else if (mtInt === 'video') previewInt = '🎥 Vídeo';
      else if (mtInt === 'document') previewInt = '📄 Documento';
      else if (previewInt.length > 60) previewInt = previewInt.substring(0, 60) + '…';
      if (!previewInt) previewInt = 'Nova mensagem interna';

      const resultadosInt = [];
      for (const userId of participantes) {
        try {
          const res = await enviarPushDireto(base44, {
            target_user_id: userId,
            sender_user_id: remetenteId,
            tipo: 'message',
            title: tituloInterno,
            body: previewInt,
            action_url: `/Comunicacao?thread_id=${thread.id}`,
            thread_id: thread.id,
          });
          resultadosInt.push({ userId, ok: true, res });
        } catch (e) {
          resultadosInt.push({ userId, ok: false, error: e.message });
        }
      }

      return Response.json({
        success: true,
        canal: 'interno',
        remetente: remetenteNome,
        preview: previewInt,
        destinatarios: participantes.length,
        resultados: resultadosInt,
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // CAMINHO EXTERNO (contato → atendentes) — comportamento original
    // ══════════════════════════════════════════════════════════════════
    // Só mensagens de CONTATO (não de atendente)
    if (thread.last_message_sender !== 'contact') {
      return Response.json({ success: true, skipped: 'nao_eh_contato' });
    }

    // ── Destinatários: mesmo critério do alerta interno ───────────────
    // assigned + compartilhados + histórico de atendentes + admins
    const destinatarios = new Set();
    if (thread.assigned_user_id) destinatarios.add(thread.assigned_user_id);
    (thread.shared_with_users || []).forEach((id) => id && destinatarios.add(id));
    (thread.atendentes_historico || []).forEach((id) => id && destinatarios.add(id));

    // Admins sempre recebem (igual ao isAdmin do alerta interno)
    try {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      admins.forEach((u) => u?.id && destinatarios.add(u.id));
    } catch (e) {
      console.warn('[notificarWakeUpMensagem] falha ao buscar admins:', e.message);
    }

    if (destinatarios.size === 0) {
      return Response.json({ success: true, skipped: 'sem_destinatarios' });
    }

    // ── Monta título + corpo no MESMO formato do alerta interno ───────
    let contactName = thread.last_message_sender_name || 'Contato';
    let fotoUrl = null;
    if (thread.contact_id) {
      try {
        const contatos = await base44.asServiceRole.entities.Contact.filter({ id: thread.contact_id });
        if (contatos?.length > 0) {
          contactName = contatos[0].nome || contactName;
          fotoUrl = contatos[0].foto_perfil_url || null;
        }
      } catch { /* segue com o nome cache */ }
    }

    const mediaType = thread.last_media_type;
    let preview = thread.last_message_content || '';
    if (mediaType === 'audio') preview = '🎤 Mensagem de voz';
    else if (mediaType === 'image') preview = '📷 Imagem';
    else if (mediaType === 'video') preview = '🎥 Vídeo';
    else if (mediaType === 'document') preview = '📄 Documento';
    else if (preview.length > 60) preview = preview.substring(0, 60) + '…';
    if (!preview) preview = 'Nova mensagem';

    const action_url = thread.contact_id
      ? `/Comunicacao?contact_id=${thread.contact_id}`
      : `/Comunicacao?thread_id=${thread.id}`;

    // ── Dispara o push para cada destinatário ─────────────────────────
    const resultados = [];
    for (const userId of destinatarios) {
      try {
        const res = await enviarPushDireto(base44, {
          target_user_id: userId,
          tipo: 'message',
          title: contactName,
          body: preview,
          action_url,
          icon: fotoUrl || null,
          thread_id: thread.id,
        });
        resultados.push({ userId, ok: true, res });
      } catch (e) {
        resultados.push({ userId, ok: false, error: e.message });
      }
    }

    return Response.json({
      success: true,
      contato: contactName,
      preview,
      destinatarios: destinatarios.size,
      resultados,
    });
  } catch (error) {
    console.error('[notificarWakeUpMensagem] ❌ Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});