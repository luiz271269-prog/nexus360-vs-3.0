import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔍 DIAGNÓSTICO: POR QUE A MENSAGEM NÃO APARECE NA BARRA LATERAL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Analisa:
 * 1. Thread existe e tem dados corretos
 * 2. Mensagens estão salvas
 * 3. Permissões de visibilidade do usuário
 * 4. Filtros ativos bloqueando a conversa
 * ═══════════════════════════════════════════════════════════════════════════════
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    console.log(`[DIAGNÓSTICO] 👤 Analisando visibilidade para usuário: ${user.full_name} (${user.email})`);
    console.log(`[DIAGNÓSTICO] 🔐 Role: ${user.role} | Setor: ${user.attendant_sector || 'N/A'}`);

    // BUSCAR A THREAD DO LUIZ
    const threadId = '693306f0ffbdced31cc623e3'; // ID do log
    const thread = await base44.asServiceRole.entities.MessageThread.filter({ id: threadId }, '', 1);

    if (!thread.length) {
      return Response.json({
        erro: 'Thread não encontrada',
        threadId
      }, { status: 404 });
    }

    const th = thread[0];
    console.log(`[DIAGNÓSTICO] 📋 Thread encontrada: ${th.id}`);
    console.log(`[DIAGNÓSTICO] 👥 Contact ID: ${th.contact_id}`);
    console.log(`[DIAGNÓSTICO] 👤 Assigned to: ${th.assigned_user_id || 'Ninguém'}`);
    console.log(`[DIAGNÓSTICO] 🏢 Setor: ${th.sector_id || 'Sem setor'}`);
    console.log(`[DIAGNÓSTICO] 📱 Integração: ${th.whatsapp_integration_id}`);
    console.log(`[DIAGNÓSTICO] 💬 Última mensagem: ${th.last_message_at}`);
    console.log(`[DIAGNÓSTICO] 📊 Não lidas: ${th.unread_count}`);

    // BUSCAR O CONTATO
    const contact = await base44.asServiceRole.entities.Contact.filter({ id: th.contact_id }, '', 1);
    const contactData = contact[0] || {};

    console.log(`[DIAGNÓSTICO] 👁️ Contato: ${contactData.nome} | Tel: ${contactData.telefone}`);

    // BUSCAR MENSAGENS DA THREAD
    const messages = await base44.asServiceRole.entities.Message.filter({
      thread_id: threadId
    }, '-created_date', 10);

    console.log(`[DIAGNÓSTICO] 💬 Total de mensagens na thread: ${messages.length}`);

    // BUSCAR INTEGRAÇÃO
    const integration = th.whatsapp_integration_id 
      ? (await base44.asServiceRole.entities.WhatsAppIntegration.filter({ id: th.whatsapp_integration_id }, '', 1))[0]
      : null;

    console.log(`[DIAGNÓSTICO] 🔌 Integração: ${integration?.nome_instancia || 'Não encontrada'}`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // VERIFICAR PERMISSÕES DE VISIBILIDADE
    // ═══════════════════════════════════════════════════════════════════════════════

    const analiseVisibilidade = {
      thread_id: threadId,
      user_info: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        sector: user.attendant_sector || 'N/A',
        attendant_role: user.attendant_role || 'N/A'
      },

      thread_data: {
        id: th.id,
        contact_id: th.contact_id,
        assigned_user_id: th.assigned_user_id,
        sector_id: th.sector_id,
        integration_id: th.whatsapp_integration_id,
        is_group_chat: th.is_group_chat,
        last_message_at: th.last_message_at,
        unread_count: th.unread_count,
        total_mensagens: th.total_mensagens
      },

      contact_data: {
        id: contactData.id,
        nome: contactData.nome,
        telefone: contactData.telefone,
        tipo_contato: contactData.tipo_contato,
        bloqueado: contactData.bloqueado
      },

      integration_data: integration ? {
        id: integration.id,
        nome: integration.nome_instancia,
        numero: integration.numero_telefone,
        setores: integration.setores_atendidos || []
      } : null,

      messages: messages.map(m => ({
        id: m.id,
        sender: m.sender_type,
        content: m.content?.substring(0, 50),
        created: m.created_date
      })),

      permissoes: {
        assigned_to_user: th.assigned_user_id === user.id,
        is_admin: user.role === 'admin',
        same_sector: th.sector_id === user.attendant_sector,
        integration_visible: true // Simplificado, deveria checar WhatsAppIntegration.setores_atendidos
      },

      razoes_visibilidade: []
    };

    // Análise de por que poderia não aparecer
    if (th.bloqueado) {
      analiseVisibilidade.razoes_visibilidade.push('❌ THREAD BLOQUEADA');
    }

    if (contactData.bloqueado) {
      analiseVisibilidade.razoes_visibilidade.push('❌ CONTATO BLOQUEADO');
    }

    if (!th.assigned_user_id && user.role !== 'admin') {
      analiseVisibilidade.razoes_visibilidade.push('⚠️ Thread não atribuída - precisa ser admin ou ter permissão de "não atribuídas"');
    }

    if (th.sector_id && th.sector_id !== user.attendant_sector && user.role !== 'admin') {
      analiseVisibilidade.razoes_visibilidade.push(`⚠️ Setor da thread (${th.sector_id}) diferente do usuário (${user.attendant_sector})`);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VERIFICAR SE OS DADOS ESTÃO CONSISTENTES
    // ═══════════════════════════════════════════════════════════════════════════════

    const consistencia = {
      thread_tem_last_message_at: !!th.last_message_at,
      thread_tem_unread_count: th.unread_count >= 0,
      messages_existem: messages.length > 0,
      ultima_message_recente: messages.length > 0 && new Date(messages[0].created_date) > new Date(Date.now() - 60000), // Últimos 60s
      last_inbound_at: th.last_inbound_at,
      contato_existe: !!contactData.id,
      integracao_existe: !!integration
    };

    if (!consistencia.thread_tem_last_message_at) {
      analiseVisibilidade.razoes_visibilidade.push('❌ Thread SEM last_message_at - pode não aparecer na lista');
    }

    if (!consistencia.messages_existem) {
      analiseVisibilidade.razoes_visibilidade.push('❌ Nenhuma mensagem encontrada na thread');
    }

    if (!consistencia.contato_existe) {
      analiseVisibilidade.razoes_visibilidade.push('❌ Contato não encontrado');
    }

    analiseVisibilidade.consistencia = consistencia;

    // ═══════════════════════════════════════════════════════════════════════════════
    // RESPOSTA FINAL
    // ═══════════════════════════════════════════════════════════════════════════════

    if (analiseVisibilidade.razoes_visibilidade.length === 0) {
      analiseVisibilidade.conclusao = '✅ THREAD DEVERIA ESTAR VISÍVEL - verificar filtros ativos na UI';
    } else {
      analiseVisibilidade.conclusao = '❌ PROBLEMAS ENCONTRADOS - veja razoes_visibilidade';
    }

    console.log('[DIAGNÓSTICO] ✅ Análise concluída');

    return Response.json(analiseVisibilidade, { status: 200 });

  } catch (error) {
    console.error('[DIAGNÓSTICO] ❌ Erro:', error.message);
    return Response.json({ 
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
});