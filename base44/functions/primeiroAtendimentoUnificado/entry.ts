// ============================================================================
// primeiroAtendimentoUnificado — DEPRECATED v2.0 (FACHADA)
// ============================================================================
// ⚠️ Renomeado para skillPreAtendimentos. Esta função permanece como FACHADA
// para não quebrar chamadores legados/externos. Após 24-48h de observação
// dos logs (`_legacy_caller`), pode ser arquivada.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    console.log('[PRIMEIRO-ATEND-DEPRECATED] ⚠️ Chamada legada — delegando para skillPreAtendimentos', {
      thread_id: payload.thread_id,
      contact_id: payload.contact_id,
      _caller: req.headers.get('user-agent') || 'unknown'
    });

    if (!payload.thread_id || !payload.contact_id) {
      return Response.json({ success: false, error: 'Campos obrigatórios: thread_id, contact_id', _delegated: false }, { status: 400, headers });
    }

    const result = await base44.asServiceRole.functions.invoke('skillPreAtendimentos', {
      ...payload,
      _legacy_caller: payload._legacy_caller || 'primeiroAtendimentoUnificado'
    });

    return Response.json({
      ...(result?.data || {}),
      _delegated: true,
      _via: 'primeiroAtendimentoUnificado'
    }, { headers });

  } catch (error) {
    console.error('[PRIMEIRO-ATEND-DEPRECATED] Error:', error.message);
    return Response.json({ success: false, error: error.message, _delegated: false }, { status: 500, headers });
  }
});