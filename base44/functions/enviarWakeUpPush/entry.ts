import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import webpush from 'npm:web-push@3.6.7';

/**
 * enviarWakeUpPush — envia uma notificação Web Push (VAPID) para os devices
 * ativos de um usuário. Mostra alerta com som mesmo com o app fechado.
 *
 * Payload:
 *   target_user_id: string (obrigatório) — quem recebe
 *   tipo: 'message' | 'call' (default 'message')
 *   title: string
 *   body: string
 *   action_url: string (rota a abrir ao clicar, ex: '/Comunicacao')
 *   icon: string (opcional)
 *   sender_user_id: string (opcional — não notifica o próprio remetente)
 *   thread_id / message_id / call_session_id (opcionais — auditoria)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@nexus360.com';

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return Response.json({ success: false, error: 'VAPID não configurado' }, { status: 500 });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const payload = await req.json();

    // Atalho: frontend pede só a chave pública (pode ser exposta com segurança)
    if (payload.action === 'get_public_key') {
      return Response.json({ success: true, publicKey: VAPID_PUBLIC });
    }

    const {
      target_user_id,
      tipo = 'message',
      title = 'Nexus360',
      body = '',
      action_url = '/',
      icon = null,
      sender_user_id = null,
      thread_id = null,
      message_id = null,
      call_session_id = null
    } = payload;

    if (!target_user_id) {
      return Response.json({ success: false, error: 'target_user_id obrigatório' }, { status: 400 });
    }

    if (sender_user_id && sender_user_id === target_user_id) {
      return Response.json({ success: true, sent: 0, reason: 'sender_excluded' });
    }

    const devices = await base44.asServiceRole.entities.UserDevice.filter({
      user_id: target_user_id,
      is_active: true,
      push_provider: 'web_push'
    });

    const elegiveis = devices.filter((d) =>
      tipo === 'call' ? d.can_wake_call !== false : d.can_wake_message !== false
    );

    if (elegiveis.length === 0) {
      await registrarLog(base44, { tipo, target_user_id, status: 'skipped', reason: 'no_active_device', title, body, action_url, sender_user_id, thread_id, message_id, call_session_id });
      return Response.json({ success: true, sent: 0, reason: 'no_active_device' });
    }

    const pushPayload = JSON.stringify({ title, body, tipo, action_url, icon, tag: thread_id ? `thread-${thread_id}` : `nexus-${tipo}` });

    let sent = 0;
    let failed = 0;

    for (const dev of elegiveis) {
      if (!dev.push_endpoint) continue;
      const subscription = {
        endpoint: dev.push_endpoint,
        keys: { p256dh: dev.push_keys_p256dh, auth: dev.push_keys_auth }
      };

      const inicio = Date.now();
      try {
        await webpush.sendNotification(subscription, pushPayload);
        sent++;
        await base44.asServiceRole.entities.UserDevice.update(dev.id, {
          last_success_at: new Date().toISOString(),
          failure_count: 0,
          last_failure_reason: null
        });
        await registrarLog(base44, { tipo, target_user_id, device_id: dev.device_id, platform: dev.platform, status: 'sent', reason: 'ok', title, body, action_url, sender_user_id, thread_id, message_id, call_session_id, duration_ms: Date.now() - inicio });
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
        await registrarLog(base44, { tipo, target_user_id, device_id: dev.device_id, platform: dev.platform, status: 'failed', reason: morto ? `endpoint_gone_${code}` : 'provider_error', title, body, action_url, sender_user_id, thread_id, message_id, call_session_id, provider_status_code: code, error_message: String(err.message || err), duration_ms: Date.now() - inicio });
      }
    }

    return Response.json({ success: true, sent, failed });
  } catch (error) {
    console.error('[enviarWakeUpPush] ❌ Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});

async function registrarLog(base44, data) {
  try {
    await base44.asServiceRole.entities.WakeUpLog.create({
      provider: 'web_push',
      ...data
    });
  } catch (e) {
    console.error('[enviarWakeUpPush] falha ao registrar WakeUpLog:', e.message);
  }
}