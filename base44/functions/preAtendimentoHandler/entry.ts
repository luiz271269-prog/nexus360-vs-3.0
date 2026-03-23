// ============================================================================
// PRÉ-ATENDIMENTO HANDLER v13.0.0 - SKILLS PIPELINE
// ============================================================================
// NOVO FLUXO: Invocar skills em sequência (ACK → Router → Queue)
// Substitui completamente a lógica conversacional anterior
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { thread_id, contact_id, whatsapp_integration_id, user_input } = payload;

    if (!thread_id || !contact_id) {
      return Response.json(
        { success: false, error: 'thread_id e contact_id são obrigatórios' },
        { status: 400, headers }
      );
    }

    const userInputNorm = user_input || { type: 'text', content: '' };
    console.log('[PRE-ATENDIMENTO v13] 🚀 Pipeline iniciado | thread:', thread_id);

    // Buscar thread fresca (evita 403 por permissões desatualizadas)
    let thread;
    try {
      thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    } catch (e) {
      console.error('[PRE-ATENDIMENTO v13] ❌ Erro ao buscar thread:', e.message);
      return Response.json({ success: false, error: 'thread_not_found', detail: e.message }, { status: 404, headers });
    }

    // ════════════════════════════════════════════════════════════════
    // SKILL 1: ACK IMEDIATO (lock 60s anti-duplicata)
    // ════════════════════════════════════════════════════════════════
    console.log('[PRE-ATENDIMENTO v13] ⏱️ SKILL 1: ACK Imediato...');
    let ackResult;
    try {
      ackResult = await base44.functions.invoke('skillACKImediato', {
      if (ackResult?.data?.success) {
        console.log('[PRE-ATENDIMENTO v13] ✅ SKILL 1 ok | tipo:', ackResult.data?.ack_tipo || 'enviado');
      } else if (ackResult?.data?.skipped) {
        console.log('[PRE-ATENDIMENTO v13] ⏭️ SKILL 1 skipped:', ackResult.data?.reason);
        return Response.json({ success: true, skipped: true, reason: ackResult.data.reason }, { status: 200, headers });
      }
    } catch (ackErr) {
      console.error('[PRE-ATENDIMENTO v13] ❌ SKILL 1 falhou:', ackErr.message);
      return Response.json({ success: false, error: 'skill_ack_falhou', detail: ackErr.message }, { status: 500, headers });
    }

    // ════════════════════════════════════════════════════════════════
    // SKILL 2: INTENT ROUTER (detectar setor + persistir IntentDetection)
    // ════════════════════════════════════════════════════════════════
    if (userInputNorm.type === 'text' && userInputNorm.content?.length > 0) {
      console.log('[PRE-ATENDIMENTO v13] 🎯 SKILL 2: Intent Router...');
      let routerResult;
      try {
        routerResult = await base44.asServiceRole.functions.invoke('skillIntentRouter', {
          thread_id,
          contact_id,
          message_content: userInputNorm.content
        });
        if (routerResult?.data?.success) {
          console.log('[PRE-ATENDIMENTO v13] ✅ SKILL 2 ok | setor:', routerResult.data?.setor);
        }
      } catch (routerErr) {
        console.error('[PRE-ATENDIMENTO v13] ❌ SKILL 2 falhou:', routerErr.message);
        // Não abortar — continuar para queue manager mesmo sem intent detectado
        routerResult = { data: { setor: 'geral', confidence: 0.3, success: false } };
      }

      // ════════════════════════════════════════════════════════════════
      // SKILL 3: QUEUE MANAGER (atribuição + roteamento + fila)
      // ════════════════════════════════════════════════════════════════
      if (routerResult?.data?.setor) {
        console.log('[PRE-ATENDIMENTO v13] 📊 SKILL 3: Queue Manager...');
        try {
          const queueResult = await base44.asServiceRole.functions.invoke('skillQueueManager', {
            thread_id,
            contact_id,
            setor: routerResult.data.setor,
            integration_id: whatsapp_integration_id
          });
          console.log('[PRE-ATENDIMENTO v13] ✅ SKILL 3 ok | atendente:', queueResult.data?.atendente_nome || 'enfileirado');
          
          // ✅ SUCESSO: Pipeline completo
          return Response.json({
            success: true,
            resultado: 'pipeline_completo',
            ack: ackResult?.data,
            intent: routerResult?.data,
            queue: queueResult?.data
          }, { status: 200, headers });
        } catch (queueErr) {
          console.error('[PRE-ATENDIMENTO v13] ❌ SKILL 3 falhou:', queueErr.message);
          return Response.json({
            success: false,
            error: 'skill_queue_falhou',
            detail: queueErr.message
          }, { status: 500, headers });
        }
      }
    }

    // Fallback: apenas ACK, sem input de texto
    return Response.json({
      success: true,
      resultado: 'ack_apenas',
      ack: ackResult?.data
    }, { status: 200, headers });

  } catch (error) {
    console.error('[PRE-ATENDIMENTO v13] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});