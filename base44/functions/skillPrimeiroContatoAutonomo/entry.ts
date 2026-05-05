// ============================================================================
// SKILL PRIMEIRO CONTATO AUTÔNOMO — v2.0 (HÍBRIDA)
// ============================================================================
// ⚠️ Chamadas individuais → delegam para primeiroAtendimentoUnificado.
// ✅ batch_mode preservado: varre threads travadas e dispara o unificado para cada.
// ============================================================================

import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.23';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const tsInicio = Date.now();

  // SDK init (suporta cron sem request)
  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    console.log('[SKILL-PRIMEIRO-CONTATO-FACHADA] Contexto cron — usando createClient()');
    base44 = createClient();
  }

  // Auth opcional (cron não tem user)
  let user = null;
  try {
    user = await base44.auth.me();
  } catch (e) {
    console.log('[SKILL-PRIMEIRO-CONTATO-FACHADA] Modo automação (sem user)');
  }
  if (user && user.role !== 'admin') {
    return Response.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403, headers });
  }

  const payload = await req.json().catch(() => ({}));
  const { thread_id, contact_id, integration_id, message_id, message_content, batch_mode } = payload;

  // ════════════════════════════════════════════════════════════════════
  // MODO BATCH: varre threads travadas e delega cada uma para o unificado
  // ════════════════════════════════════════════════════════════════════
  if (batch_mode) {
    console.log('[SKILL-PRIMEIRO-CONTATO-FACHADA] 🔁 BATCH MODE — buscando threads travadas');

    const threadsTravadas = await base44.asServiceRole.entities.MessageThread.filter({
      thread_type: 'contact_external',
      assigned_user_id: { $exists: false },
      pre_atendimento_state: { $in: ['WAITING_SECTOR_CHOICE', 'WAITING_QUEUE_DECISION', 'WAITING_NEED', 'TIMEOUT'] },
      status: 'aberta'
    }, '-last_message_at', 20);

    const resultados = { processadas: 0, resgatadas: 0, erros: 0 };

    for (const thread of threadsTravadas) {
      try {
        if (!thread.contact_id) continue;

        const ultimaMsg = thread.last_message_content || '';
        const r = await base44.asServiceRole.functions.invoke('skillPreAtendimentos', {
          thread_id: thread.id,
          contact_id: thread.contact_id,
          integration_id: thread.whatsapp_integration_id || null,
          message_content: ultimaMsg,
          _legacy_caller: 'skillPrimeiroContatoAutonomo.batch'
        });

        resultados.processadas++;
        if (r?.data?.success) resultados.resgatadas++;
        // throttle leve para não estressar API
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`[SKILL-PRIMEIRO-CONTATO-FACHADA] Erro thread ${thread.id}:`, err.message);
        resultados.erros++;
      }
    }

    return Response.json({
      success: true,
      batch_mode: true,
      threads_encontradas: threadsTravadas.length,
      resultados,
      duration_ms: Date.now() - tsInicio
    }, { headers });
  }

  // ════════════════════════════════════════════════════════════════════
  // MODO INDIVIDUAL: delega 100% para primeiroAtendimentoUnificado
  // ════════════════════════════════════════════════════════════════════
  if (!thread_id || !contact_id) {
    return Response.json({ success: false, error: 'thread_id e contact_id obrigatórios (ou use batch_mode: true)' }, { status: 400, headers });
  }

  console.log('[SKILL-PRIMEIRO-CONTATO-FACHADA] ⚠️ Chamada individual legada — delegando para skillPreAtendimentos');

  try {
    const result = await base44.asServiceRole.functions.invoke('skillPreAtendimentos', {
      thread_id,
      contact_id,
      integration_id: integration_id || null,
      message_id: message_id || null,
      message_content: message_content || '',
      _legacy_caller: 'skillPrimeiroContatoAutonomo'
    });

    return Response.json({
      ...(result?.data || {}),
      _delegated: true,
      _via: 'skillPrimeiroContatoAutonomo',
      duration_ms: Date.now() - tsInicio
    }, { headers });

  } catch (error) {
    console.error('[SKILL-PRIMEIRO-CONTATO-FACHADA] Error:', error.message);
    return Response.json({ success: false, error: error.message, _delegated: false }, { status: 500, headers });
  }
});