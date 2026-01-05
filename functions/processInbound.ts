import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { processInboundEvent } from './lib/inboundCore.js';

// ============================================================================
// PROCESS INBOUND - ADAPTADOR HÍBRIDO PARA CÉREBRO ÚNICO
// ============================================================================
// Este arquivo é apenas um adaptador para permitir chamadas via SDK invoke.
// A lógica real está em lib/inboundCore.js (processInboundEvent).
// Atende: W-API e qualquer outro provedor que precise chamar via HTTP.
// ============================================================================

const VERSION = 'v1.1.0-ADAPTER';

Deno.serve(async (req) => {
  console.log('[PROCESS-INBOUND] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { message, contact, thread, integration, provider, messageContent, rawPayload } = payload;

    console.log(`[PROCESS-INBOUND] 🧠 Recebido via ${provider?.toUpperCase() || 'UNKNOWN'}`);
    console.log(`[PROCESS-INBOUND] 📩 Message: ${message?.id}`);
    console.log(`[PROCESS-INBOUND] 👤 Contact: ${contact?.nome || contact?.telefone}`);
    console.log(`[PROCESS-INBOUND] 💭 Thread: ${thread?.id}`);

    // ✅ DELEGAR PARA O CÉREBRO ÚNICO (inboundCore.js)
    const resultado = await processInboundEvent({
      base44,
      contact,
      thread,
      message,
      integration,
      provider,
      messageContent,
      rawPayload
    });

    console.log('[PROCESS-INBOUND] ✅ Processamento concluído:', resultado);

    return Response.json({
      success: true,
      version: VERSION,
      provider,
      message_id: message?.id,
      contact_id: contact?.id,
      thread_id: thread?.id,
      pipeline: resultado.pipeline,
      actions: resultado.actions,
      status: 'processed_by_core'
    });

  } catch (error) {
    console.error('[PROCESS-INBOUND] ❌ Erro fatal:', error.message);
    console.error('[PROCESS-INBOUND] Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});