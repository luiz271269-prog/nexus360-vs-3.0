import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Endpoint público (consumido pelo app do site NeuralTec) que retorna o
// catálogo de produtos classificado: estoque próprio vs. portfólio/estoque de fornecedor.
// Segurança: mesma do getPromocoesPublicas — exige X-Promo-Token se NEXUS_PROMO_TOKEN estiver definido.

Deno.serve(async (req) => {
  try {
    const tokensValidos = [
      (Deno.env.get('NEXUS_PROMO_TOKEN') || '').trim(),
      (Deno.env.get('NEXUS_PROMOCAO_TOKEN') || '').trim()
    ].filter(Boolean);

    if (tokensValidos.length > 0) {
      let tokenRecebido = (req.headers.get('x-promo-token') || '').trim();
      if (!tokenRecebido) {
        try {
          const body = await req.clone().json();
          tokenRecebido = (body?.token || '').trim();
        } catch (_) { /* sem body JSON */ }
      }
      if (!tokensValidos.includes(tokenRecebido)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const base44 = createClientFromRequest(req);

    const produtos = await base44.asServiceRole.entities.Produto.filter(
      { ativo: true }, '-updated_date', 500
    );

    const hoje = new Date().toISOString().slice(0, 10);

    const catalogo = produtos.map(p => {
      const estoqueProprio = (p.origem_item || 'estoque_proprio') === 'estoque_proprio';
      const temEstoqueProprio = estoqueProprio && (p.estoque_atual || 0) > 0;
      const pautaVencida = !estoqueProprio && p.validade_pauta_ate && p.validade_pauta_ate < hoje;

      // classificacao: 'estoque' = pronta entrega (próprio) | 'portfolio' = sob encomenda/fornecedor
      const classificacao = temEstoqueProprio ? 'estoque' : 'portfolio';

      return {
        id: p.id,
        nome: p.nome,
        descricao: p.descricao || null,
        marca: p.marca || null,
        modelo: p.modelo || null,
        categoria: p.categoria || 'Outros',
        imagem_url: p.imagem_url || null,
        // Preço só é exposto quando a pauta está válida (portfolio vencido = sob consulta)
        preco: pautaVencida ? null : (p.preco_venda || null),
        classificacao,
        origem_estoque: estoqueProprio ? 'proprio' : 'fornecedor',
        fornecedor: estoqueProprio ? null : (p.fornecedor || null),
        prazo_entrega_dias: estoqueProprio ? null : (p.tempo_entrega_fornecedor_dias ?? null),
        disponibilidade: temEstoqueProprio
          ? `${p.estoque_atual} un. em estoque - pronta entrega`
          : (pautaVencida ? 'sob consulta' : 'disponível no fornecedor'),
        validade_pauta_ate: p.validade_pauta_ate || null,
        atualizado_em: p.updated_date
      };
    });

    return Response.json({
      success: true,
      total: catalogo.length,
      estoque_proprio: catalogo.filter(p => p.origem_estoque === 'proprio').length,
      portfolio_fornecedor: catalogo.filter(p => p.origem_estoque === 'fornecedor').length,
      produtos: catalogo,
      gerado_em: new Date().toISOString()
    }, {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});