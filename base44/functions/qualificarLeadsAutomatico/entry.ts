import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  QUALIFICADOR AUTOMÁTICO DE LEADS - BACKEND                 ║
 * ║  Pode ser executado via cron ou manualmente                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { cliente_id, modo } = await req.json();

    console.log('[QUALIFICADOR] Iniciando qualificação...', { cliente_id, modo });

    if (cliente_id) {
      // Qualificar cliente específico
      const resultado = await qualificarCliente(base44, cliente_id);
      return Response.json({
        success: true,
        resultado
      });
    } else if (modo === 'todos') {
      // Qualificar todos
      const resultado = await qualificarTodos(base44);
      return Response.json({
        success: true,
        ...resultado
      });
    } else {
      return Response.json({
        success: false,
        error: 'Parâmetros inválidos'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('[QUALIFICADOR] Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

async function qualificarCliente(base44, clienteId) {
  // Buscar dados do cliente
  const cliente = await base44.asServiceRole.entities.Cliente.get(clienteId);
  if (!cliente) throw new Error('Cliente não encontrado');

  // Buscar interações
  const interacoes = await base44.asServiceRole.entities.Interacao.filter({
    cliente_id: clienteId
  }, '-data_interacao', 50);

  // Buscar orçamentos
  const orcamentos = await base44.asServiceRole.entities.Orcamento.filter({
    cliente_id: clienteId
  }, '-data_orcamento', 20);

  // Buscar vendas
  const vendas = await base44.asServiceRole.entities.Venda.filter({
    cliente_nome: cliente.razao_social
  }, '-data_venda', 10);

  // Calcular scores
  const scores = calcularScores({ cliente, interacoes, orcamentos, vendas });

  // Determinar próxima ação
  const proximaAcao = determinarProximaAcao(scores, cliente, interacoes, orcamentos);

  // Salvar score
  const scoreExistente = await base44.asServiceRole.entities.ClienteScore.filter({
    cliente_id: clienteId
  });

  const scoreData = {
    cliente_id: clienteId,
    cliente_nome: cliente.razao_social || cliente.nome_fantasia,
    ...scores,
    proxima_melhor_acao: proximaAcao.acao,
    motivo_score: proximaAcao.motivo,
    data_calculo: new Date().toISOString()
  };

  if (scoreExistente.length > 0) {
    await base44.asServiceRole.entities.ClienteScore.update(scoreExistente[0].id, scoreData);
  } else {
    await base44.asServiceRole.entities.ClienteScore.create(scoreData);
  }

  return scoreData;
}

async function qualificarTodos(base44) {
  const clientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 500);
  
  let sucessos = 0;
  let erros = 0;

  for (const cliente of clientes) {
    try {
      await qualificarCliente(base44, cliente.id);
      sucessos++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Erro ao qualificar ${cliente.id}:`, error);
      erros++;
    }
  }

  return { sucessos, erros, total: clientes.length };
}

function calcularScores(dados) {
  const { cliente, interacoes, orcamentos, vendas } = dados;

  const scoreEngagement = calcularEngajamento(interacoes);
  const scorePotencial = calcularPotencialCompra(orcamentos, vendas, cliente);
  const scoreUrgencia = calcularUrgencia(interacoes, orcamentos);
  const scoreValor = calcularValorCliente(vendas, cliente);

  const scoreTotal = Math.round(
    (scoreEngagement * 2.5) +
    (scorePotencial * 3) +
    (scoreUrgencia * 2) +
    (scoreValor * 2.5)
  );

  const riscoChurn = calcularRiscoChurn(interacoes, vendas, cliente);

  return {
    score_total: Math.min(1000, scoreTotal),
    score_engagement: scoreEngagement,
    score_potencial_compra: scorePotencial,
    score_urgencia: scoreUrgencia,
    score_valor_cliente: scoreValor,
    risco_churn: riscoChurn
  };
}

function calcularEngajamento(interacoes) {
  let score = 0;
  const ultimos30Dias = new Date();
  ultimos30Dias.setDate(ultimos30Dias.getDate() - 30);

  const interacoesRecentes = interacoes.filter(i => 
    new Date(i.data_interacao) > ultimos30Dias
  );

  score += Math.min(50, interacoesRecentes.length * 10);
  
  const reunioes = interacoes.filter(i => i.tipo_interacao === 'reuniao');
  if (reunioes.length > 0) score += 15;

  const interessado = interacoes.filter(i => i.resultado === 'interessado');
  if (interessado.length > 0) score += 15;

  return Math.min(100, score);
}

function calcularPotencialCompra(orcamentos, vendas, cliente) {
  let score = 0;

  const orcamentosAbertos = orcamentos.filter(o => 
    o.status === 'enviado' || o.status === 'negociando'
  );
  score += Math.min(40, orcamentosAbertos.length * 20);

  if (vendas.length > 0) {
    score += Math.min(30, vendas.length * 10);
  }

  if (cliente.valor_recorrente_mensal > 5000) score += 20;
  else if (cliente.valor_recorrente_mensal > 2000) score += 10;

  if (cliente.classificacao === 'A - Alto Potencial') score += 10;

  return Math.min(100, score);
}

function calcularUrgencia(interacoes, orcamentos) {
  let score = 0;

  const hoje = new Date();
  const orcamentosVencendo = orcamentos.filter(o => {
    if (!o.data_vencimento) return false;
    const vencimento = new Date(o.data_vencimento);
    const diasRestantes = (vencimento - hoje) / (1000 * 60 * 60 * 24);
    return diasRestantes > 0 && diasRestantes <= 7;
  });
  score += Math.min(40, orcamentosVencendo.length * 20);

  const urgente = interacoes.find(i => 
    i.observacoes?.toLowerCase().includes('urgente') ||
    i.observacoes?.toLowerCase().includes('urgência')
  );
  if (urgente) score += 30;

  return Math.min(100, score);
}

function calcularValorCliente(vendas, cliente) {
  let score = 0;

  const valorTotal = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  
  if (valorTotal > 50000) score += 50;
  else if (valorTotal > 20000) score += 35;
  else if (valorTotal > 10000) score += 20;
  else if (valorTotal > 5000) score += 10;

  if (vendas.length >= 5) score += 25;
  else if (vendas.length >= 3) score += 15;
  else if (vendas.length >= 1) score += 5;

  if (cliente.valor_recorrente_mensal) {
    score += Math.min(25, (cliente.valor_recorrente_mensal / 1000) * 5);
  }

  return Math.min(100, score);
}

function calcularRiscoChurn(interacoes, vendas, cliente) {
  const ultimaInteracao = interacoes[0];
  if (ultimaInteracao) {
    const diasSemContato = (new Date() - new Date(ultimaInteracao.data_interacao)) / (1000 * 60 * 60 * 24);
    if (diasSemContato > 90) return 'critico';
    if (diasSemContato > 60) return 'alto';
  }

  const ultimaVenda = vendas[0];
  if (ultimaVenda) {
    const diasSemCompra = (new Date() - new Date(ultimaVenda.data_venda)) / (1000 * 60 * 60 * 24);
    if (diasSemCompra > 180) return 'alto';
    if (diasSemCompra > 90) return 'medio';
  }

  if (cliente.status === 'Inativo') return 'critico';
  if (cliente.status === 'Em Risco') return 'alto';

  return 'baixo';
}

function determinarProximaAcao(scores, cliente, interacoes, orcamentos) {
  const { score_urgencia, score_potencial_compra, score_engagement, risco_churn } = scores;

  if (risco_churn === 'critico') {
    return {
      acao: 'Ligar urgentemente para reativar cliente',
      motivo: 'Cliente sem contato há mais de 90 dias e com alto risco de perda'
    };
  }

  if (score_urgencia > 70 && score_potencial_compra > 60) {
    return {
      acao: 'Agendar reunião de fechamento',
      motivo: 'Cliente demonstra urgência e alto potencial de compra'
    };
  }

  const orcamentosAbertos = orcamentos.filter(o => o.status === 'enviado' || o.status === 'negociando');
  if (orcamentosAbertos.length > 0) {
    return {
      acao: 'Follow-up de orçamento em aberto',
      motivo: `${orcamentosAbertos.length} orçamento(s) aguardando resposta`
    };
  }

  if (score_engagement > 70) {
    return {
      acao: 'Enviar conteúdo relevante ou nova proposta',
      motivo: 'Cliente está engajado e receptivo'
    };
  }

  if (score_engagement < 30) {
    return {
      acao: 'Enviar mensagem de reativação',
      motivo: 'Cliente com baixo engajamento, precisa ser reativado'
    };
  }

  return {
    acao: 'Contato de relacionamento',
    motivo: 'Manter relacionamento ativo com o cliente'
  };
}