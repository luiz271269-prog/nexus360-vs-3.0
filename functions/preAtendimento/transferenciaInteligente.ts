import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * 🎯 TRANSFERÊNCIA INTELIGENTE DE ATENDENTE
 * 
 * Transfere automaticamente para atendente quando solicitado pelo cliente
 * 
 * Cenários:
 * 1. Cliente pergunta "qual o nome do atendente?" → Informa nome do atendente atual ou conecta novo
 * 2. Cliente pede "posso falar com a Joana?" → Busca atendente específico e transfere
 * 3. Cliente pede "quero falar com um atendente" → Conecta com melhor atendente disponível
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401, headers });
    }

    const { thread_id, nome_atendente_solicitado, solicita_qualquer_atendente } = await req.json();

    if (!thread_id) {
      return Response.json({
        error: 'thread_id é obrigatório'
      }, { status: 400, headers });
    }

    console.log('[transferenciaInteligente] 🎯 Iniciando transferência...');
    console.log('[transferenciaInteligente] Thread ID:', thread_id);
    console.log('[transferenciaInteligente] Nome solicitado:', nome_atendente_solicitado);
    console.log('[transferenciaInteligente] Solicita qualquer:', solicita_qualquer_atendente);

    // 📋 Buscar thread atual
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    
    if (!thread) {
      return Response.json({
        error: 'Thread não encontrada'
      }, { status: 404, headers });
    }

    // 📋 Buscar contato
    const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);

    // 🔍 CENÁRIO 1: Thread já tem atendente atribuído
    if (thread.assigned_user_id) {
      const atendenteAtual = await base44.asServiceRole.entities.User.get(thread.assigned_user_id);
      
      // Se cliente perguntou "qual o nome?" → Informar e manter atendente
      if (solicita_qualquer_atendente && !nome_atendente_solicitado) {
        console.log('[transferenciaInteligente] ℹ️ Cliente perguntou nome do atendente atual');
        
        return Response.json({
          success: true,
          acao: 'informar_atendente_atual',
          atendente: {
            id: atendenteAtual.id,
            nome: atendenteAtual.full_name
          },
          mensagem: `Você está sendo atendido(a) por ${atendenteAtual.full_name}. Como posso ajudar?`
        }, { headers });
      }

      // Se solicitou outro atendente específico → Tentar transferir
      if (nome_atendente_solicitado && nome_atendente_solicitado.toLowerCase() !== atendenteAtual.full_name.toLowerCase()) {
        console.log('[transferenciaInteligente] 🔄 Cliente solicitou atendente diferente do atual');
        // Continua para buscar o atendente solicitado
      } else if (nome_atendente_solicitado) {
        // Solicitou o mesmo atendente que já está atendendo
        return Response.json({
          success: true,
          acao: 'manter_atendente_atual',
          atendente: {
            id: atendenteAtual.id,
            nome: atendenteAtual.full_name
          },
          mensagem: `Você já está sendo atendido(a) por ${atendenteAtual.full_name}. Como posso ajudar?`
        }, { headers });
      }
    }

    // 🔍 CENÁRIO 2: Cliente solicitou atendente específico por nome
    if (nome_atendente_solicitado) {
      console.log('[transferenciaInteligente] 🔍 Buscando atendente:', nome_atendente_solicitado);

      // Buscar atendentes que contenham o nome
      const atendentes = await base44.asServiceRole.entities.User.filter({
        is_whatsapp_attendant: true
      }, 'full_name');

      const atendenteEncontrado = atendentes.find(a => 
        a.full_name.toLowerCase().includes(nome_atendente_solicitado.toLowerCase()) ||
        nome_atendente_solicitado.toLowerCase().includes(a.full_name.toLowerCase().split(' ')[0])
      );

      if (!atendenteEncontrado) {
        console.log('[transferenciaInteligente] ❌ Atendente não encontrado');
        return Response.json({
          success: false,
          acao: 'atendente_nao_encontrado',
          mensagem: `Desculpe, não encontrei um atendente com o nome "${nome_atendente_solicitado}". Posso conectar você com um atendente disponível?`
        }, { headers });
      }

      // Verificar disponibilidade
      if (atendenteEncontrado.availability_status === 'offline') {
        console.log('[transferenciaInteligente] ⚠️ Atendente offline');
        return Response.json({
          success: false,
          acao: 'atendente_indisponivel',
          atendente: {
            id: atendenteEncontrado.id,
            nome: atendenteEncontrado.full_name
          },
          mensagem: `${atendenteEncontrado.full_name} não está disponível no momento. Posso conectar você com outro atendente?`
        }, { headers });
      }

      // Verificar capacidade
      if (atendenteEncontrado.current_conversations_count >= atendenteEncontrado.max_concurrent_conversations) {
        console.log('[transferenciaInteligente] ⚠️ Atendente com capacidade máxima');
        return Response.json({
          success: false,
          acao: 'atendente_ocupado',
          atendente: {
            id: atendenteEncontrado.id,
            nome: atendenteEncontrado.full_name
          },
          mensagem: `${atendenteEncontrado.full_name} está ocupado(a) no momento. Posso conectar você com outro atendente?`
        }, { headers });
      }

      // ✅ Atribuir atendente solicitado
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        assigned_user_id: atendenteEncontrado.id,
        assigned_user_name: atendenteEncontrado.full_name,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      });

      // Atualizar contador do atendente
      await base44.asServiceRole.entities.User.update(atendenteEncontrado.id, {
        current_conversations_count: (atendenteEncontrado.current_conversations_count || 0) + 1
      });

      // Registrar log
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'transferencia_inteligente_sucesso',
        contato_id: thread.contact_id,
        thread_id: thread_id,
        resultado: 'sucesso',
        timestamp: new Date().toISOString(),
        detalhes: {
          mensagem: `Transferido para ${atendenteEncontrado.full_name} conforme solicitado`,
          atendente_id: atendenteEncontrado.id,
          nome_solicitado: nome_atendente_solicitado
        },
        origem: 'ia',
        prioridade: 'alta'
      });

      console.log('[transferenciaInteligente] ✅ Transferido para:', atendenteEncontrado.full_name);

      return Response.json({
        success: true,
        acao: 'transferido_sucesso',
        atendente: {
          id: atendenteEncontrado.id,
          nome: atendenteEncontrado.full_name
        },
        mensagem: `Conectando você com ${atendenteEncontrado.full_name}. Aguarde um momento...`
      }, { headers });
    }

    // 🔍 CENÁRIO 3: Cliente quer qualquer atendente disponível
    console.log('[transferenciaInteligente] 🔍 Buscando melhor atendente disponível');

    // Chamar o roteamento inteligente existente
    const roteamento = await base44.asServiceRole.functions.invoke('roteamentoInteligente', {
      thread_id: thread_id,
      contact_id: thread.contact_id,
      tipo_roteamento: 'melhor_disponivel'
    });

    if (!roteamento.data.success) {
      console.log('[transferenciaInteligente] ❌ Nenhum atendente disponível');
      return Response.json({
        success: false,
        acao: 'nenhum_atendente_disponivel',
        mensagem: 'Desculpe, não há atendentes disponíveis no momento. Por favor, aguarde ou tente novamente mais tarde.'
      }, { headers });
    }

    console.log('[transferenciaInteligente] ✅ Transferido via roteamento inteligente');

    return Response.json({
      success: true,
      acao: 'transferido_roteamento_inteligente',
      atendente: {
        id: roteamento.data.atendente_id,
        nome: roteamento.data.atendente_nome
      },
      mensagem: `Conectando você com ${roteamento.data.atendente_nome}. Aguarde um momento...`
    }, { headers });

  } catch (error) {
    console.error('[transferenciaInteligente] ❌ Erro:', error);
    return Response.json({
      error: 'Erro ao processar transferência',
      details: error.message
    }, { status: 500, headers });
  }
});