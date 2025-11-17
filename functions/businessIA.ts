import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  BUSINESS IA - Insights Estratégicos para Negócio            ║
 * ║  Detecta anomalias, prevê resultados, recomenda ações        ║
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
    const { action, ...params } = payload;

    console.log('[BUSINESS IA] 💡 Action:', action);

    switch (action) {
      case 'strategic_insights':
        return Response.json(await gerarInsightsEstrategicos(base44), { headers });
      
      case 'detect_anomalies':
        return Response.json(await detectarAnomalias(base44, params), { headers });
      
      case 'predict_30_days':
        return Response.json(await preverProximos30Dias(base44), { headers });
      
      case 'recommend_actions':
        return Response.json(await recomendarAcoes(base44), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[BUSINESS IA] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

async function gerarInsightsEstrategicos(base44) {
  console.log('[BUSINESS IA] 🧠 Gerando insights estratégicos...');

  const hoje = new Date();
  const seteDiasAtras = new Date(hoje);
  seteDiasAtras.setDate(hoje.getDate() - 7);
  
  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(hoje.getDate() - 30);

  // Buscar dados dos últimos 30 dias
  const [playbooks, execucoes, vendas, threads] = await Promise.all([
    base44.asServiceRole.entities.FlowTemplate.filter({ ativo: true }),
    base44.asServiceRole.entities.FlowExecution.filter({
      started_at: { $gte: trintaDiasAtras.toISOString() }
    }),
    base44.asServiceRole.entities.Venda.filter({
      data_venda: { $gte: trintaDiasAtras.toISOString().slice(0, 10) }
    }),
    base44.asServiceRole.entities.MessageThread.filter({
      last_message_at: { $gte: trintaDiasAtras.toISOString() }
    })
  ]);

  const insights = [];

  // 1. Análise de Performance de Playbooks
  for (const playbook of playbooks) {
    const execucoesPlaybook = execucoes.filter(e => e.flow_template_id === playbook.id);
    const execucoesRecentes = execucoesPlaybook.filter(e => 
      new Date(e.started_at) >= seteDiasAtras
    );

    if (execucoesPlaybook.length > 0 && execucoesRecentes.length > 0) {
      const taxaAnterior = playbook.metricas?.taxa_sucesso || 0;
      const taxaAtual = (execucoesRecentes.filter(e => e.status === 'concluido').length / execucoesRecentes.length) * 100;
      
      const variacao = taxaAtual - taxaAnterior;

      if (variacao < -20) {
        insights.push({
          tipo: 'alerta',
          severidade: 'alta',
          titulo: `Queda de ${Math.abs(Math.round(variacao))}% no playbook "${playbook.nome}"`,
          descricao: `Taxa de sucesso caiu de ${Math.round(taxaAnterior)}% para ${Math.round(taxaAtual)}% nos últimos 7 dias`,
          acao_recomendada: 'Revisar e otimizar o playbook',
          confianca: 0.85,
          playbook_id: playbook.id
        });
      } else if (variacao > 20) {
        insights.push({
          tipo: 'oportunidade',
          severidade: 'media',
          titulo: `Melhoria de ${Math.round(variacao)}% no playbook "${playbook.nome}"`,
          descricao: `Taxa de sucesso aumentou de ${Math.round(taxaAnterior)}% para ${Math.round(taxaAtual)}%`,
          acao_recomendada: 'Replicar estratégia para outros playbooks',
          confianca: 0.90,
          playbook_id: playbook.id
        });
      }
    }
  }

  // 2. Análise de Engajamento
  const threadsRecentes = threads.filter(t => new Date(t.last_message_at) >= seteDiasAtras);
  const taxaEngajamento = threadsRecentes.length > 0
    ? (threadsRecentes.filter(t => t.total_mensagens > 2).length / threadsRecentes.length) * 100
    : 0;

  if (taxaEngajamento < 30) {
    insights.push({
      tipo: 'alerta',
      severidade: 'media',
      titulo: 'Taxa de engajamento baixa',
      descricao: `Apenas ${Math.round(taxaEngajamento)}% dos contatos estão respondendo ativamente`,
      acao_recomendada: 'Revisar mensagens iniciais e timing de follow-up',
      confianca: 0.75
    });
  }

  // 3. Análise de Receita
  const receitaUltimos7 = vendas
    .filter(v => new Date(v.data_venda) >= seteDiasAtras)
    .reduce((sum, v) => sum + (v.valor_total || 0), 0);

  const receitaTotal = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const mediaReceitaSemanal = receitaTotal / 4; // Aproximação de 4 semanas

  const variacaoReceita = ((receitaUltimos7 - mediaReceitaSemanal) / mediaReceitaSemanal) * 100;

  if (variacaoReceita < -25) {
    insights.push({
      tipo: 'alerta',
      severidade: 'critica',
      titulo: 'Queda crítica na receita',
      descricao: `Receita ${Math.abs(Math.round(variacaoReceita))}% abaixo da média semanal`,
      acao_recomendada: 'Intensificar follow-ups e campanhas de recuperação',
      confianca: 0.90
    });
  } else if (variacaoReceita > 25) {
    insights.push({
      tipo: 'oportunidade',
      severidade: 'alta',
      titulo: 'Crescimento acelerado na receita',
      descricao: `Receita ${Math.round(variacaoReceita)}% acima da média semanal`,
      acao_recomendada: 'Ampliar investimento em canais com melhor desempenho',
      confianca: 0.88
    });
  }

  // 4. Tempo de Resposta
  const temposResposta = threads
    .filter(t => t.tempo_primeira_resposta_minutos !== null)
    .map(t => t.tempo_primeira_resposta_minutos);

  const tempoMedio = temposResposta.length > 0
    ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
    : 0;

  if (tempoMedio > 60) {
    insights.push({
      tipo: 'recomendacao',
      severidade: 'media',
      titulo: 'Tempo de resposta elevado',
      descricao: `Tempo médio de primeira resposta: ${Math.round(tempoMedio)} minutos`,
      acao_recomendada: 'Ativar respostas automáticas ou aumentar equipe',
      confianca: 0.80
    });
  }

  return {
    success: true,
    insights,
    total: insights.length,
    timestamp: new Date().toISOString()
  };
}

async function detectarAnomalias(base44, params) {
  const { playbook_id, periodo_dias = 7 } = params;

  console.log('[BUSINESS IA] 🔍 Detectando anomalias...');

  const hoje = new Date();
  const dataInicio = new Date(hoje);
  dataInicio.setDate(hoje.getDate() - periodo_dias);

  const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
    flow_template_id: playbook_id,
    started_at: { $gte: dataInicio.toISOString() }
  });

  const anomalias = [];

  // Detectar quedas abruptas
  const execucoesPorDia = {};
  execucoes.forEach(e => {
    const dia = new Date(e.started_at).toISOString().slice(0, 10);
    if (!execucoesPorDia[dia]) {
      execucoesPorDia[dia] = { total: 0, concluidas: 0 };
    }
    execucoesPorDia[dia].total++;
    if (e.status === 'concluido') execucoesPorDia[dia].concluidas++;
  });

  const dias = Object.keys(execucoesPorDia).sort();
  for (let i = 1; i < dias.length; i++) {
    const anterior = execucoesPorDia[dias[i - 1]];
    const atual = execucoesPorDia[dias[i]];

    const taxaAnterior = anterior.total > 0 ? (anterior.concluidas / anterior.total) * 100 : 0;
    const taxaAtual = atual.total > 0 ? (atual.concluidas / atual.total) * 100 : 0;

    const variacao = taxaAtual - taxaAnterior;

    if (variacao < -30) {
      anomalias.push({
        tipo: 'queda_abrupta',
        dia: dias[i],
        variacao_percentual: Math.round(variacao),
        taxa_anterior: Math.round(taxaAnterior),
        taxa_atual: Math.round(taxaAtual)
      });
    }
  }

  return {
    success: true,
    anomalias,
    total: anomalias.length
  };
}

