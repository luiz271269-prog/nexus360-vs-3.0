// ============================================================================
// SKILL QUEUE MANAGER — DEPRECATED v2.0 (FACHADA)
// ============================================================================
// ⚠️ Toda a lógica foi unificada em primeiroAtendimentoUnificado (Camada 3)
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

    console.log('[SKILL-QUEUE-DEPRECATED] ⚠️ Chamada legada — delegando para skillPreAtendimentos', {
      thread_id: payload.thread_id,
      contact_id: payload.contact_id,
      sector_id: payload.sector_id
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
      sector_hint: payload.sector_id || null,
      _legacy_caller: 'skillQueueManager'
    });

    return Response.json({ ...(result?.data || {}), _delegated: true, _via: 'skillQueueManager' }, { headers });

  } catch (error) {
    console.error('[SKILL-QUEUE-DEPRECATED] Error:', error.message);
    return Response.json({ success: false, error: error.message, _delegated: false }, { status: 500, headers });
  }
});