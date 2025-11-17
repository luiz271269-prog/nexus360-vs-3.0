import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  SISTEMA DE GATILHOS AUTOMÁTICOS                              ║
 * ║  Detecta eventos e aciona playbooks automaticamente           ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return Response.json(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { action, ...params } = payload;

    console.log('[GATILHOS] 🎯 Action:', action);

    switch (action) {
      case 'processar_evento':
        return Response.json(await processarEvento(base44, params), { headers });
      
      case 'verificar_gatilhos_pendentes':
        return Response.json(await verificarGatilhosPendentes(base44), { headers });
      
      case 'avaliar_playbook_para_contato':
        return Response.json(await avaliarPlaybookParaContato(base44, params), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[GATILHOS] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

/**
 * Processa um evento do sistema e verifica se deve acionar playbooks
 */
async function processarEvento(base44, params) {
  const { tipo_evento, dados_evento } = params;

  console.log(`[GATILHOS] 📥 Processando evento: ${tipo_evento}`);

  // Mapa de eventos para gatilhos
  const mapaGatilhos = {
    'mensagem_whatsapp_recebida': () => processarMensagemRecebida(base44, dados_evento),
    'orcamento_criado': () => processarOrcamentoCriado(base44, dados_evento),
    'orcamento_status_mudou': () => processarOrcamentoStatusMudou(base44, dados_evento),
    'cliente_criado': () => processarClienteCriado(base44, dados_evento),
    'venda_criada': () => processarVendaCriada(base44, dados_evento),
    'cliente_inativo_90d': () => processarClienteInativo(base44, dados_evento)
  };

  const processador = mapaGatilhos[tipo_evento];

  if (!processador) {
    console.log(`[GATILHOS] ⚠️ Evento não mapeado: ${tipo_evento}`);
    return { success: true, processed: false, motivo: 'evento_nao_mapeado' };
  }

  const resultado = await processador();

  return {
    success: true,
    processed: true,
    tipo_evento,
    resultado
  };
}

/**
 * Processa mensagem recebida e verifica se deve iniciar playbook
 */
async function processarMensagemRecebida(base44, dados) {
  const { contact_id, thread_id, content } = dados;

  if (!contact_id || !thread_id) {
    return { acionado: false, motivo: 'dados_incompletos' };
  }

  console.log(`[GATILHOS] 💬 Analisando mensagem do contato ${contact_id}`);

  // Verificar se já há execução ativa para este contato
  const execucoesAtivas = await base44.asServiceRole.entities.FlowExecution.filter({
    contact_id,
    status: 'ativo'
  });

  if (execucoesAtivas.length > 0) {
    console.log(`[GATILHOS] ⏭️ Contato já possui execução ativa`);
    return { acionado: false, motivo: 'execucao_ja_ativa' };
  }

  // Buscar playbooks que podem ser acionados por palavras-chave
  const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
    ativo: true
  });

  const contentLower = (content || '').toLowerCase();

  // Encontrar playbook com gatilho correspondente
  for (const playbook of playbooks) {
    if (!playbook.gatilhos || playbook.gatilhos.length === 0) continue;

    const gatilhoEncontrado = playbook.gatilhos.some(gatilho => 
      contentLower.includes(gatilho.toLowerCase())
    );

    if (gatilhoEncontrado) {
      console.log(`[GATILHOS] 🎯 Gatilho encontrado! Playbook: ${playbook.nome}`);

      // Iniciar execução do playbook
      const resultado = await base44.asServiceRole.functions.invoke('playbookEngine', {
        action: 'start',
        contact_id,
        flow_template_id: playbook.id
      });

      return {
        acionado: true,
        playbook_id: playbook.id,
        playbook_nome: playbook.nome,
        execution_id: resultado.data.execution_id
      };
    }
  }

  return { acionado: false, motivo: 'nenhum_gatilho_correspondente' };
}

/**
 * Processa criação de orçamento
 */
async function processarOrcamentoCriado(base44, dados) {
  const { orcamento_id, cliente_nome, cliente_telefone } = dados;

  console.log(`[GATILHOS] 📋 Orçamento criado: ${orcamento_id}`);

  // Buscar playbooks de follow-up de orçamento
  const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
    ativo: true,
    tipo_fluxo: 'follow_up_vendas'
  });

  if (playbooks.length === 0) {
    return { acionado: false, motivo: 'nenhum_playbook_follow_up' };
  }

  // Buscar ou criar contato
  let contatos = await base44.asServiceRole.entities.Contact.filter({
    telefone: cliente_telefone
  });

  let contact;
  if (contatos.length === 0) {
    contact = await base44.asServiceRole.entities.Contact.create({
      nome: cliente_nome,
      telefone: cliente_telefone,
      tipo_contato: 'cliente'
    });
  } else {
    contact = contatos[0];
  }

  // Iniciar playbook de follow-up
  const playbook = playbooks[0]; // Usar o primeiro disponível

  const resultado = await base44.asServiceRole.functions.invoke('playbookEngine', {
    action: 'start',
    contact_id: contact.id,
    flow_template_id: playbook.id
  });

  return {
    acionado: true,
    playbook_id: playbook.id,
    playbook_nome: playbook.nome,
    contact_id: contact.id,
    execution_id: resultado.data.execution_id
  };
}

