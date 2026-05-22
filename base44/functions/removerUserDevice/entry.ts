import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * removerUserDevice — revoga um device logicamente.
 *
 * NÃO deleta físico. Marca is_active=false e revoked_at=agora.
 * Mantém o histórico para auditoria (WakeUpLog continua referenciando).
 *
 * Entrada:
 *   device_id: string (obrigatório)
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
    const { device_id } = body;

    if (!device_id) {
      return new Response(JSON.stringify({ success: false, error: 'device_id obrigatório' }), { status: 400, headers });
    }

    const existentes = await base44.asServiceRole.entities.UserDevice.filter({
      user_id: user.id,
      device_id
    });

    if (existentes.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Device já não existe', revoked: 0 }), { status: 200, headers });
    }

    const agora = new Date().toISOString();
    let revoked = 0;

    for (const dev of existentes) {
      await base44.asServiceRole.entities.UserDevice.update(dev.id, {
        is_active: false,
        revoked_at: agora
      });
      revoked++;
    }

    console.log(`[removerUserDevice] 🔒 Revogados ${revoked} device(s) user=${user.id} device_id=${device_id}`);

    return new Response(JSON.stringify({ success: true, revoked }), { status: 200, headers });
  } catch (error) {
    console.error('[removerUserDevice] ❌ Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
  }
});