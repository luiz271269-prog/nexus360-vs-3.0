import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// PROCESS INBOUND - CÉREBRO HÍBRIDO UNIFICADO (Z-API + W-API)
// ============================================================================
// Recebe payload normalizado de webhookWatsZapi e webhookWapi
// Aplica: URA, Roteamento, Automações, Promoções
// ============================================================================

const VERSION = 'v1.0.0-HYBRID';

Deno.serve(async (req) => {
  console.log('[CÉREBRO] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const { message, contact, thread, integration, provider, messageContent, rawPayload } = payload;

    console.log(`[CÉREBRO] 🧠 Acionado via ${provider?.toUpperCase() || 'UNKNOWN'}`);
    console.log(`[CÉREBRO] 📩 Mensagem: ${message?.id}`);
    console.log(`[CÉREBRO] 👤 Contato: ${contact?.nome || contact?.telefone}`);
    console.log(`[CÉREBRO] 💭 Thread: ${thread?.id}`);
    console.log(`[CÉREBRO] 🔗 Integração: ${integration?.nome_instancia || integration?.id}`);
    console.log(`[CÉREBRO] 📝 Conteúdo (100 chars): ${messageContent?.substring(0, 100)}`);

    // ============================================================================
    // TODO: INTEGRAR LÓGICA DE NEGÓCIO AQUI
    // ============================================================================
    // 1. Verificar pré-atendimento (URA)
    // 2. Aplicar roteamento inteligente
    // 3. Executar playbooks/automações
    // 4. Disparar promoções se elegível
    // 5. Atualizar scores/engagement
    // ============================================================================

    // Por enquanto, apenas loga e retorna sucesso
    console.log('[CÉREBRO] ✅ Processamento concluído (lógica será integrada aqui)');

    return Response.json({
      success: true,
      version: VERSION,
      provider,
      message_id: message?.id,
      contact_id: contact?.id,
      thread_id: thread?.id,
      status: 'processed_by_hybrid_brain',
      note: 'Cérebro híbrido funcionando - lógica de URA/Automação será integrada'
    });

  } catch (error) {
    console.error('[CÉREBRO] ❌ Erro fatal:', error.message);
    console.error('[CÉREBRO] Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});