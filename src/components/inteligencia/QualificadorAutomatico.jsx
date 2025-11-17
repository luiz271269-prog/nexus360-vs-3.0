import { base44 } from "@/api/base44Client";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  QUALIFICADOR AUTOMÁTICO DE LEADS                           ║
 * ║  Calcula scores baseado em ações e comportamento           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class QualificadorAutomatico {
  
  /**
   * Qualifica um cliente baseado em suas interações e dados
   */
  static async qualificarCliente(clienteId) {
    try {
      console.log(`[QUALIFICADOR] 🎯 Iniciando qualificação do cliente ${clienteId}`);

      // Buscar dados do cliente
      const cliente = await base44.entities.Cliente.get(clienteId);
      if (!cliente) {
        console.warn(`[QUALIFICADOR] Cliente ${clienteId} não encontrado`);
        return null;
      }

      // Buscar interações
      const interacoes = await base44.entities.Interacao.filter({
        cliente_id: clienteId
      }, '-data_interacao', 50);

      // Buscar orçamentos
      const orcamentos = await base44.entities.Orcamento.filter({
        cliente_id: clienteId
      }, '-data_orcamento', 20);

      // Buscar vendas
      const vendas = await base44.entities.Venda.filter({
        cliente_nome: cliente.razao_social
      }, '-data_venda', 10);

      // Buscar conversas WhatsApp
      const conversas = await base44.entities.MessageThread.filter({
        contact_id: cliente.id
      }, '-last_message_at', 10);

      // Calcular scores
      const scores = this.calcularScores({
        cliente,
        interacoes,
        orcamentos,
        vendas,
        conversas
      });

      // Determinar próxima ação
      const proximaAcao = this.determinarProximaAcao(scores, cliente, interacoes, orcamentos);

      // Salvar ou atualizar ClienteScore
      const scoreExistente = await base44.entities.ClienteScore.filter({
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
        await base44.entities.ClienteScore.update(scoreExistente[0].id, scoreData);
        console.log(`[QUALIFICADOR] ✅ Score atualizado para ${cliente.razao_social}`);
      } else {
        await base44.entities.ClienteScore.create(scoreData);
        console.log(`[QUALIFICADOR] ✅ Score criado para ${cliente.razao_social}`);
      }

      return scoreData;

    } catch (error) {
      console.error('[QUALIFICADOR] ❌ Erro ao qualificar cliente:', error);
      return null;
    }
  }

  /**
   * Calcula os scores baseado nos dados
   */
  static calcularScores(dados) {
    const { cliente, interacoes, orcamentos, vendas, conversas } = dados;

    // Score de Engajamento (0-100)
    const scoreEngagement = this.calcularEngajamento(interacoes, conversas);

    // Score de Potencial de Compra (0-100)
    const scorePotencial = this.calcularPotencialCompra(orcamentos, vendas, cliente);

    // Score de Urgência (0-100)
    const scoreUrgencia = this.calcularUrgencia(interacoes, orcamentos, conversas);

    // Score de Valor do Cliente (0-100)
    const scoreValor = this.calcularValorCliente(vendas, cliente);

    // Score Total (0-1000)
    const scoreTotal = Math.round(
      (scoreEngagement * 2.5) +
      (scorePotencial * 3) +
      (scoreUrgencia * 2) +
      (scoreValor * 2.5)
    );

    // Risco de Churn
    const riscoChurn = this.calcularRiscoChurn(interacoes, vendas, cliente);

    return {
      score_total: Math.min(1000, scoreTotal),
      score_engagement: scoreEngagement,
      score_potencial_compra: scorePotencial,
      score_urgencia: scoreUrgencia,
      score_valor_cliente: scoreValor,
      risco_churn: riscoChurn
    };
  }

  static calcularEngajamento(interacoes, conversas) {
    let score = 0;

    // Interações recentes (últimos 30 dias)
    const ultimos30Dias = new Date();
    ultimos30Dias.setDate(ultimos30Dias.getDate() - 30);

    const interacoesRecentes = interacoes.filter(i => 
      new Date(i.data_interacao) > ultimos30Dias
    );

    // +10 pontos por interação recente (max 50)
    score += Math.min(50, interacoesRecentes.length * 10);

    // +20 pontos se respondeu no WhatsApp recentemente
    const conversasRecentes = conversas.filter(c => 
      c.last_message_sender === 'contact' &&
      new Date(c.last_message_at) > ultimos30Dias
    );
    if (conversasRecentes.length > 0) score += 20;

    // +15 pontos se tem reuniões agendadas
    const reunioes = interacoes.filter(i => i.tipo_interacao === 'reuniao');
    if (reunioes.length > 0) score += 15;

    // +15 pontos se demonstrou interesse
    const interessado = interacoes.filter(i => i.resultado === 'interessado');
    if (interessado.length > 0) score += 15;

    return Math.min(100, score);
  }

  static calcularPotencialCompra(orcamentos, vendas, cliente) {
    let score = 0;

    // Orçamentos em aberto = alto potencial
    const orcamentosAbertos = orcamentos.filter(o => 
      o.status === 'enviado' || o.status === 'negociando'
    );
    score += Math.min(40, orcamentosAbertos.length * 20);

    // Histórico de compras
    if (vendas.length > 0) {
      score += Math.min(30, vendas.length * 10);
    }

    // Valor recorrente mensal
    if (cliente.valor_recorrente_mensal > 5000) score += 20;
    else if (cliente.valor_recorrente_mensal > 2000) score += 10;

    // Classificação do cliente
    if (cliente.classificacao === 'A - Alto Potencial') score += 10;

    return Math.min(100, score);
  }

  static calcularUrgencia(interacoes, orcamentos, conversas) {
    let score = 0;

    // Mensagens não respondidas
    const mensagensNaoRespondidas = conversas.filter(c => 
      c.last_message_sender === 'contact' &&
      c.unread_count > 0
    );
    score += Math.min(30, mensagensNaoRespondidas.length * 15);

    // Orçamentos próximos do vencimento
    const hoje = new Date();
    const orcamentosVencendo = orcamentos.filter(o => {
      if (!o.data_vencimento) return false;
      const vencimento = new Date(o.data_vencimento);
      const diasRestantes = (vencimento - hoje) / (1000 * 60 * 60 * 24);
      return diasRestantes > 0 && diasRestantes <= 7;
    });
    score += Math.min(40, orcamentosVencendo.length * 20);

    // Cliente sinalizou urgência
    const urgente = interacoes.find(i => 
      i.observacoes?.toLowerCase().includes('urgente') ||
      i.observacoes?.toLowerCase().includes('urgência')
    );
    if (urgente) score += 30;

    return Math.min(100, score);
  }

  static calcularValorCliente(vendas, cliente) {
    let score = 0;

    // Valor total de vendas
    const valorTotal = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    
    if (valorTotal > 50000) score += 50;
    else if (valorTotal > 20000) score += 35;
    else if (valorTotal > 10000) score += 20;
    else if (valorTotal > 5000) score += 10;

    // Frequência de compras
    if (vendas.length >= 5) score += 25;
    else if (vendas.length >= 3) score += 15;
    else if (vendas.length >= 1) score += 5;

    // Valor recorrente
    if (cliente.valor_recorrente_mensal) {
      score += Math.min(25, (cliente.valor_recorrente_mensal / 1000) * 5);
    }

    return Math.min(100, score);
  }

  static calcularRiscoChurn(interacoes, vendas, cliente) {
    // Sem interações recentes (> 60 dias)
    const ultimaInteracao = interacoes[0];
    if (ultimaInteracao) {
      const diasSemContato = (new Date() - new Date(ultimaInteracao.data_interacao)) / (1000 * 60 * 60 * 24);
      if (diasSemContato > 90) return 'critico';
      if (diasSemContato > 60) return 'alto';
    }

    // Sem compras recentes (> 180 dias)
    const ultimaVenda = vendas[0];
    if (ultimaVenda) {
      const diasSemCompra = (new Date() - new Date(ultimaVenda.data_venda)) / (1000 * 60 * 60 * 24);
      if (diasSemCompra > 180) return 'alto';
      if (diasSemCompra > 90) return 'medio';
    }

    // Cliente Inativo
    if (cliente.status === 'Inativo') return 'critico';
    if (cliente.status === 'Em Risco') return 'alto';

    return 'baixo';
  }

  static determinarProximaAcao(scores, cliente, interacoes, orcamentos) {
    const { score_urgencia, score_potencial_compra, score_engagement, risco_churn } = scores;

    // Risco crítico de churn
    if (risco_churn === 'critico') {
      return {
        acao: 'Ligar urgentemente para reativar cliente',
        motivo: 'Cliente sem contato há mais de 90 dias e com alto risco de perda'
      };
    }

    // Alta urgência + alto potencial = fechar negócio
    if (score_urgencia > 70 && score_potencial_compra > 60) {
      return {
        acao: 'Agendar reunião de fechamento',
        motivo: 'Cliente demonstra urgência e alto potencial de compra'
      };
    }

    // Orçamentos em aberto
    const orcamentosAbertos = orcamentos.filter(o => o.status === 'enviado' || o.status === 'negociando');
    if (orcamentosAbertos.length > 0) {
      return {
        acao: 'Follow-up de orçamento em aberto',
        motivo: `${orcamentosAbertos.length} orçamento(s) aguardando resposta`
      };
    }

    // Alto engajamento = nutrir relacionamento
    if (score_engagement > 70) {
      return {
        acao: 'Enviar conteúdo relevante ou nova proposta',
        motivo: 'Cliente está engajado e receptivo'
      };
    }

    // Baixo engajamento = reativar
    if (score_engagement < 30) {
      return {
        acao: 'Enviar mensagem de reativação',
        motivo: 'Cliente com baixo engajamento, precisa ser reativado'
      };
    }

    // Ação padrão
    return {
      acao: 'Contato de relacionamento',
      motivo: 'Manter relacionamento ativo com o cliente'
    };
  }

  /**
   * Qualificar todos os clientes em lote
   */
  static async qualificarTodos() {
    try {
      console.log('[QUALIFICADOR] 🎯 Iniciando qualificação em lote...');

      const clientes = await base44.entities.Cliente.list('-updated_date', 500);
      
      let sucessos = 0;
      let erros = 0;

      for (const cliente of clientes) {
        try {
          await this.qualificarCliente(cliente.id);
          sucessos++;
          
          // Aguardar 100ms entre qualificações para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`[QUALIFICADOR] Erro ao qualificar ${cliente.id}:`, error);
          erros++;
        }
      }

      console.log(`[QUALIFICADOR] ✅ Qualificação concluída: ${sucessos} sucessos, ${erros} erros`);
      
      return { sucessos, erros, total: clientes.length };
    } catch (error) {
      console.error('[QUALIFICADOR] ❌ Erro na qualificação em lote:', error);
      return null;
    }
  }
}

export default QualificadorAutomatico;