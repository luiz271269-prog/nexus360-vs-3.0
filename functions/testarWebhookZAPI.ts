import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Client-Token',
};

Deno.serve(async (req) => {
  console.log('[TEST-WEBHOOK-ZAPI] Iniciando teste de conexão');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({
        success: false,
        error: 'integration_id é obrigatório'
      }, { status: 400, headers: corsHeaders });
    }

    console.log('[TEST-WEBHOOK-ZAPI] Buscando integração:', integration_id);

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      return Response.json({
        success: false,
        error: 'Integração não encontrada'
      }, { status: 404, headers: corsHeaders });
    }

    console.log('[TEST-WEBHOOK-ZAPI] Integração encontrada:', integracao.nome_instancia);

    // Validar dados essenciais
    const validacao = {
      temInstanceId: !!integracao.instance_id_provider,
      temApiKey: !!integracao.api_key_provider,
      temClientToken: !!integracao.security_client_token_header,
      temBaseUrl: !!integracao.base_url_provider
    };

    if (!validacao.temInstanceId || !validacao.temApiKey || !validacao.temClientToken) {
      return Response.json({
        success: false,
        error: 'Configuração incompleta',
        validacao
      }, { status: 400, headers: corsHeaders });
    }

    // Construir URL do endpoint de status
    const baseUrl = integracao.base_url_provider || 'https://api.z-api.io';
    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const statusUrl = `${baseUrl}/instances/${instanceId}/token/${token}/status`;

    console.log('[TEST-WEBHOOK-ZAPI] URL de teste:', statusUrl);

    // Testar conexão com Z-API
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Client-Token': integracao.security_client_token_header,
        'Content-Type': 'application/json'
      }
    });

    const statusCode = response.status;
    const responseData = await response.json();

    console.log('[TEST-WEBHOOK-ZAPI] Status HTTP:', statusCode);
    console.log('[TEST-WEBHOOK-ZAPI] Resposta:', JSON.stringify(responseData));

    if (statusCode !== 200) {
      return Response.json({
        success: false,
        error: `Falha na conexão: HTTP ${statusCode}`,
        detalhes: responseData,
        validacao
      }, { status: 200, headers: corsHeaders });
    }

    // Verificar status da instância
    const conectado = responseData.connected === true || 
                      responseData.state === 'CONNECTED' ||
                      responseData.status === 'CONNECTED';

    const smartphoneConectado = responseData.smartphoneConnected === true;

    // Atualizar status da integração
    const novoStatus = conectado ? 'conectado' : 'desconectado';
    
    await base44.asServiceRole.entities.WhatsAppIntegration.update(integration_id, {
      status: novoStatus,
      ultima_atividade: new Date().toISOString()
    });

    console.log('[TEST-WEBHOOK-ZAPI] Status atualizado para:', novoStatus);

    // Testar webhook enviando um payload de teste
    let webhookTestResult = null;
    if (integracao.webhook_url) {
      try {
        console.log('[TEST-WEBHOOK-ZAPI] Testando webhook:', integracao.webhook_url);
        
        const webhookResponse = await fetch(integracao.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'TEST_CONNECTION',
            instance: instanceId,
            timestamp: new Date().toISOString(),
            test_mode: true
          })
        });

        webhookTestResult = {
          success: webhookResponse.status === 200,
          status: webhookResponse.status,
          url: integracao.webhook_url
        };

        console.log('[TEST-WEBHOOK-ZAPI] Webhook respondeu:', webhookResponse.status);
      } catch (err) {
        console.error('[TEST-WEBHOOK-ZAPI] Erro ao testar webhook:', err.message);
        webhookTestResult = {
          success: false,
          error: err.message
        };
      }
    }

    return Response.json({
      success: true,
      dados: {
        conectado,
        smartphoneConectado,
        status: novoStatus,
        nomeInstancia: integracao.nome_instancia,
        telefone: integracao.numero_telefone,
        instanceId: instanceId,
        webhookConfigurado: !!integracao.webhook_url,
        webhookTeste: webhookTestResult,
        validacao,
        respostaZAPI: responseData
      }
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[TEST-WEBHOOK-ZAPI] ERRO:', error.message);
    console.error('[TEST-WEBHOOK-ZAPI] Stack:', error.stack);

    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
});