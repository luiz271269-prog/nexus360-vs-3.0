import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  PLAYBOOK ENGINE V4 - Motor de Execução com Recorrência      ║
 * ║  + Lógica de Follow-up (24h → 3d → 7d → 15d)                 ║
 * ║  + Cálculo inteligente de next_action_at                     ║
 * ║  + Transição automática para atendimento orgânico            ║
 * ╚═══════════════════════════════════════════════════════════════╝
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
    const payload = await req.json();
    const { action, execution_id, contact_id, flow_template_id, user_response } = payload;

    console.log('[PLAYBOOK ENGINE] 🎬 Action:', action);

    switch (action) {
      case 'start':
        return Response.json(await iniciarExecucao(base44, contact_id, flow_template_id), { headers });
      
      case 'process_response':
        return Response.json(await processarResposta(base44, execution_id, user_response), { headers });
      
      case 'continue_follow_up':
        return Response.json(await continuarFollowUp(base44, execution_id), { headers });
      
      case 'cancel':
        return Response.json(await cancelarExecucao(base44, execution_id), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[PLAYBOOK ENGINE] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

async function iniciarExecucao(base44, contact_id, flow_template_id) {
  console.log('[PLAYBOOK ENGINE] 🚀 Iniciando execução...');

  const [template, contact] = await Promise.all([
    base44.asServiceRole.entities.FlowTemplate.get(flow_template_id),
    base44.asServiceRole.entities.Contact.get(contact_id)
  ]);

  if (!template) throw new Error('Template não encontrado');
  if (!template.ativo) throw new Error('Template inativo');
  if (!contact) throw new Error('Contato não encontrado');

  // Buscar thread existente ou criar nova
  let thread = await buscarOuCriarThread(base44, contact_id);

  // Criar execução
  const execution = await base44.asServiceRole.entities.FlowExecution.create({
    flow_template_id,
    contact_id,
    thread_id: thread.id,
    whatsapp_integration_id: thread.whatsapp_integration_id,
    status: 'ativo',
    current_step: 0,
    follow_up_stage_index: 0,
    started_at: new Date().toISOString(),
    variables: template.default_variables || {},
    client_score_at_start: contact.cliente_score || 0,
    client_score_current: contact.cliente_score || 0
  });

  // Executar primeiro step
  const resultado = await executarStep(base44, execution, template, 0);

  return {
    success: true,
    execution_id: execution.id,
    ...resultado
  };
}

async function continuarFollowUp(base44, execution_id) {
  console.log('[PLAYBOOK ENGINE] 🔄 Continuando follow-up:', execution_id);

  const execution = await base44.asServiceRole.entities.FlowExecution.get(execution_id);
  
  if (!execution) throw new Error('Execução não encontrada');
  if (execution.status !== 'waiting_follow_up' && execution.status !== 'ativo') {
    throw new Error('Execução não está aguardando follow-up');
  }

  const template = await base44.asServiceRole.entities.FlowTemplate.get(execution.flow_template_id);
  const nextStepIndex = execution.current_step + 1;

  if (nextStepIndex >= template.steps.length) {
    // Fim do ciclo de follow-up
    return await finalizarCicloFollowUp(base44, execution, template);
  }

  // Executar próximo step do follow-up
  await base44.asServiceRole.entities.FlowExecution.update(execution_id, {
    current_step: nextStepIndex,
    follow_up_stage_index: execution.follow_up_stage_index + 1,
    last_follow_up_action_at: new Date().toISOString(),
    status: 'ativo',
    execution_history: [
      ...(execution.execution_history || []),
      {
        step_index: execution.current_step,
        action: 'follow_up_continued',
        timestamp: new Date().toISOString(),
        result: 'success'
      }
    ]
  });

  execution.current_step = nextStepIndex;
  execution.follow_up_stage_index = execution.follow_up_stage_index + 1;
  execution.status = 'ativo';

  return await executarStep(base44, execution, template, nextStepIndex);
}

async function executarStep(base44, execution, template, stepIndex) {
  const step = template.steps[stepIndex];
  
  console.log('[PLAYBOOK ENGINE] 📍 Executando step:', stepIndex, '-', step.type);

  try {
    switch (step.type) {
      case 'message':
        return await executarMessage(base44, execution, template, step, stepIndex);

      case 'input':
        return {
          success: true,
          action: 'wait_input',
          mensagem: interpolarVariaveis(step.texto, execution.variables),
          campo: step.campo,
          opcoes: step.opcoes
        };

      case 'ia_classify':
        return await executarIAClassify(base44, execution, step, stepIndex);

      case 'action':
        return await executarAction(base44, execution, step, stepIndex);

      case 'delay':
        return await executarDelay(base44, execution, step, stepIndex);

      case 'end':
        return await finalizarExecucao(base44, execution, step);

      default:
        throw new Error(`Tipo de step desconhecido: ${step.type}`);
    }
  } catch (error) {
    console.error('[PLAYBOOK ENGINE] ❌ Erro no step:', error);
    
    // Registrar erro
    await registrarErro(base44, execution, stepIndex, error);
    
    // Verificar se deve escalonar para humano
    if (step.require_human_on_fail) {
      return await escalonarParaHumano(base44, execution, `Erro no step ${stepIndex}: ${error.message}`);
    }
    
    throw error;
  }
}

async function executarMessage(base44, execution, template, step, stepIndex) {
  console.log('[PLAYBOOK ENGINE] 💬 Executando mensagem');

  const contact = await base44.asServiceRole.entities.Contact.get(execution.contact_id);
  const mensagem = interpolarVariaveis(step.texto, execution.variables);

  // Enviar mensagem via WhatsApp
  const resultado = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
    integration_id: execution.whatsapp_integration_id,
    numero_destino: contact.telefone,
    mensagem: mensagem,
    template_name: step.message_template_name
  });

  if (!resultado.data.success) {
    throw new Error(resultado.data.error || 'Falha ao enviar mensagem');
  }

  // Registrar mensagem na thread
  await base44.asServiceRole.entities.Message.create({
    thread_id: execution.thread_id,
    sender_id: 'system',
    sender_type: 'user',
    recipient_id: execution.contact_id,
    recipient_type: 'contact',
    content: mensagem,
    channel: 'whatsapp',
    status: 'enviada',
    whatsapp_message_id: resultado.data.message_id,
    sent_at: new Date().toISOString(),
    metadata: {
      playbook_id: template.id,
      playbook_nome: template.nome,
      step_index: stepIndex
    }
  });

  // Calcular next_action_at se houver delay_days
  if (step.delay_days) {
    const nextActionDate = new Date();
    nextActionDate.setDate(nextActionDate.getDate() + step.delay_days);

    await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
      status: 'waiting_follow_up',
      next_action_at: nextActionDate.toISOString(),
      last_follow_up_action_at: new Date().toISOString(),
      execution_history: [
        ...(execution.execution_history || []),
        {
          step_index: stepIndex,
          action: 'message_sent',
          timestamp: new Date().toISOString(),
          result: 'success',
          details: {
            delay_days: step.delay_days,
            next_action_at: nextActionDate.toISOString()
          }
        }
      ]
    });

    return {
      success: true,
      action: 'waiting_follow_up',
      mensagem: 'Mensagem enviada. Aguardando próximo follow-up.',
      next_action_at: nextActionDate.toISOString(),
      delay_days: step.delay_days
    };
  }

  // Se não houver delay, avançar para próximo step
  const nextStepIndex = stepIndex + 1;
  
  if (nextStepIndex >= template.steps.length) {
    return await finalizarExecucao(base44, execution, step);
  }

  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    current_step: nextStepIndex
  });

  execution.current_step = nextStepIndex;

  return {
    success: true,
    action: 'continue',
    mensagem: 'Mensagem enviada. Continuando fluxo...',
    auto_advance: true
  };
}

