import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CALLBACK OAUTH - Facebook Messenger
 * Troca código por access_token e busca Facebook Page
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
    const redirectUri = `${url.origin}/functions/facebookOAuthCallback`;

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
      console.error('[FACEBOOK OAUTH] Erro ao trocar código:', tokenData);
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
        details: 'User must manage at least one Facebook Page'
      }, { status: 400 });
    }

    // Pegar a primeira página (ou permitir seleção no futuro)
    const page = pagesData.data[0];
    const pageAccessToken = page.access_token;

    // Buscar informações da página
    const pageInfoResponse = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=name,picture&access_token=${pageAccessToken}`);
    const pageInfo = await pageInfoResponse.json();

    // Criar ou atualizar FacebookIntegration
    const integrationData = {
      nome_instancia: pageInfo.name || page.name,
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
      integration = await base44.entities.FacebookIntegration.update(state, integrationData);
    } else {
      integration = await base44.entities.FacebookIntegration.create(integrationData);
    }

    return Response.redirect(`${url.origin}/#/Comunicacao?tab=configuracoes&success=facebook_connected`, 302);

  } catch (error) {
    console.error('[FACEBOOK OAUTH] Erro:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});