async function preverProximos30Dias(base44) {
  console.log('[BUSINESS IA] 🔮 Prevendo próximos 30 dias...');

  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(hoje.getDate() - 30);

  const [vendas, execucoes, orcamentos] = await Promise.all([
    base44.asServiceRole.entities.Venda.filter({
      data_venda: { $gte: trintaDiasAtras.toISOString().slice(0, 10) }
    }),
    base44.asServiceRole.entities.FlowExecution.filter({
      started_at: { $gte: trintaDiasAtras.toISOString() }
    }),
    base44.asServiceRole.entities.Orcamento.filter({
      status: { $in: ['enviado', 'negociando', 'liberado'] }
    })
  ]);

  // Calcular tendências
  const receitaAtual = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const numeroVendas = vendas.length;
  const ticketMedio = numeroVendas > 0 ? receitaAtual / numeroVendas : 0;

  const execucoesAtivas = execucoes.filter(e => e.status === 'ativo').length;
  const taxaConversao = execucoes.length > 0 
    ? (execucoes.filter(e => e.status === 'concluido').length / execucoes.length)
    : 0.3;

  const pipelineValor = orcamentos.reduce((sum, o) => sum + (o.valor_total || 0), 0);

  // Previsões
  const previsaoLeads = Math.round(execucoesAtivas * 1.2); // 20% crescimento projetado
  const previsaoConversoes = Math.round(previsaoLeads * taxaConversao);
  const previsaoReceita = Math.round(previsaoConversoes * ticketMedio + pipelineValor * taxaConversao);

  return {
    success: true,
    previsao: {
      leads_esperados: previsaoLeads,
      conversoes_esperadas: previsaoConversoes,
      receita_esperada: previsaoReceita,
      ticket_medio_projetado: Math.round(ticketMedio),
      taxa_conversao_base: Math.round(taxaConversao * 100)
    },
    confianca: Math.min(85, Math.max(60, execucoes.length / 10 * 70))
  };
}

