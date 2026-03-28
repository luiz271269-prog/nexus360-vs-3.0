import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // ✅ URL FIXA POR PROVEDOR (compartilhada por todas instâncias W-API)
    const expectedWebhookUrl = `https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi`;

    // ✅ USAR INTEGRATOR TOKEN se for modo integrator
    const INTEGRATOR_TOKEN = Deno.env.get('WAPI_INTEGRATOR_TOKEN');

    let headers;
    let endpoint;

    if (integration.modo === 'integrator' && INTEGRATOR_TOKEN) {
      // Modo Integrador: usar token do integrador e endpoint /integrator/instances
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
      };
      endpoint = `https://api.w-api.app/v1/integrator/instances?pageSize=100&page=1`;
      console.log('[WAPI-VERIFY] Usando endpoint INTEGRADOR (token global)');
    } else {
      // Modo manual: usar token individual da instância
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.api_key_provider}`
      };
      const baseUrl = integration.base_url_provider || 'https://api.w-api.app/v1';
      endpoint = `${baseUrl}/instance/info?instanceId=${integration.instance_id_provider}`;
      console.log('[WAPI-VERIFY] Usando endpoint MANUAL (token individual)');
    }

    console.log(`[WAPI-VERIFY] Instance ID: ${integration.instance_id_provider}`);
    console.log(`[WAPI-VERIFY] Endpoint: ${endpoint}`);

    let infoData;
    try {
      const response = await fetch(endpoint, { method: 'GET', headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WAPI-VERIFY] ❌ API retornou ${response.status}:`, errorText.substring(0, 200));
        return Response.json({
          success: false,
          error: `W-API retornou ${response.status}. Verifique credenciais e se a instância existe.`,
          status_code: response.status
        }, { status: 200, headers: corsHeaders });
      }

      infoData = await response.json();
      console.log('[WAPI-VERIFY] ✅ Dados recebidos da W-API');
    } catch (fetchError) {
      console.error('[WAPI-VERIFY] ❌ Erro na requisição:', fetchError.message);
      return Response.json({
        success: false,
        error: `Falha ao conectar com W-API: ${fetchError.message}`
      }, { status: 200, headers: corsHeaders });
    }
    console.log('[WAPI-VERIFY] Dados recebidos:', JSON.stringify(infoData).substring(0, 300));

    // ✅ MODO INTEGRADOR: buscar instância específica na lista
    let config;
    if (integration.modo === 'integrator' && infoData.data && Array.isArray(infoData.data)) {
      const instanciaEncontrada = infoData.data.find(inst => 
        inst.instanceId === integration.instance_id_provider
      );

      if (!instanciaEncontrada) {
        return Response.json({
          success: false,
          error: `Instância ${integration.instance_id_provider} não encontrada na lista do integrador`
        }, { status: 200, headers: corsHeaders });
      }

      config = instanciaEncontrada;
      console.log('[WAPI-VERIFY] ✅ Instância encontrada na lista do integrador');
    } else {
      // Modo manual: resposta direta
      config = infoData.instance || infoData || {};
    }
    
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