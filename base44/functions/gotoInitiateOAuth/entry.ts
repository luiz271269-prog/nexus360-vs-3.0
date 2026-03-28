import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * INICIAR FLUXO OAUTH - GoTo Connect
 * Gera URL de autorização para o usuário conectar sua conta GoTo
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integration_id } = await req.json();

    const clientId = Deno.env.get('GOTO_CLIENT_ID');
    
    if (!clientId) {
      return Response.json({ 
        error: 'GoTo Client ID not configured',
        details: 'Set GOTO_CLIENT_ID in environment variables'
      }, { status: 500 });
    }

    const url = new URL(req.url);
    const redirectUri = `${url.origin}/functions/gotoOAuthCallback`;

    console.log('[GOTO OAUTH INIT] Redirect URI:', redirectUri);

    // Scopes completos para SMS, eventos de chamada, webhooks e leitura
    // CRÍTICO: Estes scopes devem corresponder aos configurados no cadastro do cliente OAuth
    const scopes = [
      'messaging.v1.send',
      'messaging.v1.read',
      'messaging.v1.notifications.manage',
      'call-events.v1.events.read',
      'call-events.v1.notifications.manage',
      'users.v1.read',
      'users.v1.lines.read'
    ].join(' ');

    // State pode conter integration_id para atualizar existente
    const state = integration_id || '';

    const authUrl = new URL('https://authentication.logmeininc.com/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    return Response.json({ 
      success: true,
      authorization_url: authUrl.toString()
    });

  } catch (error) {
    console.error('[GOTO OAUTH INIT] Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});