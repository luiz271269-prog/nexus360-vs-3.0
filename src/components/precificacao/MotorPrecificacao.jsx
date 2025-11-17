/**
 * MOTOR DE PRECIFICAÇÃO INTELIGENTE
 * Sistema especializado para cálculo de custos reais e preços de venda otimizados
 * 
 * Como especialista em custos comerciais, este motor considera:
 * - Conversão de moedas (USD/EUR → BRL)
 * - Fretes nacionais e internacionais
 * - Impostos diferenciados por origem
 * - Custos operacionais
 * - Margens por segmento de cliente
 * - Análise de competitividade
 */

import { ConfiguracaoPrecificacao } from "@/entities/ConfiguracaoPrecificacao";

export class MotorPrecificacao {
  
  /**
   * Calcula o custo real de um produto considerando todos os fatores
   */
  static async calcularCustoReal(produto, configuracao = null) {
    const config = configuracao || await this.obterConfiguracaoAtiva();
    
    if (!config) {
      throw new Error('Configuração de precificação não encontrada');
    }

    const resultado = {
      produto_id: produto.id || null,
      nome_produto: produto.nome,
      
      // Preço base do fornecedor
      preco_fornecedor: produto.preco_original || produto.preco_custo || 0,
      moeda_original: produto.moeda_original || 'BRL',
      
      // Cálculos detalhados
      conversao_moeda: 0,
      custo_frete: 0,
      custo_impostos: 0,
      custo_operacional: 0,
      custo_total: 0,
      
      // Preços sugeridos por segmento
      preco_varejo: 0,
      preco_atacado: 0,
      preco_corporativo: 0,
      
      // Análises
      margem_real_varejo: 0,
      margem_real_atacado: 0,
      margem_real_corporativo: 0,
      
      // Competitividade
      preco_competitivo: true,
      observacoes: []
    };

    let custoBase = resultado.preco_fornecedor;

    // 1. CONVERSÃO DE MOEDA
    if (resultado.moeda_original === 'USD') {
      custoBase = custoBase * config.taxa_cambio_usd;
      resultado.conversao_moeda = custoBase - resultado.preco_fornecedor;
      resultado.observacoes.push(`Convertido de USD (taxa: ${config.taxa_cambio_usd})`);
    } else if (resultado.moeda_original === 'EUR') {
      custoBase = custoBase * config.taxa_cambio_eur;
      resultado.conversao_moeda = custoBase - resultado.preco_fornecedor;
      resultado.observacoes.push(`Convertido de EUR (taxa: ${config.taxa_cambio_eur})`);
    }

    // 2. CUSTO DE FRETE
    const isImportado = resultado.moeda_original !== 'BRL' || 
                       produto.pais_origem && produto.pais_origem !== 'Brasil';
    
    const percentualFrete = isImportado ? 
      config.percentual_frete_importado : 
      config.percentual_frete_nacional;
    
    resultado.custo_frete = custoBase * (percentualFrete / 100);
    custoBase += resultado.custo_frete;

    // 3. IMPOSTOS
    const percentualImpostos = isImportado ? 
      config.percentual_impostos_importados : 
      config.percentual_impostos_nacionais;
    
    resultado.custo_impostos = custoBase * (percentualImpostos / 100);
    custoBase += resultado.custo_impostos;

    // 4. CUSTO OPERACIONAL
    resultado.custo_operacional = custoBase * (config.custo_operacional_percentual / 100);
    custoBase += resultado.custo_operacional;

    resultado.custo_total = custoBase;

    // 5. PREÇOS DE VENDA POR SEGMENTO
    resultado.preco_varejo = custoBase * (1 + config.margem_varejo / 100);
    resultado.preco_atacado = custoBase * (1 + config.margem_atacado / 100);
    resultado.preco_corporativo = custoBase * (1 + config.margem_corporativo / 100);

    // 6. CÁLCULO DAS MARGENS REAIS
    resultado.margem_real_varejo = ((resultado.preco_varejo - custoBase) / resultado.preco_varejo * 100);
    resultado.margem_real_atacado = ((resultado.preco_atacado - custoBase) / resultado.preco_atacado * 100);
    resultado.margem_real_corporativo = ((resultado.preco_corporativo - custoBase) / resultado.preco_corporativo * 100);

    // 7. ANÁLISE DE COMPETITIVIDADE
    if (produto.preco_mercado && produto.preco_mercado > 0) {
      if (resultado.preco_varejo > produto.preco_mercado * 1.15) {
        resultado.preco_competitivo = false;
        resultado.observacoes.push('Preço 15% acima do mercado - revisar margem');
      }
    }

    // 8. VERIFICAÇÕES DE SEGURANÇA
    if (resultado.margem_real_varejo < 15) {
      resultado.observacoes.push('⚠️ Margem varejo baixa (<15%)');
    }
    
    if (resultado.preco_varejo / resultado.preco_fornecedor < config.markup_minimo) {
      resultado.observacoes.push(`⚠️ Markup abaixo do mínimo (${config.markup_minimo})`);
    }

    return resultado;
  }

