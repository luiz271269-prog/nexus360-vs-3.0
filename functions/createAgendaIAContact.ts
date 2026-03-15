import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ═══════════════════════════════════════════════════════════════════════════
// 🤖 CRIAR CONTATO FIXO AGENDA_IA_NEXUS
// ═══════════════════════════════════════════════════════════════════════════
// Cria o contato especial do sistema que representa a Agenda IA
// Este contato é usado para threads internas onde usuários conversam com a IA
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    
    // Só admin pode criar contato de sistema
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem criar contatos de sistema' }, { status: 403 });
    }
    
    console.log(`[CREATE-AGENDA-CONTACT] 🚀 Criando AGENDA_IA_NEXUS...`);
    
    // Verificar se já existe (usando número real)
    const existing = await base44.asServiceRole.entities.Contact.filter({
      telefone: '+5548999142800'
    }, '-created_date', 1);
    
    if (existing && existing.length > 0) {
      console.log(`[CREATE-AGENDA-CONTACT] ℹ️ Contato já existe`);
      return Response.json({
        success: true,
        contact: existing[0],
        message: 'Contato AGENDA_IA_NEXUS já existe'
      });
    }
    
    // Criar contato especial
    const contact = await base44.asServiceRole.entities.Contact.create({
      nome: '🤖 Agenda IA Nexus',
      telefone: '+5548999142800',
      email: 'agenda@nexus360.ai',
      tipo_contato: 'parceiro',
      observacoes: 'Contato de sistema para Agenda IA. Não deletar.',
      tags: ['sistema', 'agenda_ia', 'nexus'],
      whatsapp_status: 'verificado',
      is_vip: true,
      segmento_atual: 'suporte',
      campos_personalizados: {
        is_system_contact: true,
        system_role: 'agenda_assistant',
        created_by: 'system_initialization'
      }
    });
    
    console.log(`[CREATE-AGENDA-CONTACT] ✅ Contato criado: ${contact.id}`);
    
    // Criar thread interna padrão (para que apareça na Central)
    try {
      const thread = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contact.id,
        thread_type: 'contact_external',
        assistant_mode: 'agenda',
        channel: 'interno',
        status: 'aberta',
        is_canonical: true,
        total_mensagens: 0,
        unread_count: 0
      });
      
      console.log(`[CREATE-AGENDA-CONTACT] ✅ Thread criada: ${thread.id}`);
      
      // Enviar mensagem de boas-vindas
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: contact.id,
        sender_type: 'contact',
        content: `👋 Olá! Sou a **Agenda IA Nexus**.

Posso ajudar você a gerenciar compromissos e lembretes de forma inteligente.

**Como usar:**
• "Agendar reunião amanhã às 14h com Ricardo"
• "Me lembrar de ligar para cliente em 2 horas"
• "Listar minha agenda de hoje"
• "Cancelar o compromisso das 15h"

Comandos disponíveis:
📅 **criar** - novo evento
📋 **listar** - ver próximos eventos  
❌ **cancelar** - remover evento
🔄 **remarcar** - alterar data/hora

Vamos começar?`,
        channel: 'interno',
        status: 'recebida',
        visibility: 'public_to_customer',
        sent_at: new Date().toISOString()
      });
      
      return Response.json({
        success: true,
        contact,
        thread,
        message: 'AGENDA_IA_NEXUS criado e configurado com sucesso!'
      });
      
    } catch (e) {
      console.warn(`[CREATE-AGENDA-CONTACT] ⚠️ Erro ao criar thread:`, e.message);
      return Response.json({
        success: true,
        contact,
        message: 'Contato criado, mas falha ao criar thread inicial'
      });
    }
    
  } catch (error) {
    console.error('[CREATE-AGENDA-CONTACT] ❌ Erro:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});