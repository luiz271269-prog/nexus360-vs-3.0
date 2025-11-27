import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// TESTAR CONEXÃO W-API (Paralelo ao Z-API)
// ============================================================================
// Baseado na documentação oficial W-API:
// - GET /v1/instance/status?instanceId=XXX
// - Authorization: Bearer TOKEN
// ============================================================================

const VERSION = 'v1.0.1';
const WAPI_BASE_URL = 'https://api.w-api.app/v1';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { integration_id } = payload;

    if (!integration_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'integration_id é obrigatório' }),
        { status: 400, headers }
      );
    }

    console.log('[TESTAR-WAPI] 🔍 Testando integração:', integration_id);

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integração não encontrada' }),
        { status: 404, headers }
      );
    }

    // Verificar se é W-API
    if (integracao.api_provider !== 'w_api') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Esta função é específica para W-API',
          provider_atual: integracao.api_provider
        }),
        { status: 400, headers }
      );
    }

    console.log('[TESTAR-WAPI] 🔗 Integração W-API:', integracao.nome_instancia);

    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;

    // W-API: GET /v1/instance/status?instanceId=XXX
    const statusUrl = `${WAPI_BASE_URL}/instance/status?instanceId=${instanceId}`;

    console.log('[TESTAR-WAPI] 🌐 Verificando status:', statusUrl);

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const responseText = await response.text();
    console.log('[TESTAR-WAPI] 📥 Resposta (HTTP ' + response.status + '):', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Resposta inválida da W-API',
          raw_response: responseText.substring(0, 500)
        }),
        { status: 500, headers }
      );
    }

    // W-API retorna { connected: true/false }
    const conectado = response.ok && result.connected === true;

    // Atualizar status da integração
    const novoStatus = conectado ? 'conectado' : 'desconectado';
    await base44.asServiceRole.entities.WhatsAppIntegration.update(integration_id, {
      status: novoStatus,
      ultima_atividade: new Date().toISOString()
    });

    console.log('[TESTAR-WAPI] ' + (conectado ? '✅' : '❌') + ' Status:', novoStatus);

    return new Response(
      JSON.stringify({
        success: true,
        dados: {
          conectado: conectado,
          status: novoStatus,
          smartphoneConectado: result.connected === true
        },
        provider: 'w_api',
        integracao: {
          id: integracao.id,
          nome: integracao.nome_instancia,
          numero: integracao.numero_telefone
        },
        resposta_api: result,
        version: VERSION
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[TESTAR-WAPI] ❌ ERRO:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        provider: 'w_api',
        version: VERSION
      }),
      { status: 500, headers }
    );
  }
});