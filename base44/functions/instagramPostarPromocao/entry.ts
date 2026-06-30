import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * POSTAR PROMOÇÃO NO INSTAGRAM
 * Dois modos:
 *  1. Manual (botão na tela): payload { promotion_id } — requer usuário autenticado
 *  2. Automação de entidade (Promotion create): payload { event, data } — auto-post
 *
 * Publica a imagem da promoção com legenda gerada (título + descrição + preço)
 * e grava instagram_media_id / instagram_permalink / instagram_posted_at na Promotion.
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
    const payload = await req.json();

    let promotionId;
    let isAutomation = false;
    let autorId = null;
    let autorNome = 'Automação';

    if (payload?.event?.entity_name === 'Promotion' && payload?.event?.entity_id) {
      // Disparado pela automação de entidade (nova promoção criada)
      isAutomation = true;
      promotionId = payload.event.entity_id;
    } else {
      // Disparo manual pelo botão — exige usuário logado
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      promotionId = payload?.promotion_id;
      autorId = user.id;
      autorNome = user.full_name || user.email || 'Usuário';
    }

    if (!promotionId) {
      return Response.json({ error: 'promotion_id obrigatório' }, { status: 400 });
    }

    const promos = await base44.asServiceRole.entities.Promotion.filter({ id: promotionId });
    const promo = promos[0];
    if (!promo) {
      return Response.json({ error: 'Promoção não encontrada' }, { status: 404 });
    }

    if (!promo.imagem_url) {
      return Response.json({ success: false, skipped: true, motivo: 'Promoção sem imagem' });
    }
    if (isAutomation && !promo.ativo) {
      return Response.json({ success: false, skipped: true, motivo: 'Promoção inativa' });
    }
    // Deduplicação: bloqueia repost a menos que force=true (manual confirmado)
    if (promo.instagram_posted_at && !payload?.force) {
      const dataPost = new Date(promo.instagram_posted_at).toLocaleString('pt-BR');
      return Response.json({
        success: false,
        skipped: true,
        duplicada: true,
        motivo: `Já publicada em ${dataPost}. Confirme a repostagem para publicar novamente.`,
        permalink: promo.instagram_permalink || null
      });
    }

    // Legenda: usa a aprovada pelo usuário (modal de IA) se enviada; senão monta a padrão.
    const limpar = (t) => (t || '').replace(/\{\{[^}]+\}\}/g, '').trim();
    let caption = limpar(payload?.caption);
    if (!caption) {
      const partes = [`🔥 ${limpar(promo.titulo)}`];
      if (limpar(promo.descricao_curta || promo.descricao)) {
        partes.push('', limpar(promo.descricao_curta || promo.descricao));
      }
      if (promo.price_info) partes.push('', `💰 ${promo.price_info}`);
      if (promo.validade) {
        partes.push(`⏰ Válido até ${new Date(promo.validade).toLocaleDateString('pt-BR')}`);
      }
      partes.push('', '📲 Chama no direct ou WhatsApp!', '#neuraltec #tecnologia #ofertas #promocao');
      caption = partes.join('\n');
    }

    // Conector nativo Instagram
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');

    const meRes = await fetch(`${GRAPH}/me?fields=id,username&access_token=${accessToken}`);
    const me = await meRes.json();
    if (!me.id) {
      return Response.json({ error: 'Falha ao identificar conta Instagram', details: me }, { status: 500 });
    }

    // Criar container da mídia (imagem ou vídeo/Reels)
    const isVideo = promo.tipo_midia === 'video';
    const mediaUrl = new URL(`${GRAPH}/${me.id}/media`);
    if (isVideo) {
      mediaUrl.searchParams.set('media_type', 'REELS');
      mediaUrl.searchParams.set('video_url', promo.imagem_url);
    } else {
      mediaUrl.searchParams.set('image_url', promo.imagem_url);
    }
    mediaUrl.searchParams.set('caption', caption);
    mediaUrl.searchParams.set('access_token', accessToken);
    const mediaRes = await fetch(mediaUrl, { method: 'POST' });
    const mediaData = await mediaRes.json();
    if (!mediaData.id) {
      return Response.json({ error: 'Falha ao criar mídia', details: mediaData }, { status: 500 });
    }
    // Vídeo demora mais para processar no Instagram
    await aguardarContainer(mediaData.id, accessToken, isVideo ? 45 : 15);

    // Publicar
    const pubUrl = new URL(`${GRAPH}/${me.id}/media_publish`);
    pubUrl.searchParams.set('creation_id', mediaData.id);
    pubUrl.searchParams.set('access_token', accessToken);
    const pubRes = await fetch(pubUrl, { method: 'POST' });
    const pubData = await pubRes.json();
    if (!pubData.id) {
      return Response.json({ error: 'Falha ao publicar', details: pubData }, { status: 500 });
    }

    // Permalink
    const linkRes = await fetch(`${GRAPH}/${pubData.id}?fields=permalink&access_token=${accessToken}`);
    const linkData = await linkRes.json();

    // Gravar rastreio na promoção
    await base44.asServiceRole.entities.Promotion.update(promo.id, {
      instagram_media_id: pubData.id,
      instagram_permalink: linkData.permalink || null,
      instagram_posted_at: new Date().toISOString(),
      instagram_posted_by_id: autorId,
      instagram_posted_by_name: autorNome
    });

    console.log(`[INSTAGRAM AUTO-POST] Promoção "${promo.titulo}" publicada (${isAutomation ? 'automação' : 'manual'}): ${linkData.permalink}`);

    return Response.json({
      success: true,
      media_id: pubData.id,
      permalink: linkData.permalink || null,
      username: me.username,
      posted_by_name: autorNome,
      modo: isAutomation ? 'automatico' : 'manual'
    });

  } catch (error) {
    console.error('[INSTAGRAM AUTO-POST] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});