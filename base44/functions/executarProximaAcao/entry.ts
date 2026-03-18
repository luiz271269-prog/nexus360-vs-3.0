/**
 * ═══════════════════════════════════════════════════════════
 * NEXUS ACTION ENGINE - VendaPro
 * ═══════════════════════════════════════════════════════════
 * 
 * Motor de execução autônoma de ações inteligentes.
 * 
 * Recebe uma ação sugerida pela IA e a executa automaticamente,
 * fechando o loop de inteligência → ação → feedback.
 * 
 * Ações Suportadas:
 * - enviar_proposta: Cria orçamento e envia para o cliente
 * - agendar_reuniao: Cria tarefa de agendamento
 * - enviar_catalogo: Envia mensagem com catálogo
 * - responder_objecao: Gera resposta IA para objeção
 * - follow_up_suave: Envia mensagem de acompanhamento
 * - escalar_gerente: Notifica gerente e atualiza prioridade
 */

import { createClient } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const { thread_id, next_action, score, context } = await req.json();
    
    console.log(`[NEXUS ACTION] 🚀 Executando ação: ${next_action} para thread ${thread_id}`);
    
    const startTime = Date.now();
    
    // Inicializar Base44
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      Deno.env.get('BASE44_API_KEY')
    );
    
    // Buscar dados necessários
    const thread = await base44.entities.MessageThread.get(thread_id);
    const contact = await base44.entities.Contact.get(thread.contact_id);
    
    let resultado;
    
    // Roteamento da ação
    switch (next_action) {
      case 'enviar_proposta':
        resultado = await acaoEnviarProposta(base44, thread, contact, score);
        break;
      
      case 'agendar_reuniao':
        resultado = await acaoAgendarReuniao(base44, thread, contact, score);
        break;
      
      case 'enviar_catalogo':
        resultado = await acaoEnviarCatalogo(base44, thread, contact);
        break;
      
      case 'responder_objecao':
        resultado = await acaoResponderObjecao(base44, thread, contact, context);
        break;
      
      case 'follow_up_suave':
        resultado = await acaoFollowUpSuave(base44, thread, contact);
        break;
      
      case 'escalar_gerente':
        resultado = await acaoEscalarGerente(base44, thread, contact, score);
        break;
      
      case 'aguardar_interacao':
        resultado = {
          success: true,
          action_executed: 'aguardar_interacao',
          message: 'Nenhuma ação necessária no momento, aguardando cliente'
        };
        break;
      
      default:
        throw new Error(`Ação desconhecida: ${next_action}`);
    }
    
    // Registrar execução
    const duracao = Date.now() - startTime;
    
    await base44.entities.AutomationLog.create({
      acao: `nexus_action_${next_action}`,
      thread_id,
      contact_id: contact.id,
      resultado: resultado.success ? 'sucesso' : 'erro',
      timestamp: new Date().toISOString(),
      origem: 'ia',
      prioridade: score >= 80 ? 'alta' : 'normal',
      detalhes: {
        next_action,
        score,
        action_result: resultado,
        tempo_execucao_ms: duracao
      }
    });
    
    console.log(`[NEXUS ACTION] ✅ Ação executada em ${duracao}ms`);
    
    return Response.json({
      success: true,
      action: next_action,
      result: resultado,
      duracao_ms: duracao
    });
    
  } catch (error) {
    console.error('[NEXUS ACTION] ❌ Erro:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

/**
 * ═══════════════════════════════════════════════════════════
 * IMPLEMENTAÇÃO DAS AÇÕES
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Envia proposta / orçamento para o cliente
 */
async function acaoEnviarProposta(base44, thread, contact, score) {
  console.log('[NEXUS ACTION] 📄 Preparando envio de proposta...');
  
  try {
    // Buscar cliente associado
    let cliente = null;
    if (contact.cliente_id) {
      cliente = await base44.entities.Cliente.get(contact.cliente_id);
    } else {
      // Se não tem cliente, criar um novo
      cliente = await base44.entities.Cliente.create({
        razao_social: contact.empresa || contact.nome,
        nome_fantasia: contact.empresa || contact.nome,
        telefone: contact.telefone,
        email: contact.email,
        status: 'Lead Qualificado',
        vendedor_responsavel: contact.vendedor_responsavel || 'IA Nexus',
        origem_campanha: {
          canal_entrada: 'whatsapp',
          data_primeira_interacao: new Date().toISOString()
        }
      });
      
      // Atualizar contact com cliente_id
      await base44.entities.Contact.update(contact.id, {
        cliente_id: cliente.id,
        tipo_contato: 'cliente'
      });
    }
    
    // Criar tarefa para vendedor preparar proposta
    const tarefa = await base44.entities.TarefaInteligente.create({
      titulo: `🔥 Enviar Proposta: ${contact.nome}`,
      descricao: `Cliente com score ${score}/100 solicitou proposta.\n\nÚltima interação indica alto interesse.`,
      tipo_tarefa: 'envio_proposta',
      prioridade: score >= 80 ? 'critica' : 'alta',
      cliente_id: cliente.id,
      cliente_nome: cliente.razao_social,
      vendedor_responsavel: contact.vendedor_responsavel || 'Não atribuído',
      data_prazo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      status: 'pendente',
      contexto_ia: {
        motivo_criacao: 'Cliente demonstrou interesse em receber proposta',
        score_propensao: score,
        thread_id: thread.id,
        contact_id: contact.id
      }
    });
    
    // Enviar mensagem automática confirmando
    const mensagemConfirmacao = `Olá ${contact.nome}! 👋

Recebi sua solicitação e nossa equipe já está preparando uma proposta personalizada para você.

Em breve um de nossos consultores entrará em contato com todos os detalhes.

Enquanto isso, se tiver qualquer dúvida, estou à disposição!`;
    
    await base44.functions.invoke('enviarWhatsApp', {
      integration_id: thread.whatsapp_integration_id,
      numero_destino: contact.telefone,
      mensagem: mensagemConfirmacao
    });
    
    return {
      success: true,
      action_executed: 'enviar_proposta',
      cliente_id: cliente.id,
      tarefa_id: tarefa.id,
      message: 'Proposta em preparação, tarefa criada para vendedor'
    };
    
  } catch (error) {
    console.error('[NEXUS ACTION] Erro ao enviar proposta:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Agenda reunião com o cliente
 */
async function acaoAgendarReuniao(base44, thread, contact, score) {
  console.log('[NEXUS ACTION] 📅 Agendando reunião...');
  
  try {
    // Criar tarefa de agendamento
    const tarefa = await base44.entities.TarefaInteligente.create({
      titulo: `📞 Agendar Reunião: ${contact.nome}`,
      descricao: `Cliente solicitou reunião para discutir detalhes.\n\nScore: ${score}/100`,
      tipo_tarefa: 'reuniao_fechamento',
      prioridade: score >= 70 ? 'alta' : 'media',
      cliente_id: contact.cliente_id,
      cliente_nome: contact.nome,
      vendedor_responsavel: contact.vendedor_responsavel || 'Não atribuído',
      data_prazo: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12h
      status: 'pendente',
      contexto_ia: {
        motivo_criacao: 'Cliente solicitou reunião',
        score_propensao: score,
        thread_id: thread.id
      }
    });
    
    // Enviar mensagem sugerindo horários
    const mensagem = `Olá ${contact.nome}! 😊

Ótimo! Vamos agendar uma reunião para conversar melhor.

Você prefere:
- 📅 Amanhã pela manhã (09h-12h)?
- 📅 Amanhã à tarde (14h-17h)?
- 📅 Outro horário?

É só me avisar e já bloqueio na agenda! 👍`;
    
    await base44.functions.invoke('enviarWhatsApp', {
      integration_id: thread.whatsapp_integration_id,
      numero_destino: contact.telefone,
      mensagem
    });
    
    return {
      success: true,
      action_executed: 'agendar_reuniao',
      tarefa_id: tarefa.id,
      message: 'Mensagem de agendamento enviada'
    };
    
  } catch (error) {
    console.error('[NEXUS ACTION] Erro ao agendar reunião:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envia catálogo de produtos
 */
async function acaoEnviarCatalogo(base44, thread, contact) {
  console.log('[NEXUS ACTION] 📦 Enviando catálogo...');
  
  try {
    const mensagem = `Olá ${contact.nome}! 👋

Aqui está nosso catálogo atualizado de produtos e serviços:

🔹 **Categoria A:** [Descrição breve]
🔹 **Categoria B:** [Descrição breve]
🔹 **Categoria C:** [Descrição breve]

Para mais detalhes e condições especiais, é só me avisar!

Qual categoria te interessa mais? 🤔`;
    
    await base44.functions.invoke('enviarWhatsApp', {
      integration_id: thread.whatsapp_integration_id,
      numero_destino: contact.telefone,
      mensagem
    });
    
    return {
      success: true,
      action_executed: 'enviar_catalogo',
      message: 'Catálogo enviado'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Responde objeção do cliente com IA
 */
async function acaoResponderObjecao(base44, thread, contact, context) {
  console.log('[NEXUS ACTION] 💬 Respondendo objeção...');
  
  try {
    // Buscar última mensagem do cliente
    const mensagens = await base44.entities.Message.filter(
      { thread_id: thread.id, sender_type: 'contact' },
      '-created_date',
      1
    );
    
    const ultimaMensagem = mensagens[0]?.content || '';
    
    // Gerar resposta com IA
    const resposta = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um consultor de vendas experiente.

Cliente disse: "${ultimaMensagem}"

Gere uma resposta profissional, empática e que resolva a objeção.
Seja conciso (máx 3 parágrafos).`
    });
    
    await base44.functions.invoke('enviarWhatsApp', {
      integration_id: thread.whatsapp_integration_id,
      numero_destino: contact.telefone,
      mensagem: resposta
    });
    
    return {
      success: true,
      action_executed: 'responder_objecao',
      resposta_enviada: resposta.substring(0, 100) + '...'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Envia follow-up suave
 */
async function acaoFollowUpSuave(base44, thread, contact) {
  console.log('[NEXUS ACTION] 👋 Enviando follow-up...');
  
  try {
    const mensagem = `Oi ${contact.nome}! 😊

Vi que conversamos recentemente e queria saber se ficou alguma dúvida.

Estou por aqui se precisar de qualquer informação! 👍`;
    
    await base44.functions.invoke('enviarWhatsApp', {
      integration_id: thread.whatsapp_integration_id,
      numero_destino: contact.telefone,
      mensagem
    });
    
    return {
      success: true,
      action_executed: 'follow_up_suave',
      message: 'Follow-up enviado'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Escala para gerente
 */
async function acaoEscalarGerente(base44, thread, contact, score) {
  console.log('[NEXUS ACTION] ⬆️ Escalando para gerente...');
  
  try {
    // Atualizar thread
    await base44.entities.MessageThread.update(thread.id, {
      prioridade: 'urgente',
      status: 'aguardando_cliente',
      tags: [...(thread.tags || []), 'escalado_gerente']
    });
    
    // Criar tarefa para gerente
    const tarefa = await base44.entities.TarefaInteligente.create({
      titulo: `🔥 URGENTE: Negociação Complexa - ${contact.nome}`,
      descricao: `Cliente com score ${score}/100 requer atenção de gerente.\n\nNegociação envolve condições especiais ou valores altos.`,
      tipo_tarefa: 'reuniao_fechamento',
      prioridade: 'critica',
      cliente_id: contact.cliente_id,
      cliente_nome: contact.nome,
      vendedor_responsavel: 'Gerente de Vendas',
      data_prazo: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h
      status: 'pendente',
      contexto_ia: {
        motivo_criacao: 'Negociação escalada pela IA',
        score_propensao: score,
        thread_id: thread.id
      }
    });
    
    return {
      success: true,
      action_executed: 'escalar_gerente',
      tarefa_id: tarefa.id,
      message: 'Escalado para gerente'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}