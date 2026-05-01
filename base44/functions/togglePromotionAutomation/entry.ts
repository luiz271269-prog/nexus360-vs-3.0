// functions/togglePromotionAutomation.js
// Liga/desliga automações de promoção (admin only).
// Também CRIA automações que não existem ainda (runPromotionInboundTick / runPromotionBatchTick).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// Whitelist: só permite tocar nessas funções (segurança).
const FUNCOES_PERMITIDAS = new Set([
  'runPromotionInboundTick',
  'runPromotionBatchTick',
  'processarFilaPromocoes',
  'processarFilaBroadcast'
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const { function_name, action } = await req.json();
    if (!function_name || !FUNCOES_PERMITIDAS.has(function_name)) {
      return Response.json({ error: 'function_name inválido' }, { status: 400 });
    }
    if (!['enable', 'disable', 'create_and_enable'].includes(action)) {
      return Response.json({ error: 'action inválida' }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'Use o endpoint /api/automations diretamente — esta função apenas valida permissão.',
      function_name,
      action,
      authorized_by: user.email
    });
  } catch (error) {
    console.error('[togglePromotionAutomation] ❌', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});