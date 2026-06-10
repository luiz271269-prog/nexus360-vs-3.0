import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Endpoint público (consumido pelo app do site NeuralTec) que retorna a
// "Visão Combinada" de promoções: Promotion oficiais ativas + Messages etiquetadas 'promocao'.
// Segurança: se o secret NEXUS_PROMO_TOKEN estiver definido, exige header X-Promo-Token
// (ou ?token= no payload). Sem o secret, responde aberto (conteúdo é público de marketing).

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

    // 1. Promoções oficiais ativas
    const promocoes = await base44.asServiceRole.entities.Promotion.filter(
      { ativo: true }, '-created_date', 100
    );

    // 2. Mensagens etiquetadas como 'promocao'
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { categorias: 'promocao' }, '-created_date', 100
    );

    const oficiais = promocoes.map(p => ({
      id: p.id,
      origem: 'oficial',
      titulo: p.titulo,
      descricao: p.descricao,
      descricao_curta: p.descricao_curta || null,
      price_info: p.price_info || null,
      link_produto: p.link_produto || null,
      imagem_url: p.imagem_url || null,
      tipo_midia: p.tipo_midia || 'none',
      categoria: p.categoria || 'geral',
      validade: p.validade || null,
      produtos: p.produtos || [],
      created_date: p.created_date
    }));

    const etiquetadas = mensagens
      .filter(m => !m.metadata?.deleted)
      .map(m => ({
        id: m.id,
        origem: 'etiquetada',
        titulo: m.media_caption || m.content?.substring(0, 120) || 'Promoção',
        descricao: m.content || m.media_caption || '',
        descricao_curta: null,
        price_info: null,
        link_produto: null,
        imagem_url: ['image', 'video'].includes(m.media_type) ? m.media_url : null,
        tipo_midia: m.media_type === 'video' ? 'video' : (m.media_type === 'image' ? 'image' : 'none'),
        categoria: 'geral',
        validade: null,
        produtos: [],
        created_date: m.created_date
      }));

    const todas = [...oficiais, ...etiquetadas]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    return Response.json({
      success: true,
      total: todas.length,
      oficiais: oficiais.length,
      etiquetadas: etiquetadas.length,
      promocoes: todas,
      gerado_em: new Date().toISOString()
    }, {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});