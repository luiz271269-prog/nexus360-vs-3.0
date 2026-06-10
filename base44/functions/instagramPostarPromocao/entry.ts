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
    const payload = await req.json();

    let promotionId;
    let isAutomation = false;

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
    if (isAutomation && promo.instagram_posted_at) {
      return Response.json({ success: false, skipped: true, motivo: 'Já postada anteriormente' });
    }

    // Montar legenda (remove placeholders {{nome}} etc)
    const limpar = (t) => (t || '').replace(/\{\{[^}]+\}\}/g, '').trim();
    const partes = [`🔥 ${limpar(promo.titulo)}`];
    if (limpar(promo.descricao_curta || promo.descricao)) {
      partes.push('', limpar(promo.descricao_curta || promo.descricao));
    }
    if (promo.price_info) partes.push('', `💰 ${promo.price_info}`);
    if (promo.validade) {
      partes.push(`⏰ Válido até ${new Date(promo.validade).toLocaleDateString('pt-BR')}`);
    }
    partes.push('', '📲 Chama no direct ou WhatsApp!', '#neuraltec #tecnologia #ofertas #promocao');
    const caption = partes.join('\n');

    // Conector nativo Instagram
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');

    const meRes = await fetch(`${GRAPH}/me?fields=id,username&access_token=${accessToken}`);
    const me = await meRes.json();
    if (!me.id) {
      return Response.json({ error: 'Falha ao identificar conta Instagram', details: me }, { status: 500 });
    }

    // Criar container da imagem
    const mediaUrl = new URL(`${GRAPH}/${me.id}/media`);
    mediaUrl.searchParams.set('image_url', promo.imagem_url);
    mediaUrl.searchParams.set('caption', caption);
    mediaUrl.searchParams.set('access_token', accessToken);
    const mediaRes = await fetch(mediaUrl, { method: 'POST' });
    const mediaData = await mediaRes.json();
    if (!mediaData.id) {
      return Response.json({ error: 'Falha ao criar mídia', details: mediaData }, { status: 500 });
    }
    await aguardarContainer(mediaData.id, accessToken);

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
      instagram_posted_at: new Date().toISOString()
    });

    console.log(`[INSTAGRAM AUTO-POST] Promoção "${promo.titulo}" publicada (${isAutomation ? 'automação' : 'manual'}): ${linkData.permalink}`);

    return Response.json({
      success: true,
      media_id: pubData.id,
      permalink: linkData.permalink || null,
      username: me.username,
      modo: isAutomation ? 'automatico' : 'manual'
    });

  } catch (error) {
    console.error('[INSTAGRAM AUTO-POST] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});