  /**
   * Simula diferentes cenários de precificação
   */
  static async simularCenarios(produto, cenarios = {}) {
    const config = await this.obterConfiguracaoAtiva();
    const resultados = {};

    // Cenário base
    resultados.atual = await this.calcularCustoReal(produto, config);

    // Cenário com desconto máximo
    if (cenarios.com_desconto) {
      const configDesconto = { ...config };
      configDesconto.margem_varejo = config.margem_varejo - config.desconto_maximo;
      configDesconto.margem_atacado = config.margem_atacado - config.desconto_maximo;
      configDesconto.margem_corporativo = config.margem_corporativo - config.desconto_maximo;
      
      resultados.com_desconto = await this.calcularCustoReal(produto, configDesconto);
    }

    // Cenário com câmbio +10%
    if (cenarios.cambio_alta && produto.moeda_original !== 'BRL') {
      const configCambio = { ...config };
      configCambio.taxa_cambio_usd = config.taxa_cambio_usd * 1.1;
      configCambio.taxa_cambio_eur = config.taxa_cambio_eur * 1.1;
      
      resultados.cambio_alta = await this.calcularCustoReal(produto, configCambio);
    }

    // Cenário otimista (margens +20%)
    if (cenarios.otimista) {
      const configOtimista = { ...config };
      configOtimista.margem_varejo = config.margem_varejo * 1.2;
      configOtimista.margem_atacado = config.margem_atacado * 1.2;
      configOtimista.margem_corporativo = config.margem_corporativo * 1.2;
      
      resultados.otimista = await this.calcularCustoReal(produto, configOtimista);
    }

    return resultados;
  }

  /**
   * Calcula preço para orçamento baseado no segmento do cliente
   */
  static async calcularPrecoOrcamento(produto, segmentoCliente = 'varejo', quantidadeDesconto = 0) {
    const resultado = await this.calcularCustoReal(produto);
    
    let precoBase;
    switch (segmentoCliente.toLowerCase()) {
      case 'atacado':
        precoBase = resultado.preco_atacado;
        break;
      case 'corporativo':
        precoBase = resultado.preco_corporativo;
        break;
      default:
        precoBase = resultado.preco_varejo;
    }

    // Desconto por quantidade
    let descontoQuantidade = 0;
    if (quantidadeDesconto >= 10) descontoQuantidade = 5;
    if (quantidadeDesconto >= 50) descontoQuantidade = 10;
    if (quantidadeDesconto >= 100) descontoQuantidade = 15;

    const precoFinal = precoBase * (1 - descontoQuantidade / 100);
    const margemFinal = ((precoFinal - resultado.custo_total) / precoFinal) * 100;

    return {
      ...resultado,
      preco_base: precoBase,
      desconto_quantidade: descontoQuantidade,
      preco_final: precoFinal,
      margem_final: margemFinal,
      rentavel: margemFinal >= 10 // Mínimo 10% de margem
    };
  }

