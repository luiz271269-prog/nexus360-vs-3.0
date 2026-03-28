import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TESTE DE ENVIO Z-API - VERSÃO ESTABILIZADA               ║
 * ║  Correção Completa: Erro 400 (Bad Request)                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Esta função testa o envio real de mensagem para um número WhatsApp,
 * com validação rigorosa do número de telefone e payload minimalista.
 */

/**
 * Limpa e valida número de telefone
 * @param {string} numero - Número com possíveis caracteres especiais
 * @returns {object} { valido: boolean, numeroLimpo: string, erro: string }
 */
function limparEValidarTelefone(numero) {
  if (!numero || typeof numero !== 'string') {
    return {
      valido: false,
      numeroLimpo: '',
      erro: 'Número de telefone não fornecido ou inválido'
    };
  }

  // ✅ PASSO 1: Remover TUDO que não é dígito
  const numeroLimpo = numero.replace(/\D/g, '');

  console.log('[VALIDAÇÃO] 📱 Número original:', numero);
  console.log('[VALIDAÇÃO] 🧹 Número limpo:', numeroLimpo);

  // ✅ PASSO 2: Validar tamanho (formato internacional)
  // Brasil: 55 + DDD (2 dígitos) + Número (8 ou 9 dígitos) = 12 ou 13 dígitos
  if (numeroLimpo.length < 10) {
    return {
      valido: false,
      numeroLimpo,
      erro: `Número muito curto (${numeroLimpo.length} dígitos). Use formato: 5548999999999`
    };
  }

  if (numeroLimpo.length > 15) {
    return {
      valido: false,
      numeroLimpo,
      erro: `Número muito longo (${numeroLimpo.length} dígitos). Máximo: 15 dígitos`
    };
  }

  // ✅ PASSO 3: Validar formato brasileiro (opcional, mas recomendado)
  if (numeroLimpo.startsWith('55')) {
    // Brasil
    if (numeroLimpo.length !== 12 && numeroLimpo.length !== 13) {
      return {
        valido: false,
        numeroLimpo,
        erro: `Número brasileiro inválido. Use: 55 + DDD + Número (12 ou 13 dígitos). Recebido: ${numeroLimpo.length} dígitos`
      };
    }
  }

  console.log('[VALIDAÇÃO] ✅ Número válido:', numeroLimpo);

  return {
    valido: true,
    numeroLimpo,
    erro: null
  };
}

