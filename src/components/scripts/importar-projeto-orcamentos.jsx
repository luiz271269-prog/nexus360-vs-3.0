/**
 * Script de Importação do Projeto de Orçamentos Base44
 * 
 * Este script facilita a migração de dados e estruturas do projeto
 * https://app.base44.com/apps/688ba5d6f456445f29c31db7
 */

import { Cliente } from "@/entities/Cliente";
import { Produto } from "@/entities/Produto";
import { Orcamento } from "@/entities/Orcamento";

export class ImportadorProjetoOrcamentos {
  
  /**
   * Importa dados do projeto externo
   * @param {Object} dadosExternos - Dados exportados do projeto base44
   */
  static async importarDadosCompletos(dadosExternos) {
    const log = [];
    
    try {
      log.push("🚀 Iniciando importação do projeto de orçamentos...");

      // 1. Importar Produtos
      if (dadosExternos.produtos && Array.isArray(dadosExternos.produtos)) {
        log.push(`📦 Importando ${dadosExternos.produtos.length} produtos...`);
        
        for (const produto of dadosExternos.produtos) {
          try {
            const produtoAdaptado = this.adaptarProduto(produto);
            await Produto.create(produtoAdaptado);
            log.push(`✅ Produto importado: ${produto.nome}`);
          } catch (error) {
            log.push(`❌ Erro ao importar produto ${produto.nome}: ${error.message}`);
          }
        }
      }

      // 2. Importar/Sincronizar Clientes
      if (dadosExternos.clientes && Array.isArray(dadosExternos.clientes)) {
        log.push(`👥 Processando ${dadosExternos.clientes.length} clientes...`);
        
        for (const cliente of dadosExternos.clientes) {
          try {
            const clienteExistente = await Cliente.filter({ cnpj: cliente.cnpj });
            
            if (clienteExistente.length === 0) {
              const clienteAdaptado = this.adaptarCliente(cliente);
              await Cliente.create(clienteAdaptado);
              log.push(`✅ Cliente importado: ${cliente.nome || cliente.razao_social}`);
            } else {
              log.push(`ℹ️ Cliente já existe: ${cliente.nome || cliente.razao_social}`);
            }
          } catch (error) {
            log.push(`❌ Erro ao processar cliente: ${error.message}`);
          }
        }
      }

      // 3. Importar Orçamentos
      if (dadosExternos.orcamentos && Array.isArray(dadosExternos.orcamentos)) {
        log.push(`📋 Importando ${dadosExternos.orcamentos.length} orçamentos...`);
        
        for (const orcamento of dadosExternos.orcamentos) {
          try {
            const orcamentoAdaptado = this.adaptarOrcamento(orcamento);
            await Orcamento.create(orcamentoAdaptado);
            log.push(`✅ Orçamento importado: ${orcamento.numero_orcamento || orcamento.id}`);
          } catch (error) {
            log.push(`❌ Erro ao importar orçamento: ${error.message}`);
          }
        }
      }

      log.push("🎉 Importação concluída com sucesso!");
      return { sucesso: true, log };

    } catch (error) {
      log.push(`💥 Erro crítico na importação: ${error.message}`);
      return { sucesso: false, log, erro: error.message };
    }
  }

  /**
   * Adapta produto do formato externo para o formato local
   */
  static adaptarProduto(produtoExterno) {
    return {
      codigo: produtoExterno.codigo || produtoExterno.sku || `PROD-${Date.now()}`,
      nome: produtoExterno.nome || produtoExterno.produto || 'Produto sem nome',
      descricao: produtoExterno.descricao || produtoExterno.detalhes || '',
      categoria: produtoExterno.categoria || 'Outros',
      unidade_medida: produtoExterno.unidade || produtoExterno.unidade_medida || 'unidade',
      preco_custo: Number(produtoExterno.preco_custo || produtoExterno.custo || 0),
      preco_venda: Number(produtoExterno.preco_venda || produtoExterno.preco || produtoExterno.valor || 0),
      margem_lucro: Number(produtoExterno.margem || produtoExterno.margem_lucro || 0),
      estoque_atual: Number(produtoExterno.estoque || produtoExterno.quantidade || 0),
      estoque_minimo: Number(produtoExterno.estoque_minimo || 1),
      fornecedor: produtoExterno.fornecedor || produtoExterno.supplier || '',
      observacoes: produtoExterno.observacoes || produtoExterno.notas || '',
      ativo: produtoExterno.ativo !== false, // Default true
      imagem_url: produtoExterno.imagem || produtoExterno.foto || produtoExterno.imagem_url || ''
    };
  }

