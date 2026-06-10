import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * PUBLICAR CARROSSEL NO INSTAGRAM (Conector nativo Base44)
 * Recebe URLs de imagens (de Promoções oficiais ou mensagens etiquetadas)
 * e publica na conta Instagram Business conectada (@neuraltec.distribuicao).
 */

const GRAPH = 'https://graph.instagram.com';

async function aguardarContainer(containerId, accessToken, maxTentativas = 15) {
  for (let i = 0; i < maxTentativas; i++) {
    const r = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${accessToken}`);
    const d = await r.json();
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR') {
      throw new Error('Instagram rejeitou a mídia (verifique se o arquivo é público e em formato suportado: JPEG para foto, MP4/MOV para vídeo)');
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

    const { image_urls = [], video_url = null, caption = '', message_id = null, force = false } = await req.json();

    // Deduplicação: mensagem etiquetada já postada → bloqueia a menos que force=true
    if (message_id && !force) {
      const msgCheck = await base44.asServiceRole.entities.Message.get(message_id);
      if (msgCheck?.metadata?.instagram_posted_at) {
        const dataPost = new Date(msgCheck.metadata.instagram_posted_at).toLocaleString('pt-BR');
        return Response.json({
          success: false,
          skipped: true,
          duplicada: true,
          motivo: `Já publicada em ${dataPost}. Confirme a repostagem para publicar novamente.`,
          permalink: msgCheck.metadata.instagram_permalink || null
        });
      }
    }

    if (!video_url && (!Array.isArray(image_urls) || image_urls.length === 0)) {
      return Response.json({ error: 'Selecione ao menos 1 promoção com imagem ou vídeo' }, { status: 400 });
    }
    if (image_urls.length > 10) {
      return Response.json({ error: 'Máximo de 10 imagens por carrossel' }, { status: 400 });
    }

    // Token do conector nativo Instagram
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');

    // ID da conta Instagram Business
    const meRes = await fetch(`${GRAPH}/me?fields=id,username&access_token=${accessToken}`);
    const me = await meRes.json();
    if (!me.id) {
      return Response.json({ error: 'Falha ao identificar conta Instagram', details: me }, { status: 500 });
    }

    const legendaFinal = caption || '🔥 Ofertas NeuralTec Distribuição\n\n📲 Chama no direct ou WhatsApp!\n#neuraltec #tecnologia #ofertas';

    let creationId;

    if (video_url) {
      // Vídeo único → publicado como REELS (formato exigido pela API para vídeo no feed)
      const url = new URL(`${GRAPH}/${me.id}/media`);
      url.searchParams.set('media_type', 'REELS');
      url.searchParams.set('video_url', video_url);
      url.searchParams.set('caption', legendaFinal);
      url.searchParams.set('access_token', accessToken);
      const r = await fetch(url, { method: 'POST' });
      const d = await r.json();
      if (!d.id) {
        return Response.json({ error: 'Falha ao criar mídia de vídeo', details: d }, { status: 500 });
      }
      // Vídeo demora mais para processar
      await aguardarContainer(d.id, accessToken, 45);
      creationId = d.id;
    } else if (image_urls.length === 1) {
      // Post de imagem única
      const url = new URL(`${GRAPH}/${me.id}/media`);
      url.searchParams.set('image_url', image_urls[0]);
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
      for (let i = 0; i < image_urls.length; i++) {
        const url = new URL(`${GRAPH}/${me.id}/media`);
        url.searchParams.set('image_url', image_urls[i]);
        url.searchParams.set('is_carousel_item', 'true');
        url.searchParams.set('access_token', accessToken);
        const r = await fetch(url, { method: 'POST' });
        const d = await r.json();
        if (!d.id) {
          return Response.json({
            error: `Falha ao processar imagem ${i + 1} do carrossel`,
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

    const tipoPost = video_url ? 'reels' : (image_urls.length > 1 ? 'carrossel' : 'imagem');

    // Registrar rastreio na Message etiquetada (se origem for mensagem)
    if (message_id) {
      try {
        const msg = await base44.asServiceRole.entities.Message.get(message_id);
        await base44.asServiceRole.entities.Message.update(message_id, {
          metadata: {
            ...(msg?.metadata || {}),
            instagram_media_id: pubData.id,
            instagram_permalink: linkData.permalink || null,
            instagram_posted_at: new Date().toISOString(),
            instagram_post_tipo: tipoPost
          }
        });
      } catch (e) {
        console.error('[INSTAGRAM PUBLISH] Falha ao registrar rastreio na Message:', e.message);
      }
    }

    return Response.json({
      success: true,
      media_id: pubData.id,
      tipo_post: tipoPost,
      permalink: linkData.permalink || null,
      username: me.username,
      total_imagens: video_url ? 1 : image_urls.length,
      tipo: video_url ? 'video' : 'imagem'
    });

  } catch (error) {
    console.error('[INSTAGRAM PUBLISH] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});