/**
 * Processa mudança de status de orçamento
 */
async function processarOrcamentoStatusMudou(base44, dados) {
  const { orcamento_id, status_novo, cliente_telefone } = dados;

  console.log(`[GATILHOS] 🔄 Orçamento ${orcamento_id} mudou para: ${status_novo}`);

  // Se orçamento foi enviado, iniciar follow-up
  if (status_novo === 'enviado') {
    return await processarOrcamentoCriado(base44, dados);
  }

  return { acionado: false, motivo: 'status_nao_requer_acao' };
}

/**
 * Processa criação de novo cliente
 */
async function processarClienteCriado(base44, dados) {
  const { cliente_id, razao_social, telefone } = dados;

  console.log(`[GATILHOS] 👤 Novo cliente criado: ${cliente_id}`);

  // Buscar playbooks de onboarding
  const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
    ativo: true,
    tipo_fluxo: 'ativacao_cliente'
  });

  if (playbooks.length === 0) {
    return { acionado: false, motivo: 'nenhum_playbook_onboarding' };
  }

  // Buscar ou criar contato
  let contatos = await base44.asServiceRole.entities.Contact.filter({
    telefone: telefone
  });

  let contact;
  if (contatos.length === 0) {
    contact = await base44.asServiceRole.entities.Contact.create({
      nome: razao_social,
      telefone: telefone,
      tipo_contato: 'cliente',
      cliente_id: cliente_id
    });
  } else {
    contact = contatos[0];
  }

  // Iniciar playbook de onboarding
  const playbook = playbooks[0];

  const resultado = await base44.asServiceRole.functions.invoke('playbookEngine', {
    action: 'start',
    contact_id: contact.id,
    flow_template_id: playbook.id
  });

  return {
    acionado: true,
    playbook_id: playbook.id,
    playbook_nome: playbook.nome,
    contact_id: contact.id,
    execution_id: resultado.data.execution_id
  };
}

/**
 * Processa criação de venda (pós-venda)
 */
async function processarVendaCriada(base44, dados) {
  const { venda_id, cliente_nome, cliente_telefone } = dados;

  console.log(`[GATILHOS] 💰 Venda criada: ${venda_id}`);

  // Buscar playbooks de pós-venda
  const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
    ativo: true,
    tipo_fluxo: 'pos_venda'
  });

  if (playbooks.length === 0) {
    return { acionado: false, motivo: 'nenhum_playbook_pos_venda' };
  }

  // Buscar contato
  let contatos = await base44.asServiceRole.entities.Contact.filter({
    telefone: cliente_telefone
  });

  if (contatos.length === 0) {
    return { acionado: false, motivo: 'contato_nao_encontrado' };
  }

  const contact = contatos[0];

  // Agendar playbook de pós-venda para 3 dias após a compra
  const dataExecucao = new Date();
  dataExecucao.setDate(dataExecucao.getDate() + 3);

  // Criar execução agendada
  await base44.asServiceRole.entities.FlowExecution.create({
    flow_template_id: playbooks[0].id,
    contact_id: contact.id,
    status: 'agendado',
    next_action_at: dataExecucao.toISOString(),
    variables: {
      venda_id: venda_id
    }
  });

  return {
    acionado: true,
    agendado: true,
    playbook_id: playbooks[0].id,
    playbook_nome: playbooks[0].nome,
    data_execucao: dataExecucao.toISOString()
  };
}