  /**
   * Adapta cliente do formato externo para o formato local
   */
  static adaptarCliente(clienteExterno) {
    return {
      razao_social: clienteExterno.razao_social || clienteExterno.nome || clienteExterno.empresa || 'Empresa',
      nome_fantasia: clienteExterno.nome_fantasia || clienteExterno.fantasia || '',
      cnpj: clienteExterno.cnpj || clienteExterno.documento || '',
      telefone: clienteExterno.telefone || clienteExterno.fone || '',
      email: clienteExterno.email || clienteExterno.contato || '',
      endereco: clienteExterno.endereco || clienteExterno.address || '',
      vendedor_responsavel: clienteExterno.vendedor || clienteExterno.vendedor_responsavel || 'Não atribuído',
      classificacao: clienteExterno.classificacao || 'B - Médio Potencial',
      segmento: clienteExterno.segmento || 'PME',
      status: clienteExterno.status || 'Ativo',
      valor_recorrente_mensal: Number(clienteExterno.valor_mensal || clienteExterno.ticket_medio || 0),
      observacoes: clienteExterno.observacoes || clienteExterno.notas || ''
    };
  }

  /**
   * Adapta orçamento do formato externo para o formato local
   */
  static adaptarOrcamento(orcamentoExterno) {
    return {
      numero_orcamento: orcamentoExterno.numero || orcamentoExterno.numero_orcamento || `ORC-${Date.now()}`,
      cliente_nome: orcamentoExterno.cliente || orcamentoExterno.cliente_nome || 'Cliente não informado',
      vendedor: orcamentoExterno.vendedor || orcamentoExterno.usuario || 'Vendedor não informado',
      data_orcamento: orcamentoExterno.data || orcamentoExterno.data_orcamento || new Date().toISOString().slice(0, 10),
      valor_total: Number(orcamentoExterno.total || orcamentoExterno.valor_total || orcamentoExterno.valor || 0),
      status: orcamentoExterno.status || 'Em Aberto',
      probabilidade: orcamentoExterno.probabilidade || 'Média',
      prazo_validade: orcamentoExterno.validade || orcamentoExterno.prazo_validade || '',
      condicao_pagamento: orcamentoExterno.pagamento || orcamentoExterno.condicoes || '',
      produtos: this.adaptarProdutosOrcamento(orcamentoExterno.itens || orcamentoExterno.produtos || []),
      observacoes: orcamentoExterno.observacoes || orcamentoExterno.notas || ''
    };
  }

  /**
   * Adapta produtos do orçamento
   */
  static adaptarProdutosOrcamento(produtosExternos) {
    if (!Array.isArray(produtosExternos)) return [];
    
    return produtosExternos.map(item => ({
      codigo: item.codigo || item.sku || '',
      nome: item.nome || item.produto || item.descricao || 'Item',
      descricao: item.descricao || item.detalhes || '',
      quantidade: Number(item.quantidade || item.qtd || 1),
      valor_unitario: Number(item.valor_unitario || item.preco || item.valor || 0),
      valor_total: Number(item.total || item.valor_total || (item.quantidade * item.valor_unitario) || 0),
      observacoes: item.observacoes || item.notas || ''
    }));
  }

  /**
   * Gera relatório de compatibilidade
   */
  static async gerarRelatorioCompatibilidade(dadosExternos) {
    const relatorio = {
      timestamp: new Date().toISOString(),
      compatibilidade: {},
      recomendacoes: [],
      estatisticas: {}
    };

    // Analisar produtos
    if (dadosExternos.produtos) {
      relatorio.estatisticas.produtos = dadosExternos.produtos.length;
      relatorio.compatibilidade.produtos = "✅ Compatível";
      
      const produtosSemCodigo = dadosExternos.produtos.filter(p => !p.codigo && !p.sku);
      if (produtosSemCodigo.length > 0) {
        relatorio.recomendacoes.push(`⚠️ ${produtosSemCodigo.length} produtos sem código serão gerados automaticamente`);
      }
    }

    // Analisar clientes
    if (dadosExternos.clientes) {
      relatorio.estatisticas.clientes = dadosExternos.clientes.length;
      relatorio.compatibilidade.clientes = "✅ Compatível";
      
      const clientesSemCNPJ = dadosExternos.clientes.filter(c => !c.cnpj && !c.documento);
      if (clientesSemCNPJ.length > 0) {
        relatorio.recomendacoes.push(`⚠️ ${clientesSemCNPJ.length} clientes sem CNPJ podem gerar duplicatas`);
      }
    }

    // Analisar orçamentos
    if (dadosExternos.orcamentos) {
      relatorio.estatisticas.orcamentos = dadosExternos.orcamentos.length;
      relatorio.compatibilidade.orcamentos = "✅ Compatível";
      
      const orcamentosSemNumero = dadosExternos.orcamentos.filter(o => !o.numero && !o.numero_orcamento);
      if (orcamentosSemNumero.length > 0) {
        relatorio.recomendacoes.push(`⚠️ ${orcamentosSemNumero.length} orçamentos receberão numeração automática`);
      }
    }

    return relatorio;
  }
}