async function executarIAClassify(base44, execution, step, stepIndex) {
  console.log('[PLAYBOOK ENGINE] 🤖 Executando IA Classify...');

  // Buscar última mensagem do usuário
  const mensagens = await base44.asServiceRole.entities.Message.filter(
    { thread_id: execution.thread_id, sender_type: 'contact' },
    '-created_date',
    1
  );

  const ultimaMensagem = mensagens[0]?.content || '';

  // Chamar nexusClassifier
  const classificacao = await base44.asServiceRole.functions.invoke('nexusClassifier', {
    action: 'classify_intention',
    mensagem: ultimaMensagem,
    contexto: {
      contact_id: execution.contact_id,
      variables: execution.variables
    }
  });

  const result = classificacao.data;

  // Armazenar resultado
  execution.variables['ia_intent'] = result.intent;
  execution.variables['ia_confidence'] = result.confidence;
  execution.variables['ia_sentiment'] = result.sentiment || 'neutro';

  // Atualizar score do cliente baseado no sentimento
  if (result.sentiment) {
    await atualizarScoreCliente(base44, execution, result.sentiment);
  }

  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    variables: execution.variables,
    positive_responses: result.sentiment === 'positivo' || result.sentiment === 'muito_positivo'
      ? execution.positive_responses + 1
      : execution.positive_responses
  });

  return {
    success: true,
    action: 'continue',
    classificacao: result,
    auto_advance: true
  };
}

