// ============================================================================
// preAtendimentoHandler.js — v14 (delegação para primeiroAtendimentoUnificado)
// ============================================================================
// Antes: orquestrava 3 skills em cadeia via HTTP (ACK → Router → Queue)
// Agora: delega TUDO para primeiroAtendimentoUnificado (5 camadas em 1 função)
//
// Motivo: eliminar cascata de falhas HTTP — se uma skill retornava 500,
// o pipeline inteiro morria. A função unificada isola cada camada.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { thread_id, contact_id, whatsapp_integration_id, user_input, message_id } = payload;

    if (thread_id === undefined || contact_id === undefined) {
      return Response.json({ success: false, error: 'Missing IDs' }, { status: 400 });
    }

    console.log('[PRE-ATENDIMENTO v14] Delegando para primeiroAtendimentoUnificado');

    const messageText = user_input?.content || '';

    // Delegação única — a função unificada cuida de todas as 5 camadas:
    // Dedup → ACK → Intent → Routing → Atribuição
    const resultado = await base44.asServiceRole.functions.invoke('primeiroAtendimentoUnificado', {
      thread_id,
      contact_id,
      integration_id: whatsapp_integration_id,
      message_id,
      message_content: messageText
    });

    return Response.json({
      success: true,
      resultado: 'pipeline_unificado_executado',
      detalhes: resultado?.data || resultado
    }, { status: 200 });

  } catch (error) {
    console.error('[PRE-ATENDIMENTO v14] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});