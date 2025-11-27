import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// FUNÇÃO DE ENVIO WHATSAPP - W-API (Paralela à Z-API)
// ============================================================================
// Baseado na documentação oficial W-API:
// - URL base: https://api.w-api.app/v1
// - instanceId como query parameter: ?instanceId=XXX
// - Token no header: Authorization: Bearer XXX
// ============================================================================

const VERSION = 'v1.0.1';
const WAPI_BASE_URL = 'https://api.w-api.app/v1';

// Mapeamento de tipos de mídia para endpoints W-API
const WAPI_MEDIA_CONFIG = {
  image: { endpoint: 'send-image' },
  video: { endpoint: 'send-video' },
  document: { endpoint: 'send-document' },
  audio: { endpoint: 'send-audio' }
};

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

    console.log('[ENVIAR-WHATSAPP-WAPI] 📤 Payload recebido:', JSON.stringify(payload, null, 2));

    const {
      integration_id,
      numero_destino,
      mensagem,
      template_name,
      template_variables,
      media_url,
      media_type,
      media_caption,
      audio_url,
      reply_to_message_id
    } = payload;

    // ✅ Validação de campos obrigatórios
    if (!integration_id || !numero_destino) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Campos obrigatórios ausentes', 
          missing: {
            integration_id: !integration_id,
            numero_destino: !numero_destino
          }
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de conteúdo
    if (!mensagem && !template_name && !media_url && !audio_url) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum conteúdo fornecido. Forneça: mensagem, template_name, media_url ou audio_url'
        }),
        { status: 400, headers }
      );
    }

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      throw new Error('Integração WhatsApp não encontrada');
    }

    // Verificar se é W-API
    if (integracao.api_provider !== 'w_api') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Esta função é específica para W-API. Use enviarWhatsApp para Z-API.'
        }),
        { status: 400, headers }
      );
    }

    console.log('[ENVIAR-WHATSAPP-WAPI] 🔗 Integração W-API carregada:', integracao.nome_instancia);

    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    
    // Formatar número (remover caracteres especiais)
    const numeroFormatado = numero_destino.replace(/\D/g, '');

    let endpoint;
    let body;

    // ========== TEMPLATES ==========
    if (template_name) {
      endpoint = `${WAPI_BASE_URL}/message/send-template?instanceId=${instanceId}`;
      body = {
        phone: numeroFormatado,
        template: template_name,
        variables: template_variables || {},
        delayMessage: 1
      };
      console.log('[ENVIAR-WHATSAPP-WAPI] 📋 Enviando template:', template_name);
    } 
    // ========== ÁUDIO ==========
    else if (audio_url) {
      endpoint = `${WAPI_BASE_URL}/message/send-audio?instanceId=${instanceId}`;
      body = {
        phone: numeroFormatado,
        url: audio_url, // W-API usa 'url' para mídia
        delayMessage: 1
      };
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }
      
      console.log('[ENVIAR-WHATSAPP-WAPI] 🎵 Enviando áudio');
    } 
    // ========== MÍDIAS (imagem, vídeo, documento) ==========
    else if (media_url && media_type) {
      const config = WAPI_MEDIA_CONFIG[media_type];
      
      if (!config) {
        throw new Error(`Tipo de mídia não suportado: ${media_type}. Válidos: image, video, document, audio`);
      }
      
      endpoint = `${WAPI_BASE_URL}/message/${config.endpoint}?instanceId=${instanceId}`;
      
      // W-API usa 'url' para todas as mídias
      body = {
        phone: numeroFormatado,
        url: media_url,
        caption: media_caption || '',
        delayMessage: 1
      };
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }
      
      console.log('[ENVIAR-WHATSAPP-WAPI] 📎 Enviando mídia:', media_type);
    } 
    // ========== TEXTO ==========
    else if (mensagem) {
      endpoint = `${WAPI_BASE_URL}/message/send-text?instanceId=${instanceId}`;
      body = {
        phone: numeroFormatado,
        message: mensagem,
        delayMessage: 1 // Delay recomendado pela doc
      };

      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }

      console.log('[ENVIAR-WHATSAPP-WAPI] 💬 Enviando texto');
    } else {
      throw new Error('Nenhum conteúdo fornecido');
    }

    console.log('[ENVIAR-WHATSAPP-WAPI] 🌐 Endpoint:', endpoint);
    console.log('[ENVIAR-WHATSAPP-WAPI] 📦 Body:', JSON.stringify(body, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    console.log('[ENVIAR-WHATSAPP-WAPI] 📥 Resposta W-API (HTTP ' + response.status + '):', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[ENVIAR-WHATSAPP-WAPI] ❌ Erro ao fazer parse:', parseError);
      throw new Error(`Resposta inválida da W-API: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok || result.error) {
      const errorMsg = result.error || result.message || `Erro HTTP ${response.status}`;
      console.error('[ENVIAR-WHATSAPP-WAPI] ❌ ERRO W-API:', {
        status_http: response.status,
        erro: errorMsg,
        resposta: result
      });
      throw new Error(`W-API retornou erro: ${errorMsg}`);
    }

    const messageId = result.messageId || result.key?.id || result.id;

    console.log('[ENVIAR-WHATSAPP-WAPI] ✅ Mensagem enviada! messageId:', messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        response: result,
        provider: 'w_api',
        version: VERSION
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ENVIAR-WHATSAPP-WAPI] ❌ ERRO:', error.message);
    
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