async function executarAction(base44, execution, step, stepIndex) {
  console.log('[PLAYBOOK ENGINE] ⚙️ Executando action:', step.acao);

  const parametros = (step.parametros || []).map(p => 
    execution.variables[p] || p
  );

  let resultado;

  switch (step.acao) {
    case 'criarLead':
      resultado = await acaoCriarLead(base44, execution, parametros);
      break;
    
    case 'agendarFollowUp':
      resultado = await acaoAgendarFollowUp(base44, execution, parametros);
      break;
    
    case 'enviarOrcamento':
      resultado = await acaoEnviarOrcamento(base44, execution, parametros);
      break;
    
    case 'atribuirVendedor':
      resultado = await acaoAtribuirVendedor(base44, execution, parametros);
      break;
    
    default:
      throw new Error(`Ação desconhecida: ${step.acao}`);
  }

  execution.variables[`action_${step.acao}_result`] = resultado;

  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    variables: execution.variables,
    execution_history: [
      ...(execution.execution_history || []),
      {
        step_index: stepIndex,
        action: step.acao,
        timestamp: new Date().toISOString(),
        result: 'success',
        details: resultado
      }
    ]
  });

  return {
    success: true,
    action: 'continue',
    mensagem: resultado.mensagem || 'Ação executada com sucesso',
    resultado,
    auto_advance: true
  };
}

async function executarDelay(base44, execution, step, stepIndex) {
  const dias = step.delay_days || 0;
  const segundos = step.delay_seconds || 0;

  const proximaExecucao = new Date();
  if (dias > 0) {
    proximaExecucao.setDate(proximaExecucao.getDate() + dias);
  }
  if (segundos > 0) {
    proximaExecucao.setSeconds(proximaExecucao.getSeconds() + segundos);
  }

  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    status: 'waiting_follow_up',
    next_action_at: proximaExecucao.toISOString(),
    execution_history: [
      ...(execution.execution_history || []),
      {
        step_index: stepIndex,
        action: 'delay',
        timestamp: new Date().toISOString(),
        result: 'paused',
        details: {
          delay_days: dias,
          delay_seconds: segundos,
          next_action_at: proximaExecucao.toISOString()
        }
      }
    ]
  });

  return {
    success: true,
    action: 'delayed',
    mensagem: `Aguardando ${dias > 0 ? dias + ' dias' : segundos + ' segundos'}...`,
    next_action_at: proximaExecucao.toISOString()
  };
}

async function finalizarCicloFollowUp(base44, execution, template) {
  console.log('[PLAYBOOK ENGINE] 🏁 Finalizando ciclo de follow-up');

  // Verificar se houve engajamento positivo
  const taxaEngajamento = execution.response_count > 0
    ? (execution.positive_responses / execution.response_count) * 100
    : 0;

  if (taxaEngajamento < 30 && template.auto_escalate_to_human) {
    // Baixo engajamento - escalonar para humano
    return await escalonarParaHumano(
      base44,
      execution,
      `Ciclo de follow-up concluído com baixo engajamento (${taxaEngajamento.toFixed(0)}%)`
    );
  }

  // Finalizar execução
  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    status: 'concluido',
    completed_at: new Date().toISOString()
  });

  // Registrar log de automação
  await base44.asServiceRole.entities.AutomationLog.create({
    acao: 'follow_up_automatico',
    contato_id: execution.contact_id,
    thread_id: execution.thread_id,
    resultado: 'sucesso',
    timestamp: new Date().toISOString(),
    detalhes: {
      mensagem: 'Ciclo de follow-up concluído',
      total_steps: template.steps.length,
      taxa_engajamento: taxaEngajamento,
      respostas_positivas: execution.positive_responses
    },
    origem: 'sistema'
  });

  return {
    success: true,
    action: 'completed',
    mensagem: 'Ciclo de follow-up concluído!',
    metricas: {
      taxa_engajamento: taxaEngajamento,
      respostas_positivas: execution.positive_responses,
      total_respostas: execution.response_count
    }
  };
}

