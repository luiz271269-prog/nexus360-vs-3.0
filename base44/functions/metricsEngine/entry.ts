import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  METRICS ENGINE - Motor de Métricas de Negócio               ║
 * ║  Calcula KPIs, conversão, ROI, engajamento e previsões       ║
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

    console.log('[METRICS ENGINE] 📊 Action:', action);

    switch (action) {
      case 'general_kpis':
        return Response.json(await calcularKPIsGerais(base44), { headers });
      
      case 'playbook_performance':
        return Response.json(await calcularPerformancePlaybook(base44, params), { headers });
      
      case 'conversion_by_channel':
        return Response.json(await calcularConversaoPorCanal(base44), { headers });
      
      case 'predicted_revenue':
        return Response.json(await preverReceitaProximos30Dias(base44), { headers });
      
      case 'response_time':
        return Response.json(await calcularTempoResposta(base44, params), { headers });
      
      case 'roi_by_campaign':
        return Response.json(await calcularROIPorCampanha(base44, params), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[METRICS ENGINE] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

async function calcularKPIsGerais(base44) {
  console.log('[METRICS ENGINE] 📈 Calculando KPIs gerais...');

  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(hoje.getDate() - 30);

  const [execucoes, vendas, threads] = await Promise.all([
    base44.asServiceRole.entities.FlowExecution.filter({
      started_at: { $gte: trintaDiasAtras.toISOString() }
    }),
    base44.asServiceRole.entities.Venda.filter({
      data_venda: { $gte: trintaDiasAtras.toISOString().slice(0, 10) }
    }),
    base44.asServiceRole.entities.MessageThread.filter({
      first_message_at: { $gte: trintaDiasAtras.toISOString() }
    })
  ]);

  const totalExecucoes = execucoes.length;
  const execucoesConcluidas = execucoes.filter(e => e.status === 'concluido').length;
  const taxaConversao = totalExecucoes > 0 ? (execucoesConcluidas / totalExecucoes) * 100 : 0;

  const receitaTotal = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const ticketMedio = vendas.length > 0 ? receitaTotal / vendas.length : 0;

  const temposResposta = threads
    .filter(t => t.tempo_primeira_resposta_minutos !== null && t.tempo_primeira_resposta_minutos !== undefined)
    .map(t => t.tempo_primeira_resposta_minutos);
  
  const tempoMedioResposta = temposResposta.length > 0
    ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
    : 0;

  const taxaEngajamento = threads.length > 0
    ? (threads.filter(t => t.total_mensagens > 2).length / threads.length) * 100
    : 0;

  return {
    success: true,
    kpis: {
      taxa_conversao: Math.round(taxaConversao * 10) / 10,
      receita_total: Math.round(receitaTotal),
      ticket_medio: Math.round(ticketMedio),
      tempo_medio_resposta: Math.round(tempoMedioResposta),
      taxa_engajamento: Math.round(taxaEngajamento * 10) / 10,
      total_conversas: threads.length,
      total_vendas: vendas.length
    }
  };
}

async function calcularPerformancePlaybook(base44, params) {
  const { playbook_id } = params;
  
  if (!playbook_id) {
    throw new Error('playbook_id é obrigatório');
  }

  const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
    flow_template_id: playbook_id
  });

  const total = execucoes.length;
  const concluidas = execucoes.filter(e => e.status === 'concluido').length;
  const canceladas = execucoes.filter(e => e.status === 'cancelado').length;
  const erro = execucoes.filter(e => e.status === 'erro').length;

  const taxaSucesso = total > 0 ? (concluidas / total) * 100 : 0;
  const taxaAbandono = total > 0 ? (canceladas / total) * 100 : 0;

  return {
    success: true,
    metrics: {
      total_execucoes: total,
      taxa_sucesso: Math.round(taxaSucesso * 10) / 10,
      taxa_abandono: Math.round(taxaAbandono * 10) / 10,
      concluidas,
      canceladas,
      erro
    }
  };
}

