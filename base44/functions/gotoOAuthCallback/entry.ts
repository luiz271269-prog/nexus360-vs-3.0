import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * CALLBACK OAUTH - GoTo Connect
 * Recebe o código de autorização e troca por access_token + refresh_token
 * Salva na entidade GoToIntegration
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
    const state = url.searchParams.get('state'); // Pode conter integration_id

    if (!code) {
      return Response.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    // Credenciais OAuth do GoTo (secrets configurados)
    const clientId = Deno.env.get('GOTO_CLIENT_ID');
    const clientSecret = Deno.env.get('GOTO_CLIENT_SECRET');
    
    // CRÍTICO: Redirect URI deve ser EXATAMENTE igual ao cadastrado no cliente OAuth da GoTo
    const redirectUri = `${url.origin}/functions/gotoOAuthCallback`;

    console.log('[GOTO OAUTH CALLBACK] Redirect URI:', redirectUri);
    console.log('[GOTO OAUTH CALLBACK] Code recebido:', code ? 'SIM' : 'NÃO');

    if (!clientId || !clientSecret) {
      return Response.json({ 
        error: 'GoTo OAuth credentials not configured',
        details: 'Set GOTO_CLIENT_ID and GOTO_CLIENT_SECRET in environment variables'
      }, { status: 500 });
    }

    // Trocar código por tokens (token exchange)
    // CRÍTICO: redirect_uri aqui deve ser idêntico ao usado no authorize e ao cadastrado
    const tokenResponse = await fetch('https://authentication.logmeininc.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    console.log('[GOTO OAUTH CALLBACK] Token response status:', tokenResponse.status);

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[GOTO OAUTH] Erro ao trocar código:', tokenData);
      return Response.json({ 
        error: 'Failed to exchange authorization code',
        details: tokenData
      }, { status: 400 });
    }

    const { access_token, refresh_token, expires_in, account_key } = tokenData;

    console.log('[GOTO OAUTH CALLBACK] Tokens obtidos com sucesso');
    console.log('[GOTO OAUTH CALLBACK] Expira em (segundos):', expires_in);

    // Buscar informações da conta usando o access_token (Bearer token)
    const accountResponse = await fetch('https://api.goto.com/admin/rest/v1/accounts/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const accountData = await accountResponse.json();
    
    console.log('[GOTO OAUTH CALLBACK] Account data:', accountData.accountName || 'N/A');

    // Criar ou atualizar GoToIntegration
    const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

    const integrationData = {
      nome_instancia: accountData.accountName || 'GoTo Connect',
      phone_number: accountData.phoneNumber || '',
      access_token: access_token,
      refresh_token: refresh_token,
      token_expires_at: expiresAt,
      account_key: account_key,
      status: 'conectado',
      ultima_atividade: new Date().toISOString(),
      scopes: tokenData.scope ? tokenData.scope.split(' ') : []
    };

    let integration;
    if (state) {
      // Atualizar integração existente
      integration = await base44.entities.GoToIntegration.update(state, integrationData);
    } else {
      // Criar nova integração
      integration = await base44.entities.GoToIntegration.create(integrationData);
    }

    // Redirecionar de volta para a página de configurações
    return Response.redirect(`${url.origin}/#/Comunicacao?tab=configuracoes&success=goto_connected`, 302);

  } catch (error) {
    console.error('[GOTO OAUTH] Erro:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});