async function finalizarExecucao(base44, execution, step) {
  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    status: 'concluido',
    completed_at: new Date().toISOString()
  });

  return {
    success: true,
    action: 'completed',
    mensagem: step.texto || 'Fluxo concluído!'
  };
}

async function escalonarParaHumano(base44, execution, motivo) {
  console.log('[PLAYBOOK ENGINE] 👤 Escalonando para humano:', motivo);

  // Atualizar execução
  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    status: 'escalado_humano',
    escalation_reason: motivo,
    completed_at: new Date().toISOString()
  });

  // Criar notificação para administradores
  const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, 'full_name', 5);
  
  for (const admin of admins) {
    await base44.asServiceRole.entities.NotificationEvent.create({
      tipo: 'escalacao',
      titulo: '👤 Atendimento humano necessário',
      mensagem: motivo,
      prioridade: 'alta',
      usuario_id: admin.id,
      usuario_nome: admin.full_name,
      entidade_relacionada: 'FlowExecution',
      entidade_id: execution.id,
      metadata: {
        contact_id: execution.contact_id,
        thread_id: execution.thread_id
      }
    });
  }

  // Atualizar thread
  await base44.asServiceRole.entities.MessageThread.update(execution.thread_id, {
    status: 'aberta',
    prioridade: 'alta'
  });

  // Log de automação
  await base44.asServiceRole.entities.AutomationLog.create({
    acao: 'escalacao_gerente',
    contato_id: execution.contact_id,
    thread_id: execution.thread_id,
    resultado: 'sucesso',
    timestamp: new Date().toISOString(),
    detalhes: {
      mensagem: motivo,
      playbook_id: execution.flow_template_id
    },
    origem: 'ia'
  });

  return {
    success: true,
    action: 'escalated_to_human',
    mensagem: 'Conversa escalada para atendimento humano',
    motivo
  };
}

async function processarResposta(base44, execution_id, user_response) {
  const execution = await base44.asServiceRole.entities.FlowExecution.get(execution_id);
  
  if (!execution) throw new Error('Execução não encontrada');
  if (execution.status !== 'ativo') throw new Error('Execução não está ativa');

  const template = await base44.asServiceRole.entities.FlowTemplate.get(execution.flow_template_id);
  const currentStep = template.steps[execution.current_step];

  // Atualizar contador de respostas
  execution.response_count = (execution.response_count || 0) + 1;

  // Processar resposta do usuário
  if (currentStep.type === 'input') {
    const validacao = validarInput(user_response, currentStep);
    
    if (!validacao.valido) {
      // Incrementar tentativas
      const campo = currentStep.campo;
      const tentativasKey = `${campo}_tentativas`;
      const tentativas = (execution.variables[tentativasKey] || 0) + 1;
      
      if (tentativas >= (template.max_tentativas || 3)) {
        // Cancelar execução ou escalonar
        if (currentStep.require_human_on_fail) {
          return await escalonarParaHumano(
            base44,
            execution,
            `Máximo de tentativas atingido para ${campo}`
          );
        }
        
        await base44.asServiceRole.entities.FlowExecution.update(execution_id, {
          status: 'cancelado',
          execution_history: [
            ...(execution.execution_history || []),
            {
              step_index: execution.current_step,
              action: 'input_invalido_max',
              timestamp: new Date().toISOString(),
              details: `Máximo de tentativas atingido para ${campo}`
            }
          ]
        });

        return {
          success: false,
          action: 'cancelado',
          mensagem: 'Desculpe, não consegui entender sua resposta. Vamos encerrar por aqui.'
        };
      }

      // Atualizar tentativas
      await base44.asServiceRole.entities.FlowExecution.update(execution_id, {
        variables: {
          ...execution.variables,
          [tentativasKey]: tentativas
        },
        response_count: execution.response_count
      });

      return {
        success: false,
        action: 'retry',
        mensagem: validacao.mensagem || currentStep.mensagem_erro || 'Resposta inválida. Tente novamente.'
      };
    }

    // Armazenar valor válido
    execution.variables[currentStep.campo] = user_response;
  }

  // Avançar para próximo step
  const nextStepIndex = execution.current_step + 1;
  
  if (nextStepIndex >= template.steps.length) {
    return await finalizarExecucao(base44, execution, currentStep);
  }

  await base44.asServiceRole.entities.FlowExecution.update(execution_id, {
    current_step: nextStepIndex,
    variables: execution.variables,
    response_count: execution.response_count,
    execution_history: [
      ...(execution.execution_history || []),
      {
        step_index: execution.current_step,
        action: currentStep.type,
        timestamp: new Date().toISOString(),
        user_input: user_response,
        result: 'success'
      }
    ]
  });

  execution.current_step = nextStepIndex;

  return await executarStep(base44, execution, template, nextStepIndex);
}

