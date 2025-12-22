import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * REGISTRAR WEBHOOK - GoTo Connect
 * Registra um notification channel para receber eventos de SMS e chamadas
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

    // Verificar se token está válido
    const now = new Date();
    const expiresAt = new Date(integration.token_expires_at);
    
    if (now >= expiresAt) {
      // Tentar renovar token
      const refreshResult = await base44.functions.invoke('gotoRefreshToken', {
        integration_id: integration_id
      });
      
      if (!refreshResult.data.success) {
        return Response.json({ 
          error: 'Token expired and refresh failed',
          details: refreshResult.data
        }, { status: 401 });
      }
      
      // Recarregar integração com token atualizado
      integration = await base44.entities.GoToIntegration.get(integration_id);
    }

    const url = new URL(req.url);
    const webhookUrl = `${url.origin}/api/functions/gotoWebhook`;

    // Criar notification channel
    const channelResponse = await fetch('https://api.goto.com/messaging/v1/notification-channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelType: 'webhook',
        config: {
          url: webhookUrl,
          events: [
            'message.received',    // SMS recebido
            'message.sent',        // SMS enviado
            'call.initiated',      // Chamada iniciada
            'call.answered',       // Chamada atendida
            'call.ended',          // Chamada encerrada
            'call.missed'          // Chamada perdida
          ]
        }
      })
    });

    const channelData = await channelResponse.json();

    if (!channelResponse.ok) {
      console.error('[GOTO WEBHOOK] Erro ao registrar:', channelData);
      return Response.json({ 
        error: 'Failed to register webhook',
        details: channelData
      }, { status: 400 });
    }

    // Salvar notification_channel_id na integração
    await base44.entities.GoToIntegration.update(integration_id, {
      notification_channel_id: channelData.id || channelData.channelId,
      webhook_url: webhookUrl,
      status: 'conectado',
      ultima_atividade: new Date().toISOString()
    });

    return Response.json({ 
      success: true,
      channel_id: channelData.id || channelData.channelId,
      webhook_url: webhookUrl
    });

  } catch (error) {
    console.error('[GOTO WEBHOOK REGISTER] Erro:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});