import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 AUTORIZAR OUTLOOK CALENDAR - OAUTH FLOW
// ═══════════════════════════════════════════════════════════════════════════
// Inicia fluxo OAuth para Microsoft Graph/Outlook Calendar
// Callback salva refresh_token no usuário
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    
    // CALLBACK: Trocar code por tokens
    if (code) {
      console.log(`[OUTLOOK-AUTH] 🔄 Processando callback OAuth...`);
      
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${Deno.env.get('MICROSOFT_TENANT_ID')}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('MICROSOFT_CLIENT_ID'),
            client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET'),
            code: code,
            redirect_uri: `${url.origin}/functions/authorizeOutlookCalendar`,
            grant_type: 'authorization_code',
            scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access'
          })
        }
      );
      
      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error(`[OUTLOOK-AUTH] ❌ Erro ao trocar code:`, error);
        
        return new Response(`
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h2>❌ Erro na autorização do Outlook</h2>
              <p>Não foi possível completar a autorização. Tente novamente.</p>
              <button onclick="window.close()">Fechar</button>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
      
      const tokenData = await tokenResponse.json();
      
      // Salvar refresh_token no usuário
      await base44.asServiceRole.entities.User.update(user.id, {
        'calendar_sync_config.outlook_calendar_enabled': true,
        'calendar_sync_config.outlook_refresh_token': tokenData.refresh_token,
        'calendar_sync_config.outlook_token_expires_at': new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      });
      
      console.log(`[OUTLOOK-AUTH] ✅ Autorização concluída para ${user.email}`);
      
      return new Response(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2>✅ Outlook Calendar Autorizado!</h2>
            <p>Seus eventos agora serão sincronizados com o Outlook.</p>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Fechar</button>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // INÍCIO: Redirecionar para Microsoft OAuth
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    const tenantId = Deno.env.get('MICROSOFT_TENANT_ID');
    const redirectUri = `${url.origin}/functions/authorizeOutlookCalendar`;
    
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent('https://graph.microsoft.com/Calendars.ReadWrite offline_access')}` +
      `&state=${user.id}`;
    
    console.log(`[OUTLOOK-AUTH] 🔗 Redirecionando para OAuth...`);
    
    return Response.redirect(authUrl, 302);
    
  } catch (error) {
    console.error('[OUTLOOK-AUTH] ❌ Erro:', error.message);
    
    return new Response(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2>❌ Erro</h2>
          <p>${error.message}</p>
          <button onclick="window.close()">Fechar</button>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
});