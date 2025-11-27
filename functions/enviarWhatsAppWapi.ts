import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// FUNÇÃO DE ENVIO WHATSAPP - W-API (Paralela à Z-API)
// ============================================================================
// Esta função é específica para a W-API e não interfere na Z-API
// TODO: Ajustar endpoints e payload conforme documentação W-API
// ============================================================================

const VERSION = 'v1.0.0';

// Mapeamento de tipos de mídia para endpoints W-API
// TODO: Ajustar conforme documentação W-API
const WAPI_MEDIA_CONFIG = {
  image: { endpoint: 'send-image', field: 'image' },
  video: { endpoint: 'send-video', field: 'video' },
  document: { endpoint: 'send-document', field: 'document' },
  audio: { endpoint: 'send-audio', field: 'audio' }
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

    // TODO: Ajustar conforme estrutura da W-API
    const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.w-api.app';
    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;

    let endpoint;
    let body;

    // ========== TEMPLATES ==========
    if (template_name) {
      // TODO: Ajustar endpoint de template conforme W-API
      endpoint = `${baseUrl}/instances/${instanceId}/send-template`;
      body = {
        phone: numero_destino,
        template: template_name,
        variables: template_variables || {}
      };
      console.log('[ENVIAR-WHATSAPP-WAPI] 📋 Enviando template:', template_name);
    } 
    // ========== ÁUDIO ==========
    else if (audio_url) {
      endpoint = `${baseUrl}/instances/${instanceId}/send-audio`;
      body = {
        phone: numero_destino,
        audio: audio_url
      };
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }
      
      console.log('[ENVIAR-WHATSAPP-WAPI] 🎵 Enviando áudio');
    } 
    // ========== MÍDIAS ==========
    else if (media_url && media_type) {
      const config = WAPI_MEDIA_CONFIG[media_type];
      
      if (!config) {
        throw new Error(`Tipo de mídia não suportado: ${media_type}`);
      }
      
      endpoint = `${baseUrl}/instances/${instanceId}/${config.endpoint}`;
      
      body = {
        phone: numero_destino,
        [config.field]: media_url,
        caption: media_caption || ''
      };
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }
      
      console.log('[ENVIAR-WHATSAPP-WAPI] 📎 Enviando mídia:', media_type);
    } 
    // ========== TEXTO ==========
    else if (mensagem) {
      endpoint = `${baseUrl}/instances/${instanceId}/send-text`;
      body = {
        phone: numero_destino,
        message: mensagem
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

    // TODO: Ajustar headers conforme W-API (pode usar Bearer token, API Key, etc)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
        // TODO: Adicionar outros headers necessários
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

    // TODO: Ajustar extração do messageId conforme resposta W-API
    const messageId = result.messageId || result.message?.key?.id || result.key?.id || result.id;

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