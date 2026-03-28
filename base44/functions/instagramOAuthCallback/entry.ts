import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * CALLBACK OAUTH - Instagram (Meta Business)
 * Troca código por access_token e busca Instagram Business Account ID
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return Response.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    const clientId = Deno.env.get('META_APP_ID');
    const clientSecret = Deno.env.get('META_APP_SECRET');
    const redirectUri = `${url.origin}/functions/instagramOAuthCallback`;

    if (!clientId || !clientSecret) {
      return Response.json({ 
        error: 'Meta OAuth credentials not configured',
        details: 'Set META_APP_ID and META_APP_SECRET in environment variables'
      }, { status: 500 });
    }

    // Trocar código por access_token
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`;
    
    const tokenResponse = await fetch(tokenUrl, { method: 'GET' });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[INSTAGRAM OAUTH] Erro ao trocar código:', tokenData);
      return Response.json({ 
        error: 'Failed to exchange authorization code',
        details: tokenData
      }, { status: 400 });
    }

    const { access_token } = tokenData;

    // Trocar short-lived token por long-lived token (60 dias)
    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${access_token}`;
    
    const longLivedResponse = await fetch(longLivedUrl, { method: 'GET' });
    const longLivedData = await longLivedResponse.json();
    
    const finalToken = longLivedData.access_token || access_token;

    // Buscar páginas conectadas
    const pagesResponse = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${finalToken}`);
    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return Response.json({ 
        error: 'No Facebook Pages found',
        details: 'User must have a Facebook Page connected'
      }, { status: 400 });
    }

    // Pegar a primeira página
    const page = pagesData.data[0];
    const pageAccessToken = page.access_token;

    // Buscar Instagram Business Account conectado à página
    const igResponse = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${pageAccessToken}`);
    const igData = await igResponse.json();

    const igBusinessId = igData.instagram_business_account?.id;

    if (!igBusinessId) {
      return Response.json({ 
        error: 'No Instagram Business Account connected',
        details: 'Facebook Page must have an Instagram Business Account linked'
      }, { status: 400 });
    }

    // Buscar informações do perfil Instagram
    const profileResponse = await fetch(`https://graph.facebook.com/v21.0/${igBusinessId}?fields=username,profile_picture_url&access_token=${pageAccessToken}`);
    const profileData = await profileResponse.json();

    // Criar ou atualizar InstagramIntegration
    const integrationData = {
      nome_instancia: `@${profileData.username || 'instagram'}`,
      instagram_business_account_id: igBusinessId,
      page_id: page.id,
      access_token: pageAccessToken,
      status: 'conectado',
      ultima_atividade: new Date().toISOString(),
      estatisticas: {
        total_mensagens_enviadas: 0,
        total_mensagens_recebidas: 0,
        taxa_resposta_24h: 0,
        tempo_medio_resposta_minutos: 0
      }
    };

    let integration;
    if (state) {
      integration = await base44.entities.InstagramIntegration.update(state, integrationData);
    } else {
      integration = await base44.entities.InstagramIntegration.create(integrationData);
    }

    return Response.redirect(`${url.origin}/#/Comunicacao?tab=configuracoes&success=instagram_connected`, 302);

  } catch (error) {
    console.error('[INSTAGRAM OAUTH] Erro:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});