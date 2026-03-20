import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// RESUMO DE COMPRAS DIÁRIO v1.0
// ============================================================================
// Migração da skill run.js/run.py (habilidade resumo_compras)
// Executa 1x ao dia — compila pedidos/compras do dia anterior e envia
// resumo estruturado para o setor de compras/fornecedor via nexusNotificar.
// ============================================================================

Deno.serve(async (req) => {
  // ✅ FIX: Em contexto agendado, usar createClientFromRequest com req vazio
  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    console.error('[RESUMO-COMPRAS] ❌ Falha ao criar cliente:', e.message);
    return Response.json({ success: false, error: 'SDK initialization failed' }, { status: 500 });
  }
  const agora = new Date();

  try {

    console.log('[RESUMO-COMPRAS] 📦 Iniciando resumo diário de compras...');

    // Janela: últimas 24h
    const inicio24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const hoje = agora.toISOString().split('T')[0];

    // 1. Buscar vendas do dia anterior
    const vendas = await base44.asServiceRole.entities.Venda.filter(
      { data_venda: { $gte: inicio24h } },
      '-data_venda',
      500
    );

    // 2. Buscar orçamentos aprovados / em negociação recentes
    const orcamentos = await base44.asServiceRole.entities.Orcamento.filter(
      {
        status: { $in: ['aprovado', 'negociando', 'liberado'] },
        updated_date: { $gte: new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString() }
      },
      '-updated_date',
      200
    );

    // 3. Consolidar produtos mais vendidos
    const produtosContagem = {};
    let totalFaturamento = 0;

    for (const v of vendas) {
      totalFaturamento += v.valor_total || 0;
      if (Array.isArray(v.produtos)) {
        for (const p of v.produtos) {
          const nome = p.nome || 'Produto desconhecido';
          if (!produtosContagem[nome]) produtosContagem[nome] = { qtd: 0, valor: 0 };
          produtosContagem[nome].qtd += p.quantidade || 1;
          produtosContagem[nome].valor += p.valor_total || 0;
        }
      }
    }

    const topProdutos = Object.entries(produtosContagem)
      .sort((a, b) => b[1].qtd - a[1].qtd)
      .slice(0, 10);

    // 4. Consolidar por vendedor
    const porVendedor = {};
    for (const v of vendas) {
      const vend = v.vendedor || 'N/A';
      if (!porVendedor[vend]) porVendedor[vend] = { qtd: 0, valor: 0 };
      porVendedor[vend].qtd++;
      porVendedor[vend].valor += v.valor_total || 0;
    }

    const rankVendedores = Object.entries(porVendedor)
      .sort((a, b) => b[1].valor - a[1].valor)
      .slice(0, 5);

    // 5. Montar mensagem de resumo
    const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const linhasProdutos = topProdutos.length > 0
      ? topProdutos.map(([nome, d]) => `  • ${nome}: ${d.qtd}x (${formatBRL(d.valor)})`).join('\n')
      : '  Nenhum produto vendido no período';

    const linhasVendedores = rankVendedores.length > 0
      ? rankVendedores.map(([nome, d]) => `  🥇 ${nome}: ${d.qtd} venda(s) — ${formatBRL(d.valor)}`).join('\n')
      : '  Nenhuma venda registrada';

    const orcsPendentes = orcamentos.filter(o => o.status === 'negociando').length;
    const orcsAprovados = orcamentos.filter(o => o.status === 'aprovado').length;

    const msg =
      `📦 *Resumo de Compras/Vendas — ${hoje}*\n\n` +
      `📊 *Totais do Dia:*\n` +
      `  • Vendas registradas: *${vendas.length}*\n` +
      `  • Faturamento total: *${formatBRL(totalFaturamento)}*\n` +
      `  • Orçamentos aprovados: *${orcsAprovados}*\n` +
      `  • Orçamentos em negociação: *${orcsPendentes}*\n\n` +
      `🏆 *Top Vendedores:*\n${linhasVendedores}\n\n` +
      `📋 *Produtos Mais Vendidos:*\n${linhasProdutos}\n\n` +
      `_Gerado automaticamente em ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (horário de Brasília)_`;

    // 6. Enviar via nexusNotificar → setor fornecedor + setor vendas (com fallback se falhar)
    const notificacoes = await Promise.allSettled([
      base44.asServiceRole.functions.invoke('nexusNotificar', {
        setor: 'fornecedor',
        conteudo: msg,
        metadata: { resumo_compras: true, data: hoje }
      }).catch(e => {
        console.warn(`[RESUMO-COMPRAS] ⚠️ Erro ao notificar fornecedor: ${e.message}`);
        throw e;
      }),
      base44.asServiceRole.functions.invoke('nexusNotificar', {
        setor: 'vendas',
        conteudo: msg,
        metadata: { resumo_compras: true, data: hoje }
      }).catch(e => {
        console.warn(`[RESUMO-COMPRAS] ⚠️ Erro ao notificar vendas: ${e.message}`);
        throw e;
      })
    ]);
    
    const notificacoesFalhadas = notificacoes.filter(n => n.status === 'rejected').length;
    if (notificacoesFalhadas > 0) {
      console.warn(`[RESUMO-COMPRAS] ⚠️ ${notificacoesFalhadas} notificação(ões) falharam`);
    }

    console.log(`[RESUMO-COMPRAS] ✅ Resumo enviado: ${vendas.length} vendas, ${formatBRL(totalFaturamento)}`);

    return Response.json({
      success: true,
      timestamp: agora.toISOString(),
      vendas_registradas: vendas.length,
      faturamento_total: totalFaturamento,
      orcamentos_aprovados: orcsAprovados,
      orcamentos_negociando: orcsPendentes,
      top_produtos: topProdutos.length
    });

  } catch (error) {
    console.error('[RESUMO-COMPRAS] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});