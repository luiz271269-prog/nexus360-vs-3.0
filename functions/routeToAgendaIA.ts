import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ═══════════════════════════════════════════════════════════════════════════
// 🚦 ROTEADOR PARA AGENDA IA
// ═══════════════════════════════════════════════════════════════════════════
// Chamado APÓS processInbound salvar a mensagem
// Decide se deve encaminhar para processScheduleIntent
// 
// CONDIÇÕES PARA ENTRAR NA AGENDA IA:
// 1. thread.assistant_mode == 'agenda' OU
// 2. integration_id == NEXUS_AGENDA_INTEGRATION OU  
// 3. contact.telefone == '+559999999999' (NÚMERO VIRTUAL EXCLUSIVO - DDD 99 não existe)
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const payload = await req.json();
    const { thread_id, message_id, content, from_type, from_id } = payload;
    
    if (!thread_id || !message_id || !content) {
      return Response.json({ 
        success: false, 
        routed: false,
        error: 'Campos obrigatórios: thread_id, message_id, content' 
      }, { status: 400 });
    }
    
    console.log(`[ROUTE-AGENDA] 🚦 Analisando thread ${thread_id.substring(0, 8)}...`);
    
    // Buscar thread
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    
    if (!thread) {
      console.log(`[ROUTE-AGENDA] ⚠️ Thread não encontrada`);
      return Response.json({ success: true, routed: false, reason: 'thread_not_found' });
    }
    
    // CONDIÇÃO 1: assistant_mode explícito
    if (thread.assistant_mode === 'agenda') {
      console.log(`[ROUTE-AGENDA] ✅ Thread com assistant_mode='agenda' → ROTEAR`);
      
      const result = await base44.asServiceRole.functions.invoke('processScheduleIntent', {
        thread_id,
        message_id,
        text: content,
        from_type: from_type || 'external_contact',
        from_id: from_id || thread.contact_id
      });
      
      return Response.json({
        success: true,
        routed: true,
        reason: 'assistant_mode',
        result: result.data
      });
    }
    
    // CONDIÇÃO 2: Integração dedicada (NEXUS_AGENDA_INTEGRATION)
    if (thread.whatsapp_integration_id) {
      const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(
        thread.whatsapp_integration_id
      );
      
      if (integration?.nome_instancia === 'NEXUS_AGENDA_INTEGRATION') {
        console.log(`[ROUTE-AGENDA] ✅ Integração dedicada → ROTEAR`);
        
        const result = await base44.asServiceRole.functions.invoke('processScheduleIntent', {
          thread_id,
          message_id,
          text: content,
          from_type: 'external_contact',
          from_id: thread.contact_id
        });
        
        return Response.json({
          success: true,
          routed: true,
          reason: 'dedicated_integration',
          result: result.data
        });
      }
    }
    
    // CONDIÇÃO 3: Contato especial AGENDA_IA_NEXUS (número virtual)
    if (thread.contact_id) {
      const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
      
      if (contact?.telefone === '+5548999142800') {
        console.log(`[ROUTE-AGENDA] ✅ Contato AGENDA_IA_NEXUS (+5548999142800) → ROTEAR`);
        
        const result = await base44.asServiceRole.functions.invoke('processScheduleIntent', {
          thread_id,
          message_id,
          text: content,
          from_type: from_type || 'internal_user',
          from_id: from_id
        });
        
        return Response.json({
          success: true,
          routed: true,
          reason: 'agenda_ia_contact',
          result: result.data
        });
      }
    }
    
    // Não roteia
    console.log(`[ROUTE-AGENDA] ⏭️ Thread normal, não rotear`);
    
    return Response.json({
      success: true,
      routed: false,
      reason: 'not_eligible'
    });
    
  } catch (error) {
    console.error('[ROUTE-AGENDA] ❌ Erro:', error.message);
    return Response.json({ 
      success: false, 
      routed: false,
      error: error.message 
    }, { status: 500 });
  }
});