// ============================================================================
// SKILL INTENT ROUTER — DEPRECATED v3.0 (FACHADA)
// ============================================================================
// ⚠️ Toda a lógica foi unificada em primeiroAtendimentoUnificado (Camada 2)
// Esta função permanece como FACHADA para não quebrar chamadores legados.
// Após período de observação dos logs, esta skill pode ser arquivada.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    console.log('[SKILL-ROUTER-DEPRECATED] ⚠️ Chamada legada — delegando para skillPreAtendimentos', {
      thread_id: payload.thread_id,
      contact_id: payload.contact_id
    });

    if (!payload.thread_id || !payload.contact_id) {
      return Response.json({ success: false, error: 'Campos obrigatórios ausentes', _delegated: false }, { status: 400, headers });
    }

    const result = await base44.asServiceRole.functions.invoke('skillPreAtendimentos', {
      thread_id: payload.thread_id,
      contact_id: payload.contact_id,
      integration_id: payload.integration_id || null,
      message_id: payload.message_id || null,
      message_content: payload.message_content || '',
      _legacy_caller: 'skillIntentRouter'
    });

    return Response.json({ ...(result?.data || {}), _delegated: true, _via: 'skillIntentRouter' }, { headers });

  } catch (error) {
    console.error('[SKILL-ROUTER-DEPRECATED] Error:', error.message);
    return Response.json({ success: false, error: error.message, _delegated: false }, { status: 500, headers });
  }
});