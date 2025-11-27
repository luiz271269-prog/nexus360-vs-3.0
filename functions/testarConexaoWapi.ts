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

    const instanceId = (integracao.instance_id_provider || '').trim();
    const token = (integracao.api_key_provider || '').trim();

    // Validar que não estão vazios
    if (!instanceId || !token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Instance ID ou Token não configurados',
          detalhes: `instanceId: ${instanceId ? 'OK' : 'VAZIO'}, token: ${token ? 'OK' : 'VAZIO'}`,
          provider: 'w_api'
        }),
        { status: 200, headers }
      );
    }

    // W-API: GET /v1/instance/status-instance?instanceId=XXX (URL CORRETA!)
    const statusUrl = `${WAPI_BASE_URL}/instance/status-instance?instanceId=${instanceId}`;

    console.log('[TESTAR-WAPI] 🌐 Verificando status:', statusUrl);

    let response;
    let responseText;
    let result;

    try {
      response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      responseText = await response.text();
      console.log('[TESTAR-WAPI] 📥 Resposta (HTTP ' + response.status + '):', responseText);

    } catch (fetchError) {
      console.error('[TESTAR-WAPI] ❌ Erro de fetch:', fetchError.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível conectar à W-API. Verifique suas credenciais.',
          detalhes: fetchError.message,
          provider: 'w_api'
        }),
        { status: 200, headers }
      );
    }

    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[TESTAR-WAPI] ❌ Erro ao parsear JSON:', responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Resposta inválida da W-API',
          detalhes: 'A API retornou um formato inesperado',
          raw_response: responseText.substring(0, 200),
          provider: 'w_api'
        }),
        { status: 200, headers }
      );
    }

    // Verificar erros de autenticação
    if (response.status === 401 || response.status === 403) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token W-API inválido ou expirado',
          detalhes: 'Verifique o Bearer Token nas configurações',
          provider: 'w_api'
        }),
        { status: 200, headers }
      );
    }

    if (response.status === 404) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Instance ID não encontrado',
          detalhes: 'O Instance ID informado não existe na W-API',
          provider: 'w_api'
        }),
        { status: 200, headers }
      );
    }

    // W-API retorna { connected: true/false } ou { status: "connected" }
    const conectado = response.ok && (result.connected === true || result.status === 'connected');

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
    console.error('[TESTAR-WAPI] ❌ ERRO:', error.message, error.stack);
    
    // Identificar tipo de erro para melhor diagnóstico
    let errorMessage = error.message;
    let errorDetails = null;
    
    if (error.message?.includes('fetch')) {
      errorMessage = 'Falha na conexão com W-API. Verifique o Instance ID e Token.';
      errorDetails = 'Erro de rede ou credenciais inválidas';
    } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorMessage = 'Token inválido ou expirado';
      errorDetails = 'Verifique o Bearer Token da W-API';
    } else if (error.message?.includes('404')) {
      errorMessage = 'Instance ID não encontrado na W-API';
      errorDetails = 'Verifique se o Instance ID está correto';
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        detalhes: errorDetails,
        erro_original: error.message,
        provider: 'w_api',
        version: VERSION
      }),
      { status: 200, headers } // Retorna 200 para não quebrar o frontend
    );
  }
});