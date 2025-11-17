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

    const { integracaoId, instanceId, tokenInstancia, clientToken, baseUrl } = body;

    console.log('[TESTE_CONEXAO] 🔍 Parâmetros recebidos para diagnóstico:', {
      integracaoId: integracaoId ? '✓' : '✗',
      instanceId: instanceId ? `✓ (${instanceId.substring(0, 8)}...)` : '✗',
      tokenInstancia: tokenInstancia ? '✓ (presente)' : '✗',
      clientToken: clientToken ? '✓ (presente)' : '✗',
      baseUrl: baseUrl || '(não informado)'
    });

    // Validação de parâmetros
    if (!integracaoId || !instanceId || !tokenInstancia || !clientToken) {
      console.error('[TESTE_CONEXAO] ❌ Parâmetros obrigatórios faltando');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Parâmetros obrigatórios faltando no backend: integracaoId, instanceId, tokenInstancia, clientToken'
        }),
        { status: 400, headers }
      );
    }
    
    // Validar formato do Instance ID
    if (instanceId.includes('http') || instanceId.includes('/')) {
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Instance ID inválido: não deve conter URL, apenas o ID (ex: 3E5D2BD1BF421127B24ECEF0269361A3)'
            }),
            { status: 400, headers }
        );
    }

    // Endpoint de diagnóstico Z-API - CORRIGIDO
    const urlBase = (baseUrl || 'https://api.z-api.io').replace(/\/$/, '');
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
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integracaoId, {
            status: 'conectado',
            ultima_atividade: new Date().toISOString()
        });
        console.log('[TESTE_CONEXAO] ✅ Status atualizado para CONECTADO no Base44.');

        return new Response(
            JSON.stringify({
                success: true,
                message: `✅ Diagnóstico concluído com sucesso! ${mensagemStatus}`,
                data: data,
                dados: {
                    conectado: true,
                    smartphoneConectado: data.connected || data.status === 'connected',
                    nomeInstancia: data.instanceName || integracaoId,
                    telefone: data.phone || integracaoId,
                    statusCompleto: data
                }
            }),
            { status: 200, headers }
        );
    } else {
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integracaoId, {
            status: 'desconectado',
            ultima_atividade: new Date().toISOString()
        });
        console.error('[TESTE_CONEXAO] ❌ Status atualizado para DESCONECTADO no Base44.');
        
        return new Response(
            JSON.stringify({
                success: false,
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