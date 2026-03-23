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

    // Buscar thread fresca
    let thread;
    try {
      thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    } catch (e) {
      console.error('[PRE-ATENDIMENTO v13] ❌ Erro ao buscar thread:', e.message);
      return Response.json({ success: false, error: 'thread_not_found' }, { status: 404, headers });
    }

    // ════════════════════════════════════════════════════════════════
    // SKILL 1: ACK IMEDIATO (lock 60s anti-duplicata)
    // ════════════════════════════════════════════════════════════════
    console.log('[PRE-ATENDIMENTO v13] ⏱️ SKILL 1: ACK Imediato...');
    let ackResult = {};
    try {
      ackResult = await base44.asServiceRole.functions.invoke('skillACKImediato', {
        thread_id,
        contact_id,
        integration_id: whatsapp_integration_id
      });
      
      if (ackResult && ackResult.success) {
        console.log('[PRE-ATENDIMENTO v13] ✅ SKILL 1 ok | tipo:', ackResult.ack_tipo);
      } else if (ackResult && ackResult.skipped) {
        console.log('[PRE-ATENDIMENTO v13] ⏭️ SKILL 1 skipped:', ackResult.reason);
        return Response.json({ success: true, skipped: true, reason: ackResult.reason }, { status: 200, headers });
      }
    } catch (ackErr) {
      console.error('[PRE-ATENDIMENTO v13] ❌ SKILL 1 falhou:', ackErr.message);
      return Response.json({ success: false, error: 'skill_ack_falhou', detail: ackErr.message }, { status: 500, headers });
    }

    // ════════════════════════════════════════════════════════════════
    // SKILL 2: INTENT ROUTER (detectar setor)
    // ════════════════════════════════════════════════════════════════
    let routerResult = { setor: 'geral' };
    if (userInputNorm.type === 'text' && userInputNorm.content && userInputNorm.content.length > 0) {
      console.log('[PRE-ATENDIMENTO v13] 🎯 SKILL 2: Intent Router...');
      try {
        routerResult = await base44.asServiceRole.functions.invoke('skillIntentRouter', {
          thread_id,
          contact_id,
          message_content: userInputNorm.content
        });
        if (routerResult && routerResult.success) {
          console.log('[PRE-ATENDIMENTO v13] ✅ SKILL 2 ok | setor:', routerResult.setor);
        }
      } catch (routerErr) {
        console.warn('[PRE-ATENDIMENTO v13] ⚠️ SKILL 2 falhou (continuando):', routerErr.message);
        routerResult = { setor: 'geral', confidence: 0.3 };
      }

      // ════════════════════════════════════════════════════════════════
      // SKILL 3: QUEUE MANAGER (atribuição + roteamento + fila)
      // ════════════════════════════════════════════════════════════════
      console.log('[PRE-ATENDIMENTO v13] 📊 SKILL 3: Queue Manager...');
      try {
        const queueResult = await base44.asServiceRole.functions.invoke('skillQueueManager', {
          thread_id,
          contact_id,
          setor: routerResult.setor,
          integration_id: whatsapp_integration_id
        });
        console.log('[PRE-ATENDIMENTO v13] ✅ SKILL 3 ok');
        
        return Response.json({
          success: true,
          resultado: 'pipeline_completo',
          ack: ackResult,
          intent: routerResult,
          queue: queueResult
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

    // Fallback: apenas ACK
    return Response.json({
      success: true,
      resultado: 'ack_apenas'
    }, { status: 200, headers });

  } catch (error) {
    console.error('[PRE-ATENDIMENTO v13] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});