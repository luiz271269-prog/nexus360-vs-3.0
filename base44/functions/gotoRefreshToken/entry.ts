import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * RENOVAR ACCESS TOKEN - GoTo Connect
 * Chamado automaticamente quando o token expira
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ error: 'Missing integration_id' }, { status: 400 });
    }

    // Buscar integração
    const integration = await base44.entities.GoToIntegration.get(integration_id);

    if (!integration) {
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }

    const clientId = Deno.env.get('GOTO_CLIENT_ID');
    const clientSecret = Deno.env.get('GOTO_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return Response.json({ 
        error: 'GoTo OAuth credentials not configured'
      }, { status: 500 });
    }

    console.log('[GOTO REFRESH] Renovando token para integration:', integration_id);

    // Renovar token usando refresh_token
    // grant_type=refresh_token conforme especificação OAuth2
    const tokenResponse = await fetch('https://authentication.logmeininc.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token
      })
    });

    console.log('[GOTO REFRESH] Response status:', tokenResponse.status);

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[GOTO REFRESH] Erro:', tokenData);
      
      // Marcar como desconectado se refresh falhar
      await base44.entities.GoToIntegration.update(integration_id, {
        status: 'erro_conexao'
      });

      return Response.json({ 
        error: 'Failed to refresh token',
        details: tokenData
      }, { status: 400 });
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

    console.log('[GOTO REFRESH] Token renovado - expira em:', expires_in, 'segundos');

    // Atualizar integração com novos tokens
    // Nota: refresh_token pode ou não vir na resposta (alguns provedores só enviam na primeira vez)
    await base44.entities.GoToIntegration.update(integration_id, {
      access_token: access_token,
      refresh_token: refresh_token || integration.refresh_token,
      token_expires_at: expiresAt,
      status: 'conectado',
      ultima_atividade: new Date().toISOString()
    });

    return Response.json({ 
      success: true,
      expires_at: expiresAt
    });

  } catch (error) {
    console.error('[GOTO REFRESH] Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});