Deno.serve(async (req) => {
  console.log('[TESTE ENVIO] ═══════════════════════════════════════════');
  console.log('[TESTE ENVIO] 🚀 Iniciando teste de envio Z-API');
  console.log('[TESTE ENVIO] ═══════════════════════════════════════════');

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

    console.log('[TESTE ENVIO] ✅ Usuário autenticado:', user.email);

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

    const { instance_id, client_token, base_url, numero_teste, mensagem_teste } = body;

    // Validações de credenciais
    if (!instance_id || typeof instance_id !== 'string' || instance_id.trim().length < 10) {
      return Response.json({
        success: false,
        error: 'Instance ID inválido'
      }, { status: 400, headers: corsHeaders });
    }

    if (!client_token || typeof client_token !== 'string' || client_token.trim().length < 10) {
      return Response.json({
        success: false,
        error: 'Client Token inválido'
      }, { status: 400, headers: corsHeaders });
    }

    // ✅ VALIDAÇÃO RIGOROSA DO NÚMERO DE TELEFONE
    const validacao = limparEValidarTelefone(numero_teste);
    
    if (!validacao.valido) {
      console.error('[TESTE ENVIO] ❌ Número inválido:', validacao.erro);
      return Response.json({
        success: false,
        error: 'Número de telefone inválido',
        diagnostico: validacao.erro,
        dica: 'Use o formato internacional: 5548999999999 (código país + DDD + número)'
      }, { status: 400, headers: corsHeaders });
    }

    const numeroLimpo = validacao.numeroLimpo;
    const mensagemFinal = mensagem_teste || 'Teste VendaPro Pro: Conexão estabelecida com sucesso!';
    const baseUrlFinal = (base_url || 'https://api.z-api.io').replace(/\/$/, '');

    console.log('[TESTE ENVIO] 📋 Parâmetros validados:');
    console.log('[TESTE ENVIO] - Número destino:', numeroLimpo);
    console.log('[TESTE ENVIO] - Mensagem:', mensagemFinal);
    console.log('[TESTE ENVIO] - Base URL:', baseUrlFinal);

    // ════════════════════════════════════════════════════════════
    // 3. MONTAGEM DO PAYLOAD MINIMALISTA
    // ════════════════════════════════════════════════════════════
    const url = `${baseUrlFinal}/instances/${instance_id}/token/${client_token}/send-text`;
    
    // ✅ PAYLOAD MÍNIMO E LIMPO (apenas campos obrigatórios)
    const payload = {
      phone: numeroLimpo,  // ✅ APENAS DÍGITOS
      message: mensagemFinal  // ✅ STRING SIMPLES
    };

    console.log('[TESTE ENVIO] 📤 URL:', url.replace(client_token, '***TOKEN***'));
    console.log('[TESTE ENVIO] 📦 Payload:', JSON.stringify(payload, null, 2));

    // ════════════════════════════════════════════════════════════
    // 4. ENVIO DA REQUISIÇÃO
    // ════════════════════════════════════════════════════════════
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': client_token  // ✅ Header obrigatório
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const responseText = await response.text();
      
      console.log('[TESTE ENVIO] 📊 Status HTTP:', response.status);
      console.log('[TESTE ENVIO] 📊 Resposta bruta:', responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { raw: responseText };
      }

      // ═════════════════════════════════════════════════════════
      // 5. ANÁLISE DO RESULTADO
      // ═════════════════════════════════════════════════════════
      if (response.ok) {
        console.log('[TESTE ENVIO] ✅ Mensagem enviada com sucesso!');
        
        return Response.json({
          success: true,
          status_http: response.status,
          message_id: responseData.messageId || responseData.id || null,
          diagnostico: '✅ Mensagem enviada com sucesso para o WhatsApp',
          dados_completos: responseData
        }, { headers: corsHeaders });

      } else if (response.status === 400) {
        // ❌ ERRO 400: Payload malformado
        console.error('[TESTE ENVIO] ❌ Erro 400 - Bad Request');
        console.error('[TESTE ENVIO] 📋 Detalhes:', responseData);

        let diagnosticoDetalhado = 'Erro ao enviar mensagem: ';
        
        if (responseData.error) {
          diagnosticoDetalhado += responseData.error;
        } else if (responseData.message) {
          diagnosticoDetalhado += responseData.message;
        } else {
          diagnosticoDetalhado += 'Payload inválido ou campos obrigatórios ausentes';
        }

        return Response.json({
          success: false,
          status_http: 400,
          error: 'Bad Request',
          diagnostico: diagnosticoDetalhado,
          payload_enviado: payload,
          resposta_api: responseData,
          dicas: [
            'Verifique se o número está no formato correto (apenas dígitos)',
            'Verifique se a instância WhatsApp está conectada',
            'Verifique se o número tem WhatsApp ativo',
            'Consulte a documentação da Z-API'
          ]
        }, { status: 400, headers: corsHeaders });

      } else if (response.status === 401 || response.status === 403) {
        console.error('[TESTE ENVIO] ❌ Erro de autenticação');
        
        return Response.json({
          success: false,
          status_http: response.status,
          error: 'Erro de autenticação',
          diagnostico: 'Instance ID ou Client Token inválidos',
          dicas: [
            'Verifique se copiou o Instance ID correto (sem espaços)',
            'Verifique se copiou o Client Token correto (sem espaços)',
            'Confirme as credenciais no painel da Z-API'
          ]
        }, { status: response.status, headers: corsHeaders });

      } else {
        console.error('[TESTE ENVIO] ❌ Erro inesperado:', response.status);
        
        return Response.json({
          success: false,
          status_http: response.status,
          error: `Erro HTTP ${response.status}`,
          diagnostico: responseData.error || responseData.message || responseText,
          resposta_completa: responseData
        }, { status: response.status, headers: corsHeaders });
      }

    } catch (error) {
      console.error('[TESTE ENVIO] ❌ Erro de rede/timeout:', error);
      
      if (error.name === 'AbortError') {
        return Response.json({
          success: false,
          error: 'Timeout',
          diagnostico: 'A requisição excedeu o tempo limite de 10 segundos',
          dicas: [
            'Verifique sua conexão de internet',
            'Verifique se a URL da Z-API está correta',
            'Tente novamente em alguns instantes'
          ]
        }, { status: 408, headers: corsHeaders });
      }
      
      return Response.json({
        success: false,
        error: 'Erro de rede',
        diagnostico: error.message,
        dicas: [
          'Verifique sua conexão de internet',
          'Verifique se a URL da Z-API está acessível',
          'Tente novamente em alguns instantes'
        ]
      }, { status: 500, headers: corsHeaders });
    }

  } catch (error) {
    console.error('[TESTE ENVIO] ❌ Erro fatal:', error);
    
    return Response.json({
      success: false,
      error: 'Erro ao processar requisição',
      detalhes: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
});