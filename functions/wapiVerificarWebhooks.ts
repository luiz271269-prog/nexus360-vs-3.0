import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// W-API - VERIFICAR WEBHOOKS CONFIGURADOS
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Acesso negado - apenas administradores' 
      }, { status: 403 });
    }

    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ 
        success: false, 
        error: 'integration_id é obrigatório' 
      }, { status: 400 });
    }

    const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integration || integration.api_provider !== 'w_api') {
      return Response.json({ 
        success: false, 
        error: 'Integração W-API não encontrada' 
      }, { status: 404 });
    }

    const webhookUrl = `https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integration.api_key_provider}`
    };

    const baseUrl = integration.base_url_provider || 'https://api.w-api.app/v1';

    // Listar webhooks configurados
    const webhooksReq = await fetch(`${baseUrl}/instances/${integration.instance_id_provider}/webhooks`, {
      method: 'GET',
      headers
    });
    
    const webhooksRes = await webhooksReq.json();
    const webhooksAtuais = webhooksRes?.webhooks || [];
    
    const nossoWebhook = webhooksAtuais.find(w => 
      w.url === webhookUrl || w.url?.includes('webhookWapi')
    );

    return Response.json({
      success: true,
      integration: {
        id: integration.id,
        nome: integration.nome_instancia,
        instance_id: integration.instance_id_provider
      },
      webhooks_configurados: webhooksAtuais,
      nosso_webhook_encontrado: !!nossoWebhook,
      webhook_esperado: webhookUrl,
      webhook_atual: nossoWebhook || null,
      precisa_configurar: !nossoWebhook
    });

  } catch (error) {
    console.error('[WAPI-VERIFY] Erro:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});