async function recomendarAcoes(base44) {
  console.log('[BUSINESS IA] 💡 Recomendando ações...');

  const insights = await gerarInsightsEstrategicos(base44);
  const recomendacoes = [];

  // Processar insights e gerar recomendações acionáveis
  for (const insight of insights.insights) {
    if (insight.tipo === 'alerta' && insight.severidade === 'critica') {
      recomendacoes.push({
        prioridade: 'urgente',
        titulo: 'Ação Imediata Necessária',
        descricao: insight.titulo,
        passos: [
          'Revisar playbooks com baixa performance',
          'Intensificar follow-ups manuais',
          'Contatar leads quentes pendentes'
        ],
        impacto_estimado: 'Alto',
        prazo: '24-48 horas'
      });
    }

    if (insight.tipo === 'oportunidade') {
      recomendacoes.push({
        prioridade: 'alta',
        titulo: 'Oportunidade de Crescimento',
        descricao: insight.titulo,
        passos: [
          'Analisar fatores de sucesso',
          'Replicar estratégia em outros canais',
          'Aumentar investimento neste segmento'
        ],
        impacto_estimado: 'Médio-Alto',
        prazo: '1 semana'
      });
    }
  }

  // Recomendações gerais baseadas em padrões
  const threads = await base44.asServiceRole.entities.MessageThread.list('-created_date', 100);
  const threadsNaoRespondidas = threads.filter(t => 
    t.status === 'aberta' && 
    t.unread_count > 0 &&
    t.last_message_sender === 'contact'
  );

  if (threadsNaoRespondidas.length > 10) {
    recomendacoes.push({
      prioridade: 'alta',
      titulo: 'Mensagens Pendentes de Resposta',
      descricao: `${threadsNaoRespondidas.length} conversas aguardando resposta`,
      passos: [
        'Priorizar leads com maior score',
        'Ativar respostas automáticas temporárias',
        'Redistribuir carga entre atendentes'
      ],
      impacto_estimado: 'Alto',
      prazo: 'Imediato'
    });
  }

  return {
    success: true,
    recomendacoes,
    total: recomendacoes.length,
    timestamp: new Date().toISOString()
  };
}