/**
 * Processa cliente inativo (90 dias)
 */
async function processarClienteInativo(base44, dados) {
  const { cliente_id, telefone } = dados;

  console.log(`[GATILHOS] 😴 Cliente inativo detectado: ${cliente_id}`);

  // Buscar playbooks de reativação
  const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
    ativo: true,
    tipo_fluxo: 'reativacao'
  });

  if (playbooks.length === 0) {
    return { acionado: false, motivo: 'nenhum_playbook_reativacao' };
  }

  // Buscar contato
  let contatos = await base44.asServiceRole.entities.Contact.filter({
    telefone: telefone
  });

  if (contatos.length === 0) {
    return { acionado: false, motivo: 'contato_nao_encontrado' };
  }

  const contact = contatos[0];

  // Iniciar playbook de reativação
  const playbook = playbooks[0];

  const resultado = await base44.asServiceRole.functions.invoke('playbookEngine', {
    action: 'start',
    contact_id: contact.id,
    flow_template_id: playbook.id
  });

  return {
    acionado: true,
    playbook_id: playbook.id,
    playbook_nome: playbook.nome,
    contact_id: contact.id,
    execution_id: resultado.data.execution_id
  };
}

/**
 * Verifica gatilhos pendentes (chamado por cron)
 */
async function verificarGatilhosPendentes(base44) {
  console.log('[GATILHOS] 🔍 Verificando gatilhos pendentes...');

  const agora = new Date().toISOString();

  // Buscar execuções agendadas que já devem ser executadas
  const execucoesPendentes = await base44.asServiceRole.entities.FlowExecution.filter({
    status: 'agendado'
  });

  const execucoesParaProcessar = execucoesPendentes.filter(e => 
    e.next_action_at && e.next_action_at <= agora
  );

  console.log(`[GATILHOS] 📋 ${execucoesParaProcessar.length} execuções pendentes`);

  let processadas = 0;

  for (const execucao of execucoesParaProcessar) {
    try {
      // Atualizar status para ativo
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'ativo',
        started_at: new Date().toISOString()
      });

      // Iniciar execução
      await base44.asServiceRole.functions.invoke('playbookEngine', {
        action: 'continue_follow_up',
        execution_id: execucao.id
      });

      processadas++;
      console.log(`[GATILHOS] ✅ Execução ${execucao.id} processada`);

    } catch (error) {
      console.error(`[GATILHOS] ❌ Erro ao processar execução ${execucao.id}:`, error);
    }
  }

  return {
    success: true,
    total_pendentes: execucoesParaProcessar.length,
    processadas
  };
}

/**
 * Avalia qual playbook usar para um contato específico
 */
async function avaliarPlaybookParaContato(base44, params) {
  const { contact_id, contexto } = params;

  const contact = await base44.asServiceRole.entities.Contact.get(contact_id);

  if (!contact) {
    throw new Error('Contato não encontrado');
  }

  // Buscar playbooks ativos
  const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
    ativo: true
  });

  // Usar IA para recomendar o melhor playbook
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Analise o contexto do contato e recomende o playbook mais adequado:

Contato:
- Nome: ${contact.nome}
- Tipo: ${contact.tipo_contato}
- Tags: ${contact.tags?.join(', ') || 'nenhuma'}
- Score: ${contact.cliente_score || 0}

Contexto: ${contexto || 'Primeiro contato'}

Playbooks disponíveis:
${playbooks.map((p, idx) => `${idx + 1}. ${p.nome} (${p.tipo_fluxo})`).join('\n')}

Recomende o playbook mais adequado e explique o motivo.`,
    response_json_schema: {
      type: "object",
      properties: {
        playbook_recomendado_indice: { type: "number" },
        motivo: { type: "string" },
        confianca: { type: "number" }
      }
    }
  });

  const recomendacao = response;
  const playbookRecomendado = playbooks[recomendacao.playbook_recomendado_indice];

  return {
    success: true,
    playbook_recomendado: {
      id: playbookRecomendado?.id,
      nome: playbookRecomendado?.nome,
      tipo: playbookRecomendado?.tipo_fluxo
    },
    motivo: recomendacao.motivo,
    confianca: recomendacao.confianca
  };
}