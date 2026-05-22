import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * registrarUserDevice — registra ou atualiza um device para Wake-Up.
 *
 * Idempotente por (user_id + device_id). Se já existe, faz update.
 * Se não existe, cria.
 *
 * Entrada:
 *   device_id: string (obrigatório) — gerado no frontend, persistido em localStorage
 *   platform: 'web_desktop' | 'web_mobile' | 'pwa_desktop' | 'pwa_mobile' | ...
 *   push_endpoint: string (obrigatório para Web Push)
 *   push_keys_p256dh: string
 *   push_keys_auth: string
 *   device_label: string (opcional, ex: 'Chrome Windows')
 *   browser: string (opcional)
 *   os: string (opcional)
 *   user_agent: string (opcional)
 *   can_wake_call: boolean (default true)
 *   can_wake_message: boolean (default true)
 */
Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
    }

    const body = await req.json();
    const {
      device_id,
      platform = 'web_desktop',
      push_endpoint,
      push_keys_p256dh,
      push_keys_auth,
      device_label,
      browser,
      os,
      user_agent,
      can_wake_call = true,
      can_wake_message = true
    } = body;

    if (!device_id) {
      return new Response(JSON.stringify({ success: false, error: 'device_id obrigatório' }), { status: 400, headers });
    }

    if (!push_endpoint) {
      return new Response(JSON.stringify({ success: false, error: 'push_endpoint obrigatório' }), { status: 400, headers });
    }

    const agora = new Date().toISOString();

    // Idempotente: busca existente por (user_id + device_id)
    const existentes = await base44.asServiceRole.entities.UserDevice.filter({
      user_id: user.id,
      device_id
    });

    const payload = {
      user_id: user.id,
      device_id,
      platform,
      device_label: device_label || null,
      browser: browser || null,
      os: os || null,
      user_agent: user_agent || null,
      push_provider: 'web_push',
      push_endpoint,
      push_keys_p256dh: push_keys_p256dh || null,
      push_keys_auth: push_keys_auth || null,
      can_wake_call,
      can_wake_message,
      is_active: true,
      consent_at: existentes[0]?.consent_at || agora,
      revoked_at: null,
      last_seen_at: agora,
      failure_count: 0,
      last_failure_reason: null
    };

    let device;
    if (existentes.length > 0) {
      device = await base44.asServiceRole.entities.UserDevice.update(existentes[0].id, payload);
      console.log(`[registrarUserDevice] ✏️ Atualizado device ${existentes[0].id} user=${user.id} device_id=${device_id}`);
    } else {
      device = await base44.asServiceRole.entities.UserDevice.create(payload);
      console.log(`[registrarUserDevice] ✅ Criado device ${device.id} user=${user.id} device_id=${device_id}`);
    }

    return new Response(JSON.stringify({ success: true, device }), { status: 200, headers });
  } catch (error) {
    console.error('[registrarUserDevice] ❌ Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
  }
});