  /**
   * Análise de portfólio de produtos
   */
  static async analisarPortfolio(produtos) {
    const analises = [];
    let totalCusto = 0;
    let totalVenda = 0;

    for (const produto of produtos) {
      const analise = await this.calcularCustoReal(produto);
      analises.push(analise);
      totalCusto += analise.custo_total;
      totalVenda += analise.preco_varejo;
    }

    const margemMediaPortfolio = ((totalVenda - totalCusto) / totalVenda) * 100;

    // Classificação ABC por margem
    const produtosOrdenados = analises.sort((a, b) => b.margem_real_varejo - a.margem_real_varejo);
    const total = produtosOrdenados.length;
    
    produtosOrdenados.forEach((produto, index) => {
      if (index < total * 0.2) produto.classificacao_margem = 'A';
      else if (index < total * 0.5) produto.classificacao_margem = 'B';
      else produto.classificacao_margem = 'C';
    });

    return {
      produtos: analises,
      resumo: {
        total_produtos: produtos.length,
        custo_total_portfolio: totalCusto,
        valor_total_portfolio: totalVenda,
        margem_media_portfolio: margemMediaPortfolio,
        produtos_alta_margem: analises.filter(p => p.margem_real_varejo >= 35).length,
        produtos_baixa_margem: analises.filter(p => p.margem_real_varejo < 15).length,
        produtos_nao_competitivos: analises.filter(p => !p.preco_competitivo).length
      }
    };
  }

  /**
   * Obtém a configuração ativa de precificação
   */
  static async obterConfiguracaoAtiva() {
    try {
      const configs = await ConfiguracaoPrecificacao.filter({ ativa: true });
      if (configs.length > 0) {
        return configs[0];
      }
      
      // Se não houver configuração, criar uma padrão
      return await this.criarConfiguracaoPadrao();
    } catch (error) {
      console.error('Erro ao obter configuração:', error);
      return await this.criarConfiguracaoPadrao();
    }
  }

  /**
   * Cria configuração padrão de precificação
   */
  static async criarConfiguracaoPadrao() {
    const configPadrao = {
      nome_configuracao: 'Configuração Padrão',
      ativa: true,
      taxa_cambio_usd: 5.20,
      taxa_cambio_eur: 5.50,
      percentual_frete_nacional: 8,
      percentual_frete_importado: 20,
      percentual_impostos_nacionais: 18,
      percentual_impostos_importados: 35,
      custo_operacional_percentual: 8,
      margem_varejo: 40,
      margem_atacado: 25,
      margem_corporativo: 50,
      desconto_maximo: 15,
      markup_minimo: 1.30,
      data_atualizacao_cambio: new Date().toISOString(),
      observacoes: 'Configuração automática criada pelo sistema'
    };

    try {
      return await ConfiguracaoPrecificacao.create(configPadrao);
    } catch (error) {
      console.error('Erro ao criar configuração padrão:', error);
      return configPadrao; // Retorna sem salvar em caso de erro
    }
  }

  /**
   * Atualiza taxas de câmbio (integração futura com API de cotação)
   */
  static async atualizarTaxasCambio() {
    // Placeholder para integração com API de cotação
    // Por enquanto, retorna taxas fixas atualizadas manualmente
    
    const config = await this.obterConfiguracaoAtiva();
    if (config && config.id) {
      await ConfiguracaoPrecificacao.update(config.id, {
        data_atualizacao_cambio: new Date().toISOString()
      });
    }
    
    return {
      usd: config?.taxa_cambio_usd || 5.20,
      eur: config?.taxa_cambio_eur || 5.50,
      atualizado_em: new Date().toISOString()
    };
  }
}