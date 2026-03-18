import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TESTES DE FORMATOS DE AUTENTICAÇÃO Z-API                  ║
 * ║  Versão: ESTABILIZADA - Correção Erro 400                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Testa múltiplos formatos de autenticação para identificar
 * qual funciona com a configuração do usuário.
 */

Deno.serve(async (req) => {
  console.log('[TESTE FORMATOS] ═══════════════════════════════════════');
  console.log('[TESTE FORMATOS] 🧪 Iniciando testes de autenticação');
  console.log('[TESTE FORMATOS] ═══════════════════════════════════════');

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // ════════════════════════════════════════════════════════════
    // 1. AUTENTICAÇÃO
    // ════════════════════════════════════════════════════════════
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json(
        { success: false, error: 'Usuário não autenticado' },
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('[TESTE FORMATOS] ✅ Usuário autenticado:', user.email);

    // ════════════════════════════════════════════════════════════
    // 2. VALIDAÇÃO DO PAYLOAD
    // ════════════════════════════════════════════════════════════
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return Response.json({
        success: false,
        error: 'Payload JSON inválido',
        detalhes: e.message
      }, { status: 400, headers: corsHeaders });
    }

    const { instance_id, client_token, base_url } = body;

    // Validações rigorosas
    if (!instance_id || typeof instance_id !== 'string' || instance_id.trim().length < 10) {
      return Response.json({
        success: false,
        error: 'Instance ID inválido',
        diagnostico: 'O Instance ID deve ser uma string com pelo menos 10 caracteres'
      }, { status: 400, headers: corsHeaders });
    }

    if (!client_token || typeof client_token !== 'string' || client_token.trim().length < 10) {
      return Response.json({
        success: false,
        error: 'Client Token inválido',
        diagnostico: 'O Client Token deve ser uma string com pelo menos 10 caracteres'
      }, { status: 400, headers: corsHeaders });
    }

    const baseUrlFinal = (base_url || 'https://api.z-api.io').replace(/\/$/, '');

    console.log('[TESTE FORMATOS] 📋 Credenciais recebidas:');
    console.log('[TESTE FORMATOS] - Instance ID:', instance_id.substring(0, 8) + '...');
    console.log('[TESTE FORMATOS] - Client Token:', client_token.substring(0, 8) + '...');
    console.log('[TESTE FORMATOS] - Base URL:', baseUrlFinal);

    // ════════════════════════════════════════════════════════════
    // 3. FORMATOS DE AUTENTICAÇÃO A TESTAR
    // ════════════════════════════════════════════════════════════
    const formatosTeste = [
      {
        nome: 'Formato 1: URL + Header Client-Token',
        url: `${baseUrlFinal}/instances/${instance_id}/token/${client_token}/send-text`,
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': client_token
        },
        payload: {} // Payload vazio para testar apenas autenticação
      },
      {
        nome: 'Formato 2: URL sem Header',
        url: `${baseUrlFinal}/instances/${instance_id}/token/${client_token}/send-text`,
        headers: {
          'Content-Type': 'application/json'
        },
        payload: {}
      },
      {
        nome: 'Formato 3: Endpoint status (verificação de conexão)',
        url: `${baseUrlFinal}/instances/${instance_id}/token/${client_token}/status`,
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': client_token
        },
        payload: null // GET endpoint
      }
    ];

    const resultados = [];

    // ════════════════════════════════════════════════════════════
    // 4. EXECUTAR TESTES
    // ════════════════════════════════════════════════════════════
    for (const formato of formatosTeste) {
      console.log(`\n[TESTE FORMATOS] 🧪 Testando: ${formato.nome}`);
      console.log(`[TESTE FORMATOS] 🔗 URL: ${formato.url.replace(client_token, '***')}`);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const options = {
          method: formato.payload === null ? 'GET' : 'POST',
          headers: formato.headers,
          signal: controller.signal
        };

        if (formato.payload !== null) {
          options.body = JSON.stringify(formato.payload);
        }

        const response = await fetch(formato.url, options);
        clearTimeout(timeout);

        const responseText = await response.text();
        
        console.log(`[TESTE FORMATOS] 📊 Status: ${response.status}`);
        console.log(`[TESTE FORMATOS] 📊 Resposta: ${responseText.substring(0, 200)}`);

        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = { raw: responseText };
        }

        // ═════════════════════════════════════════════════════════
        // ANÁLISE DO RESULTADO
        // ═════════════════════════════════════════════════════════
        let sucesso = false;
        let diagnostico = '';

        if (response.status === 200) {
          sucesso = true;
          diagnostico = '✅ Autenticação bem-sucedida';
        } else if (response.status === 400) {
          // Erro 400 ao enviar payload vazio = autenticação OK, apenas faltam campos
          if (responseData.error && (
            responseData.error.includes('phone') ||
            responseData.error.includes('message') ||
            responseData.error.toLowerCase().includes('required')
          )) {
            sucesso = true;
            diagnostico = '✅ Autenticação OK (erro 400 por campos obrigatórios ausentes, como esperado)';
          } else {
            diagnostico = `⚠️ Erro 400: ${responseData.error || responseText}`;
          }
        } else if (response.status === 401 || response.status === 403) {
          diagnostico = `❌ Erro de autenticação (${response.status}): Credenciais inválidas`;
        } else if (response.status === 404) {
          diagnostico = '❌ Endpoint não encontrado (verifique a URL base)';
        } else {
          diagnostico = `⚠️ Status ${response.status}: ${responseData.message || responseText}`;
        }

        resultados.push({
          formato: formato.nome,
          sucesso,
          status_http: response.status,
          diagnostico,
          resposta: responseData
        });

      } catch (error) {
        console.error(`[TESTE FORMATOS] ❌ Erro no teste:`, error);
        
        resultados.push({
          formato: formato.nome,
          sucesso: false,
          status_http: 'ERROR',
          diagnostico: error.name === 'AbortError' 
            ? '❌ Timeout (8 segundos)' 
            : `❌ Erro de rede: ${error.message}`,
          erro: error.message
        });
      }
    }

    // ════════════════════════════════════════════════════════════
    // 5. DETERMINAR FORMATO RECOMENDADO
    // ════════════════════════════════════════════════════════════
    const formatoFuncionando = resultados.find(r => r.sucesso);
    
    const resposta = {
      success: !!formatoFuncionando,
      formato_recomendado: formatoFuncionando?.formato || null,
      total_testados: resultados.length,
      resultados,
      diagnostico_geral: formatoFuncionando
        ? `✅ Autenticação funcionando com: ${formatoFuncionando.formato}`
        : '❌ Nenhum formato de autenticação funcionou. Verifique as credenciais.',
      proximos_passos: formatoFuncionando
        ? ['Usar o formato recomendado para envio de mensagens']
        : [
            'Verifique se o Instance ID está correto (sem espaços extras)',
            'Verifique se o Client Token está correto (sem espaços extras)',
            'Confirme a URL base (https://api.z-api.io)',
            'Verifique se a instância está ativa no painel da Z-API'
          ]
    };

    console.log('\n[TESTE FORMATOS] ═══════════════════════════════════════');
    console.log('[TESTE FORMATOS] 📊 Resultado Final:');
    console.log('[TESTE FORMATOS]', resposta.diagnostico_geral);
    console.log('[TESTE FORMATOS] ═══════════════════════════════════════\n');

    return Response.json(resposta, { headers: corsHeaders });

  } catch (error) {
    console.error('[TESTE FORMATOS] ❌ Erro fatal:', error);
    
    return Response.json({
      success: false,
      error: 'Erro ao executar testes',
      detalhes: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
});