async function cancelarExecucao(base44, execution_id) {
  await base44.asServiceRole.entities.FlowExecution.update(execution_id, {
    status: 'cancelado',
    completed_at: new Date().toISOString()
  });

  return {
    success: true,
    mensagem: 'Execução cancelada'
  };
}

// ═══════════════════════════════════════════════════════════════
// AÇÕES REAIS
// ═══════════════════════════════════════════════════════════════

async function acaoCriarLead(base44, execution, parametros) {
  const contact = await base44.asServiceRole.entities.Contact.get(execution.contact_id);
  
  const clienteData = {
    razao_social: contact.empresa || contact.nome,
    telefone: contact.telefone,
    email: contact.email,
    status: 'Lead Qualificado',
    segmento: 'PME',
    vendedor_responsavel: contact.vendedor_responsavel || 'Sistema',
    origem_campanha: {
      canal_entrada: 'whatsapp',
      data_primeira_interacao: new Date().toISOString()
    }
  };

  const cliente = await base44.asServiceRole.entities.Cliente.create(clienteData);

  // Atualizar contact com cliente_id
  await base44.asServiceRole.entities.Contact.update(contact.id, {
    cliente_id: cliente.id,
    tipo_contato: 'cliente'
  });

  return {
    sucesso: true,
    cliente_id: cliente.id,
    mensagem: 'Lead criado com sucesso!'
  };
}

async function acaoAgendarFollowUp(base44, execution, parametros) {
  const [dias] = parametros;
  const diasNum = parseInt(dias) || 3;

  const dataFollowUp = new Date();
  dataFollowUp.setDate(dataFollowUp.getDate() + diasNum);

  const contact = await base44.asServiceRole.entities.Contact.get(execution.contact_id);

  const tarefa = await base44.asServiceRole.entities.TarefaInteligente.create({
    titulo: `Follow-up: ${contact.nome}`,
    descricao: `Follow-up agendado automaticamente pelo playbook`,
    tipo_tarefa: 'follow_up_orcamento',
    prioridade: 'media',
    cliente_id: execution.variables.cliente_id,
    cliente_nome: contact.nome,
    vendedor_responsavel: contact.vendedor_responsavel || 'Sistema',
    data_prazo: dataFollowUp.toISOString(),
    status: 'pendente'
  });

  return {
    sucesso: true,
    tarefa_id: tarefa.id,
    mensagem: `Follow-up agendado para daqui a ${diasNum} dias`
  };
}

async function acaoEnviarOrcamento(base44, execution, parametros) {
  const contact = await base44.asServiceRole.entities.Contact.get(execution.contact_id);

  const orcamento = await base44.asServiceRole.entities.Orcamento.create({
    cliente_nome: contact.empresa || contact.nome,
    cliente_telefone: contact.telefone,
    cliente_email: contact.email,
    vendedor: contact.vendedor_responsavel || 'Sistema Automático',
    data_orcamento: new Date().toISOString().slice(0, 10),
    valor_total: 0,
    status: 'rascunho',
    observacoes: 'Criado automaticamente via playbook'
  });

  return {
    sucesso: true,
    orcamento_id: orcamento.id,
    mensagem: 'Orçamento criado! Em breve você receberá mais detalhes.'
  };
}

