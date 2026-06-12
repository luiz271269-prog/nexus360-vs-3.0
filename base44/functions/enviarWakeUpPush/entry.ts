import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: jsonHeaders });
}

function truncate(value: unknown, max = 180) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeTargetIds(body: Record<string, unknown>) {
  const raw = body.target_user_ids || body.user_ids || body.target_user_id || body.user_id;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [...new Set(arr.map((id) => String(id || '').trim()).filter(Boolean))];
}

function reasonFromStatus(status: number) {
  if (status === 410 || status === 404) return 'endpoint_gone_410';
  if (status === 401 || status === 403) return 'unauthorized_401';
  if (status === 429) return 'rate_limited_429';
  return 'provider_error';
}

function buildPayload(body: Record<string, unknown>) {
  const tipo = String(body.tipo || body.type || 'message');
  const title = truncate(body.title || body.titulo || (tipo === 'call' ? 'Chamada recebida' : 'Nova mensagem Nexus360'), 80);
  const bodyText = truncate(body.body || body.mensagem || body.content || 'Abra o Nexus360 para visualizar.', 180);
  const actionUrl = String(body.action_url || body.url || '/Comunicacao').trim() || '/Comunicacao';

  return {
    title,
    body: bodyText,
    icon: body.icon ? String(body.icon) : undefined,
    badge: body.badge ? String(body.badge) : undefined,
    tag: String(body.tag || `nexus-${tipo}-${body.thread_id || body.call_session_id || Date.now()}`),
    renotify: body.renotify !== false,
    requireInteraction: body.require_interaction !== false,
    silent: body.silent === true ? true : false,
    vibrate: Array.isArray(body.vibrate) ? body.vibrate : [200, 100, 200],
    data: {
      tipo,
      thread_id: body.thread_id || null,
      message_id: body.message_id || null,
      call_session_id: body.call_session_id || null,
      action_url: actionUrl,
      created_at: new Date().toISOString(),
      metadata: body.metadata || {}
    },
    actions: Array.isArray(body.actions) ? body.actions : [
      { action: 'open', title: 'Abrir' }
    ]
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: jsonHeaders });
  if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Método não permitido. Use POST.' }, 405);

  const started = Date.now();
  const base44 = createClientFromRequest(req);

  try {
    const caller = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:suporte@nexus360.local';

    if (body.action === 'get_public_key') {
      if (!vapidPublic) return jsonResponse({ success: false, error: 'VAPID_PUBLIC_KEY não configurada' }, 500);
      return jsonResponse({ success: true, publicKey: vapidPublic });
    }

    const targetUserIds = normalizeTargetIds(body);

    if (targetUserIds.length === 0) {
      return jsonResponse({ success: false, error: 'target_user_id ou target_user_ids obrigatório' }, 400);
    }

    if (!vapidPublic || !vapidPrivate) {
      for (const targetUserId of targetUserIds) {
        await base44.asServiceRole.entities.WakeUpLog.create({
          tipo: body.tipo === 'call' ? 'call' : 'message',
          target_user_id: targetUserId,
          status: 'skipped',
          reason: 'vapid_not_configured',
          provider: 'web_push',
          thread_id: body.thread_id || null,
          message_id: body.message_id || null,
          call_session_id: body.call_session_id || null,
          sender_user_id: body.sender_user_id || caller?.id || null,
          title: truncate(body.title || body.titulo),
          body: truncate(body.body || body.mensagem),
          action_url: body.action_url || body.url || null,
          duration_ms: Date.now() - started
        });
      }
      return jsonResponse({ success: false, error: 'VAPID não configurado', reason: 'vapid_not_configured' }, 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const payload = buildPayload(body);
    if (!payload.icon) delete payload.icon;
    if (!payload.badge) delete payload.badge;
    const results: Array<Record<string, unknown>> = [];

    for (const targetUserId of targetUserIds) {
      const devices = await base44.asServiceRole.entities.UserDevice.filter({
        user_id: targetUserId,
        is_active: true,
        push_provider: 'web_push'
      });

      const eligible = (devices || []).filter((device: Record<string, unknown>) => {
        if (!device.push_endpoint || !device.push_keys_p256dh || !device.push_keys_auth) return false;
        if (payload.data.tipo === 'call' && device.can_wake_call === false) return false;
        if (payload.data.tipo !== 'call' && device.can_wake_message === false) return false;
        return true;
      });

      if (eligible.length === 0) {
        await base44.asServiceRole.entities.WakeUpLog.create({
          tipo: payload.data.tipo === 'call' ? 'call' : 'message',
          target_user_id: targetUserId,
          status: 'skipped',
          reason: 'no_active_device',
          provider: 'web_push',
          thread_id: payload.data.thread_id,
          message_id: payload.data.message_id,
          call_session_id: payload.data.call_session_id,
          sender_user_id: body.sender_user_id || caller?.id || null,
          title: payload.title,
          body: payload.body,
          action_url: payload.data.action_url,
          duration_ms: Date.now() - started
        });
        results.push({ target_user_id: targetUserId, status: 'skipped', reason: 'no_active_device' });
        continue;
      }

      for (const device of eligible) {
        const sendStarted = Date.now();
        try {
          const subscription = {
            endpoint: device.push_endpoint,
            keys: {
              p256dh: device.push_keys_p256dh,
              auth: device.push_keys_auth
            }
          };

          await webpush.sendNotification(subscription, JSON.stringify(payload), {
            TTL: Number(body.ttl || 60 * 60 * 4),
            urgency: String(body.urgency || 'high')
          });

          await base44.asServiceRole.entities.UserDevice.update(device.id, {
            last_success_at: new Date().toISOString(),
            failure_count: 0,
            last_failure_reason: null
          });

          await base44.asServiceRole.entities.WakeUpLog.create({
            tipo: payload.data.tipo === 'call' ? 'call' : 'message',
            target_user_id: targetUserId,
            device_id: device.id,
            platform: device.platform,
            provider: 'web_push',
            status: 'sent',
            reason: 'ok',
            thread_id: payload.data.thread_id,
            message_id: payload.data.message_id,
            call_session_id: payload.data.call_session_id,
            sender_user_id: body.sender_user_id || caller?.id || null,
            title: payload.title,
            body: payload.body,
            action_url: payload.data.action_url,
            duration_ms: Date.now() - sendStarted
          });

          results.push({ target_user_id: targetUserId, device_id: device.id, status: 'sent' });
        } catch (error) {
          const err = error as { statusCode?: number; status?: number; message?: string };
          const statusCode = Number(err.statusCode || err.status || 0) || null;
          const reason = statusCode ? reasonFromStatus(statusCode) : 'unknown_error';
          const failureCount = Number(device.failure_count || 0) + 1;
          const deactivate = reason === 'endpoint_gone_410' || reason === 'unauthorized_401' || failureCount >= 5;

          await base44.asServiceRole.entities.UserDevice.update(device.id, {
            is_active: deactivate ? false : device.is_active,
            last_failure_at: new Date().toISOString(),
            failure_count: failureCount,
            last_failure_reason: reason,
            revoked_at: deactivate ? new Date().toISOString() : device.revoked_at || null
          });

          await base44.asServiceRole.entities.WakeUpLog.create({
            tipo: payload.data.tipo === 'call' ? 'call' : 'message',
            target_user_id: targetUserId,
            device_id: device.id,
            platform: device.platform,
            provider: 'web_push',
            status: 'failed',
            reason,
            thread_id: payload.data.thread_id,
            message_id: payload.data.message_id,
            call_session_id: payload.data.call_session_id,
            sender_user_id: body.sender_user_id || caller?.id || null,
            title: payload.title,
            body: payload.body,
            action_url: payload.data.action_url,
            error_message: String(err.message || error).slice(0, 500),
            provider_status_code: statusCode,
            duration_ms: Date.now() - sendStarted
          });

          results.push({ target_user_id: targetUserId, device_id: device.id, status: 'failed', reason, provider_status_code: statusCode });
        }
      }
    }

    return jsonResponse({ success: true, payload: { title: payload.title, body: payload.body, tag: payload.tag }, results });
  } catch (error) {
    console.error('[enviarWakeUpPush] erro:', error);
    const err = error as { message?: string };
    return jsonResponse({ success: false, error: String(err.message || error) }, 500);
  }
});
