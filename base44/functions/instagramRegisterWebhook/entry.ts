import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * REGISTRAR WEBHOOK - Instagram
 * Subscreve a página aos eventos de mensagens do Instagram
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
    const integration = await base44.entities.InstagramIntegration.get(integration_id);

    if (!integration) {
      return Response.json({ error: 'Integration not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const webhookUrl = `${url.origin}/functions/instagramWebhook`;

    // Subscrever a página aos eventos de mensagens do Instagram
    const subscribeResponse = await fetch(
      `https://graph.facebook.com/v21.0/${integration.page_id}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscribed_fields: ['messages', 'messaging_postbacks', 'message_reads'],
          access_token: integration.access_token
        })
      }
    );

    const subscribeData = await subscribeResponse.json();

    if (!subscribeResponse.ok) {
      console.error('[INSTAGRAM WEBHOOK] Erro ao subscrever:', subscribeData);
      return Response.json({ 
        error: 'Failed to subscribe to webhook',
        details: subscribeData
      }, { status: 400 });
    }

    // Atualizar integração
    await base44.entities.InstagramIntegration.update(integration_id, {
      webhook_url: webhookUrl,
      status: 'conectado',
      ultima_atividade: new Date().toISOString()
    });

    return Response.json({ 
      success: true,
      webhook_url: webhookUrl,
      subscribed: subscribeData.success
    });

  } catch (error) {
    console.error('[INSTAGRAM WEBHOOK REGISTER] Erro:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});