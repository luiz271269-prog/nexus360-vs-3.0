import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * PUBLICAR CARROSSEL NO INSTAGRAM (Conector nativo Base44)
 * Recebe produto_ids do CRM, monta carrossel com as imagens e publica
 * na conta Instagram Business conectada (@neuraltec.distribuicao).
 */

const GRAPH = 'https://graph.instagram.com';

async function aguardarContainer(containerId, accessToken) {
  for (let i = 0; i < 15; i++) {
    const r = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${accessToken}`);
    const d = await r.json();
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR') {
      throw new Error('Instagram rejeitou a mídia (verifique se a imagem é JPEG pública)');
    }
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error('Timeout aguardando processamento da mídia no Instagram');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { produto_ids = [], caption = '' } = await req.json();

    if (!Array.isArray(produto_ids) || produto_ids.length === 0) {
      return Response.json({ error: 'Selecione ao menos 1 produto' }, { status: 400 });
    }
    if (produto_ids.length > 10) {
      return Response.json({ error: 'Máximo de 10 imagens por carrossel' }, { status: 400 });
    }

    // Buscar produtos do CRM
    const produtos = await base44.asServiceRole.entities.Produto.filter({ id: { $in: produto_ids } });
    const comImagem = produtos.filter(p => p.imagem_url);

    if (comImagem.length === 0) {
      return Response.json({ error: 'Nenhum dos produtos selecionados possui imagem' }, { status: 400 });
    }

    // Token do conector nativo Instagram
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');

    // ID da conta Instagram Business
    const meRes = await fetch(`${GRAPH}/me?fields=id,username&access_token=${accessToken}`);
    const me = await meRes.json();
    if (!me.id) {
      return Response.json({ error: 'Falha ao identificar conta Instagram', details: me }, { status: 500 });
    }

    // Legenda padrão se não informada
    let legendaFinal = caption;
    if (!legendaFinal) {
      const linhas = comImagem.map(p => {
        const preco = p.preco_venda ? ` — R$ ${Number(p.preco_venda).toFixed(2)}` : '';
        return `✅ ${p.nome}${preco}`;
      });
      legendaFinal = `🔥 Ofertas NeuralTec Distribuição\n\n${linhas.join('\n')}\n\n📲 Chama no direct ou WhatsApp!\n#neuraltec #tecnologia #ofertas`;
    }

    let creationId;

    if (comImagem.length === 1) {
      // Post de imagem única
      const url = new URL(`${GRAPH}/${me.id}/media`);
      url.searchParams.set('image_url', comImagem[0].imagem_url);
      url.searchParams.set('caption', legendaFinal);
      url.searchParams.set('access_token', accessToken);
      const r = await fetch(url, { method: 'POST' });
      const d = await r.json();
      if (!d.id) {
        return Response.json({ error: 'Falha ao criar mídia', details: d }, { status: 500 });
      }
      await aguardarContainer(d.id, accessToken);
      creationId = d.id;
    } else {
      // Carrossel: criar containers filhos
      const childIds = [];
      for (const p of comImagem) {
        const url = new URL(`${GRAPH}/${me.id}/media`);
        url.searchParams.set('image_url', p.imagem_url);
        url.searchParams.set('is_carousel_item', 'true');
        url.searchParams.set('access_token', accessToken);
        const r = await fetch(url, { method: 'POST' });
        const d = await r.json();
        if (!d.id) {
          return Response.json({
            error: `Falha ao processar imagem do produto "${p.nome}"`,
            details: d
          }, { status: 500 });
        }
        childIds.push(d.id);
      }

      // Container do carrossel
      const carUrl = new URL(`${GRAPH}/${me.id}/media`);
      carUrl.searchParams.set('media_type', 'CAROUSEL');
      carUrl.searchParams.set('children', childIds.join(','));
      carUrl.searchParams.set('caption', legendaFinal);
      carUrl.searchParams.set('access_token', accessToken);
      const carRes = await fetch(carUrl, { method: 'POST' });
      const carData = await carRes.json();
      if (!carData.id) {
        return Response.json({ error: 'Falha ao criar carrossel', details: carData }, { status: 500 });
      }
      await aguardarContainer(carData.id, accessToken);
      creationId = carData.id;
    }

    // Publicar
    const pubUrl = new URL(`${GRAPH}/${me.id}/media_publish`);
    pubUrl.searchParams.set('creation_id', creationId);
    pubUrl.searchParams.set('access_token', accessToken);
    const pubRes = await fetch(pubUrl, { method: 'POST' });
    const pubData = await pubRes.json();
    if (!pubData.id) {
      return Response.json({ error: 'Falha ao publicar', details: pubData }, { status: 500 });
    }

    // Buscar permalink
    const linkRes = await fetch(`${GRAPH}/${pubData.id}?fields=permalink&access_token=${accessToken}`);
    const linkData = await linkRes.json();

    return Response.json({
      success: true,
      media_id: pubData.id,
      permalink: linkData.permalink || null,
      username: me.username,
      total_imagens: comImagem.length,
      produtos_sem_imagem: produtos.length - comImagem.length
    });

  } catch (error) {
    console.error('[INSTAGRAM PUBLISH] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});