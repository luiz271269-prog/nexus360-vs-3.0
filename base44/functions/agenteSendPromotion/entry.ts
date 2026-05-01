// functions/agenteSendPromotion.js
// Endpoint HTTP para o agente promocoes_automaticas enviar promoções via WhatsApp
// v2.0 — wrapper do motor único enviarPromocao (zero duplicação de regras)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { promotion_id, contact_id, integration_id } = await req.json();
  if (!promotion_id || !contact_id) {
    return Response.json({ error: 'promotion_id e contact_id são obrigatórios' }, { status: 400 });
  }

  // Delega 100% ao motor único — todas as regras (cooldown, bloqueios, janela 24h,
  // formatação, log de auditoria) vivem em enviarPromocao
  try {
    const resp = await base44.asServiceRole.functions.invoke('enviarPromocao', {
      contact_id,
      promotion_id,
      integration_id,
      trigger: 'manual_individual',
      initiated_by: `agente:${user.email || user.id}`
    });
    return Response.json(resp.data || resp);
  } catch (error) {
    console.error('[agenteSendPromotion] ❌', error);
    return Response.json({
      success: false,
      status: 'erro',
      error: error.message || 'Falha ao invocar enviarPromocao'
    }, { status: 500 });
  }
});