import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// TESTAR CONEXÃO W-API (Paralelo ao Z-API)
// ============================================================================
// Função para testar se a conexão com a W-API está funcionando
// TODO: Ajustar endpoints conforme documentação W-API
// ============================================================================

const VERSION = 'v1.0.0';

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

    // TODO: Ajustar URL e headers conforme documentação W-API
    const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.w-api.app';
    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;

    // TODO: Ajustar endpoint de status conforme W-API
    const statusUrl = `${baseUrl}/instances/${instanceId}/status`;

    console.log('[TESTAR-WAPI] 🌐 Verificando status:', statusUrl);

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
        // TODO: Adicionar outros headers se necessário
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

    // TODO: Ajustar verificação de conexão conforme resposta W-API
    const conectado = response.ok && (
      result.connected === true || 
      result.status === 'connected' ||
      result.state === 'connected' ||
      result.authenticated === true
    );

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
        conectado: conectado,
        status: novoStatus,
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