import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { integration_id } = body;

    if (!integration_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'integration_id é obrigatório'
        }),
        { status: 400, headers }
      );
    }

    // Buscar integração
    const integracoes = await base44.entities.WhatsAppIntegration.filter({ id: integration_id });
    if (integracoes.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Integração não encontrada'
        }),
        { status: 404, headers }
      );
    }

    const integracao = integracoes[0];
    const instanceId = integracao.instance_id_provider;
    const tokenInstancia = integracao.api_key_provider;
    const clientToken = integracao.security_client_token_header;
    const baseUrl = integracao.base_url_provider || 'https://api.z-api.io';

    console.log('[TESTE_CONEXAO] 🔍 Testando integração:', {
      id: integration_id,
      nome: integracao.nome_instancia,
      instanceId: instanceId ? `✓ (${instanceId.substring(0, 8)}...)` : '✗',
      tokenInstancia: tokenInstancia ? '✓ (presente)' : '✗',
      clientToken: clientToken ? '✓ (presente)' : '✗'
    });

    // Endpoint de diagnóstico Z-API
    const urlBase = baseUrl.replace(/\/$/, '');
    const urlDiagnostico = `${urlBase}/instances/${instanceId}/token/${tokenInstancia}/status`;
        
    console.log('[TESTE_CONEXAO] 🌐 Verificando status via Z-API endpoint:', urlDiagnostico.replace(tokenInstancia, '***'));

    const zapiResponse = await fetch(urlDiagnostico, {
        method: 'GET',
        headers: { 
            'Client-Token': clientToken,
            'Content-Type': 'application/json'
        } 
    });

    const data = await zapiResponse.json();
    
    let sucessoConexao = false;
    let mensagemStatus = '';

    if (zapiResponse.status === 200) {
        // Caso de Sucesso 1: Conectado
        if (data.connected === true || data.status === 'connected') {
            sucessoConexao = true;
            mensagemStatus = "Instância Z-API conectada com sucesso!";
        }
        // Caso de Sucesso 2: Já conectado
        else if (data.error && data.error.toLowerCase().includes('already connected')) {
            sucessoConexao = true;
            mensagemStatus = "Instância já estava conectada. Status confirmado.";
        }
        // Caso de Falha de Conexão
        else {
             mensagemStatus = data.message || data.error || 'Status interno da Z-API indica falha de conexão.';
        }
    } else {
         mensagemStatus = `Erro HTTP: ${zapiResponse.status}. ${data.message || data.error || 'Resposta inesperada da Z-API.'}`;
    }

    // Atualizar status da integração no Base44
    if (sucessoConexao) {
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integration_id, {
            status: 'conectado',
            ultima_atividade: new Date().toISOString()
        });
        console.log('[TESTE_CONEXAO] ✅ Status atualizado para CONECTADO no Base44.');

        return new Response(
            JSON.stringify({
                success: true,
                conectado: true,
                message: `✅ Diagnóstico concluído com sucesso! ${mensagemStatus}`,
                instanceName: data.instanceName || integracao.nome_instancia,
                data: data,
                dados: {
                    conectado: true,
                    smartphoneConectado: data.connected || data.status === 'connected',
                    nomeInstancia: data.instanceName || integracao.nome_instancia,
                    telefone: data.phone || integracao.numero_telefone,
                    statusCompleto: data
                }
            }),
            { status: 200, headers }
        );
    } else {
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integration_id, {
            status: 'desconectado',
            ultima_atividade: new Date().toISOString()
        });
        console.error('[TESTE_CONEXAO] ❌ Status atualizado para DESCONECTADO no Base44.');
        
        return new Response(
            JSON.stringify({
                success: false,
                conectado: false,
                error: `Falha na conexão: ${mensagemStatus}`,
                detalhes: `Erro HTTP: ${zapiResponse.status}. Resposta Z-API: ${JSON.stringify(data)}`
            }),
            { status: 200, headers }
        );
    }

  } catch (error) {
    console.error('[TESTE_CONEXAO] ❌ Erro inesperado no backend:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro inesperado: ${error.message}`,
        detalhes: error.stack
      }),
      { status: 500, headers }
    );
  }
});