async function calcularConversaoPorCanal(base44) {
  console.log('[METRICS ENGINE] 📊 Calculando conversão por canal...');

  const threads = await base44.asServiceRole.entities.MessageThread.list('-created_date', 500);

  const canais = {};

  threads.forEach(thread => {
    // Assumindo que o canal é 'whatsapp' por padrão
    const canal = 'whatsapp';
    
    if (!canais[canal]) {
      canais[canal] = {
        iniciados: 0,
        conversoes: 0,
        taxa_conversao: 0
      };
    }

    canais[canal].iniciados++;
    
    // Considerar "conversão" se a thread foi resolvida
    if (thread.status === 'resolvida') {
      canais[canal].conversoes++;
    }
  });

  // Calcular taxas
  for (const canal in canais) {
    const dados = canais[canal];
    dados.taxa_conversao = dados.iniciados > 0
      ? (dados.conversoes / dados.iniciados) * 100
      : 0;
    dados.taxa_conversao = Math.round(dados.taxa_conversao * 10) / 10;
  }

  return {
    success: true,
    canais
  };
}

async function preverReceitaProximos30Dias(base44) {
  console.log('[METRICS ENGINE] 🔮 Prevendo receita para próximos 30 dias...');

  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(hoje.getDate() - 30);

  const [vendas, orcamentos] = await Promise.all([
    base44.asServiceRole.entities.Venda.filter({
      data_venda: { $gte: trintaDiasAtras.toISOString().slice(0, 10) }
    }),
    base44.asServiceRole.entities.Orcamento.filter({
      status: { $in: ['enviado', 'negociando', 'liberado'] }
    })
  ]);

  const receitaUltimos30 = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const pipelineValor = orcamentos.reduce((sum, o) => sum + (o.valor_total || 0), 0);

  // Taxa de conversão histórica
  const orcamentosTotais = await base44.asServiceRole.entities.Orcamento.list('-created_date', 200);
  const orcamentosAprovados = orcamentosTotais.filter(o => o.status === 'aprovado').length;
  const taxaConversao = orcamentosTotais.length > 0
    ? orcamentosAprovados / orcamentosTotais.length
    : 0.3; // default 30%

  // Previsões
  const previsaoConservadora = Math.round(receitaUltimos30 * 0.9 + pipelineValor * taxaConversao * 0.6);
  const previsaoRealista = Math.round(receitaUltimos30 + pipelineValor * taxaConversao * 0.75);
  const previsaoOtimista = Math.round(receitaUltimos30 * 1.1 + pipelineValor * taxaConversao * 0.9);

  return {
    success: true,
    previsao: {
      conservadora: previsaoConservadora,
      realista: previsaoRealista,
      otimista: previsaoOtimista,
      confianca: Math.min(90, Math.max(60, orcamentosTotais.length / 10 * 70))
    },
    dados_base: {
      receita_ultimos_30: Math.round(receitaUltimos30),
      pipeline_atual: Math.round(pipelineValor),
      taxa_conversao: Math.round(taxaConversao * 100)
    }
  };
}

async function calcularTempoResposta(base44, params) {
  const { user_id } = params;

  const filtro = user_id ? { assigned_user_id: user_id } : {};
  
  const threads = await base44.asServiceRole.entities.MessageThread.filter(
    filtro,
    '-created_date',
    500
  );

  const temposResposta = threads
    .filter(t => t.tempo_primeira_resposta_minutos !== null && t.tempo_primeira_resposta_minutos !== undefined)
    .map(t => t.tempo_primeira_resposta_minutos);

  const tempoMedio = temposResposta.length > 0
    ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
    : 0;

  const tempoMinimo = temposResposta.length > 0 ? Math.min(...temposResposta) : 0;
  const tempoMaximo = temposResposta.length > 0 ? Math.max(...temposResposta) : 0;

  return {
    success: true,
    metrics: {
      tempo_medio: Math.round(tempoMedio * 10) / 10,
      tempo_minimo: tempoMinimo,
      tempo_maximo: tempoMaximo,
      total_conversas: threads.length
    }
  };
}

async function calcularROIPorCampanha(base44, params) {
  const { campaign_id } = params;

  if (!campaign_id) {
    throw new Error('campaign_id é obrigatório');
  }

  const campanha = await base44.asServiceRole.entities.Campaign.get(campaign_id);

  if (!campanha) {
    throw new Error('Campanha não encontrada');
  }

  const investimento = campanha.investimento || 0;
  const receitaGerada = campanha.resultados?.receita_gerada || 0;
  const roi = investimento > 0 ? ((receitaGerada - investimento) / investimento) * 100 : 0;

  return {
    success: true,
    campaign: {
      nome: campanha.nome,
      investimento,
      receita_gerada: receitaGerada,
      roi: Math.round(roi * 10) / 10,
      leads_gerados: campanha.resultados?.leads_gerados || 0,
      conversoes: campanha.resultados?.conversoes || 0
    }
  };
}