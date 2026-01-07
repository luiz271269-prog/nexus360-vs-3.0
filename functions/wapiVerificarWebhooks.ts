import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// W-API - VERIFICAR WEBHOOKS CONFIGURADOS (v2.0 Robusta)
// ============================================================================

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Acesso negado - apenas administradores' 
      }, { status: 403, headers: corsHeaders });
    }

    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ 
        success: false, 
        error: 'integration_id é obrigatório' 
      }, { status: 400, headers: corsHeaders });
    }

    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ id: integration_id });
    const integration = integrations[0];

    if (!integration || integration.api_provider !== 'w_api') {
      return Response.json({ 
        success: false, 
        error: 'Integração W-API não encontrada' 
      }, { status: 404, headers: corsHeaders });
    }

    const expectedWebhookUrl = integration.webhook_url || 
      `https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integration.api_key_provider}`
    };

    const baseUrl = integration.base_url_provider || 'https://api.w-api.app/v1';

    console.log(`[WAPI-VERIFY] Consultando info da instância: ${integration.instance_id_provider}`);

    // ✅ USAR /instance/info (retorna TODA configuração, incluindo webhooks)
    const infoReq = await fetch(`${baseUrl}/instance/info?instanceId=${integration.instance_id_provider}`, {
      method: 'GET',
      headers
    });
    
    if (!infoReq.ok) {
      const errorText = await infoReq.text();
      console.error('[WAPI-VERIFY] Erro ao buscar info:', infoReq.status, errorText);

      // ✅ NÃO retornar 500 (erro de servidor), mas 200 com success:false
      return Response.json({
        success: false,
        error: `W-API retornou erro ${infoReq.status}: ${errorText.substring(0, 200)}`,
        raw_error: errorText,
        status_code: infoReq.status
      }, { status: 200, headers: corsHeaders });
    }
    
    const infoData = await infoReq.json();
    console.log('[WAPI-VERIFY] Dados recebidos:', JSON.stringify(infoData).substring(0, 300));
    
    const config = infoData.instance || infoData || {};
    
    // ✅ MAPEAMENTO ROBUSTO (camelCase + snake_case + variações)
    const normalize = (url) => (url || '').replace(/\/+$/, '').trim();
    const expected = normalize(expectedWebhookUrl);
    
    const webhookRecebimento = normalize(
      config.webhookReceivedUrl || config.webhook_received_url || 
      config.webhookReceived || config.received_url || ''
    );
    
    const webhookEntrega = normalize(
      config.webhookDeliveryUrl || config.webhook_delivery_url || 
      config.webhookDelivered || config.delivery_url || 
      config.webhookAckUrl || config.webhook_ack_url || ''
    );
    
    const webhookConexao = normalize(
      config.webhookStatusUrl || config.webhook_status_url || 
      config.webhookDisconnectedUrl || config.webhook_disconnected_url ||
      config.webhookConnectionUpdate || config.connection_update_url || ''
    );
    
    const webhooks = {
      message: webhookRecebimento === expected || webhookRecebimento.includes('webhookWapi'),
      message_ack: webhookEntrega === expected || webhookEntrega.includes('webhookWapi'),
      connection_update: webhookConexao === expected || webhookConexao.includes('webhookWapi')
    };

    const todosOk = webhooks.message && webhooks.message_ack && webhooks.connection_update;

    return Response.json({
      success: true,
      webhooks,
      todosOk,
      integration: {
        id: integration.id,
        nome: integration.nome_instancia,
        instance_id: integration.instance_id_provider
      },
      urls_encontradas: {
        message: webhookRecebimento,
        message_ack: webhookEntrega,
        connection_update: webhookConexao
      },
      webhook_esperado: expected,
      raw_config: config
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[WAPI-VERIFY] Erro fatal:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
});