async function acaoAtribuirVendedor(base44, execution, parametros) {
  const [vendedorNome] = parametros;
  
  const vendedores = await base44.asServiceRole.entities.Vendedor.list();
  const vendedor = vendedores.find(v => v.nome === vendedorNome) || vendedores[0];

  if (execution.variables.cliente_id) {
    await base44.asServiceRole.entities.Cliente.update(execution.variables.cliente_id, {
      vendedor_responsavel: vendedor.nome,
      vendedor_id: vendedor.id
    });
  }

  // Atualizar contact
  await base44.asServiceRole.entities.Contact.update(execution.contact_id, {
    vendedor_responsavel: vendedor.nome
  });

  return {
    sucesso: true,
    vendedor_nome: vendedor.nome,
    mensagem: `Atribuído ao vendedor ${vendedor.nome}`
  };
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════

async function buscarOuCriarThread(base44, contact_id) {
  // Buscar thread existente
  const threads = await base44.asServiceRole.entities.MessageThread.filter(
    { contact_id },
    '-created_date',
    1
  );

  if (threads.length > 0) {
    return threads[0];
  }

  // Criar nova thread
  const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
  
  if (integracoes.length === 0) {
    throw new Error('Nenhuma integração WhatsApp ativa');
  }

  const thread = await base44.asServiceRole.entities.MessageThread.create({
    contact_id,
    whatsapp_integration_id: integracoes[0].id,
    status: 'aberta',
    last_message_content: 'Conversa iniciada por playbook',
    last_message_at: new Date().toISOString(),
    unread_count: 0
  });

  return thread;
}

async function atualizarScoreCliente(base44, execution, sentiment) {
  let ajuste = 0;
  
  switch (sentiment) {
    case 'muito_positivo':
      ajuste = 10;
      break;
    case 'positivo':
      ajuste = 5;
      break;
    case 'negativo':
      ajuste = -5;
      break;
    case 'muito_negativo':
      ajuste = -10;
      break;
  }

  const novoScore = Math.max(0, Math.min(100, execution.client_score_current + ajuste));

  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    client_score_current: novoScore
  });

  await base44.asServiceRole.entities.Contact.update(execution.contact_id, {
    cliente_score: novoScore
  });
}

async function registrarErro(base44, execution, stepIndex, error) {
  await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
    execution_history: [
      ...(execution.execution_history || []),
      {
        step_index: stepIndex,
        action: 'error',
        timestamp: new Date().toISOString(),
        result: 'failed',
        details: {
          error: error.message,
          stack: error.stack
        }
      }
    ]
  });

  await base44.asServiceRole.entities.AutomationLog.create({
    acao: 'erro_playbook',
    contato_id: execution.contact_id,
    thread_id: execution.thread_id,
    resultado: 'erro',
    timestamp: new Date().toISOString(),
    detalhes: {
      mensagem: error.message,
      step_index: stepIndex,
      playbook_id: execution.flow_template_id
    },
    origem: 'sistema'
  });
}

function validarInput(valor, step) {
  if (!valor || valor.trim() === '') {
    return {
      valido: false,
      mensagem: 'Por favor, forneça uma resposta.'
    };
  }

  if (step.opcoes && step.opcoes.length > 0) {
    const opcoesLower = step.opcoes.map(o => o.toLowerCase());
    if (!opcoesLower.includes(valor.toLowerCase())) {
      return {
        valido: false,
        mensagem: `Por favor, escolha uma das opções: ${step.opcoes.join(', ')}`
      };
    }
  }

  if (step.tipo_input === 'number') {
    if (isNaN(valor)) {
      return {
        valido: false,
        mensagem: 'Por favor, forneça um número válido.'
      };
    }
  }

  if (step.tipo_input === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(valor)) {
      return {
        valido: false,
        mensagem: 'Por favor, forneça um email válido.'
      };
    }
  }

  return { valido: true };
}

function interpolarVariaveis(texto, variables) {
  if (!texto) return '';
  
  return texto.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}