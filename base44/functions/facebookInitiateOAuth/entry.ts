import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * INICIAR FLUXO OAUTH - Facebook Messenger
 * Gera URL de autorização para conectar Facebook Page
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integration_id } = await req.json();

    const clientId = Deno.env.get('META_APP_ID');
    
    if (!clientId) {
      return Response.json({ 
        error: 'Meta App ID not configured',
        details: 'Set META_APP_ID in environment variables'
      }, { status: 500 });
    }

    const url = new URL(req.url);
    const redirectUri = `${url.origin}/functions/facebookOAuthCallback`;

    // Scopes necessários para Facebook Messenger
    const scopes = [
      'pages_show_list',
      'pages_manage_metadata',
      'pages_messaging',
      'pages_read_engagement'
    ].join(',');

    // State pode conter integration_id para atualizar existente
    const state = integration_id || '';

    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    return Response.json({ 
      success: true,
      authorization_url: authUrl.toString()
    });

  } catch (error) {
    console.error('[FACEBOOK OAUTH INIT] Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});