import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// PROCESS INBOUND - CÉREBRO UNIFICADO PARA Z-API E W-API
// ============================================================================
// Recebe mensagens normalizadas de ambos os provedores e aplica:
// - URA / Pré-atendimento
// - Roteamento inteligente
// - Automações / Playbooks
// - Promoções
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { message, contact, thread, integration, provider, messageContent, rawPayload } = await req.json();

    console.log('[PROCESS_INBOUND] 🧠 Cérebro acionado');
    console.log('[PROCESS_INBOUND] Provider:', provider);
    console.log('[PROCESS_INBOUND] Mensagem:', message?.id);
    console.log('[PROCESS_INBOUND] Contato:', contact?.nome || contact?.telefone);
    console.log('[PROCESS_INBOUND] Thread:', thread?.id);
    console.log('[PROCESS_INBOUND] Integração:', integration?.nome_instancia);
    console.log('[PROCESS_INBOUND] Conteúdo:', messageContent?.substring(0, 100));

    // TODO: Integrar com lib/inboundCore.js ou lógica de URA/Automação
    // Por enquanto, apenas loga e retorna sucesso para validar conectividade

    return Response.json({ 
      success: true, 
      status: 'processed',
      message_id: message?.id,
      provider,
      note: 'Cérebro híbrido processou com sucesso (lógica de negócio será integrada aqui)'
    });

  } catch (error) {
    console.error('[PROCESS_INBOUND] ❌ Erro ao processar:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});