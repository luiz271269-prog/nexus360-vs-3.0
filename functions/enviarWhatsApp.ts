import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ✅ Mapeamento de tipos de mídia para endpoints e campos Z-API
const ZAPI_MEDIA_CONFIG = {
  image: { endpoint: 'send-image', field: 'image' },
  video: { endpoint: 'send-video', field: 'video' },
  document: { endpoint: 'send-document', field: 'document' }
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

    console.log('[ENVIAR-WHATSAPP] 📤 Payload recebido:', JSON.stringify(payload, null, 2));

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

    // ✅ Validação de conteúdo - pelo menos uma das opções deve estar presente
    if (!mensagem && !template_name && !media_url && !audio_url) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum conteúdo fornecido. Forneça pelo menos um dos seguintes: mensagem, template_name, media_url ou audio_url'
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de mídia - se media_url está presente, media_type é obrigatório
    if (media_url && !media_type) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'media_type é obrigatório quando media_url é fornecido. Valores válidos: image, video, document'
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de tipo de mídia suportado
    if (media_type && !ZAPI_MEDIA_CONFIG[media_type]) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Tipo de mídia não suportado: ${media_type}`,
          supported_types: Object.keys(ZAPI_MEDIA_CONFIG)
        }),
        { status: 400, headers }
      );
    }

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      throw new Error('Integração WhatsApp não encontrada');
    }

    console.log('[ENVIAR-WHATSAPP] 🔗 Integração carregada:', integracao.nome_instancia, '- Provider:', integracao.api_provider);

    // ✅ Redirecionar para função W-API se for esse provedor
    if (integracao.api_provider === 'w_api') {
      console.log('[ENVIAR-WHATSAPP] 🔀 Redirecionando para enviarWhatsAppWapi (provedor W-API)');
      
      // Chamar função W-API diretamente
      const wapiResult = await base44.functions.invoke('enviarWhatsAppWapi', payload);
      
      return new Response(
        JSON.stringify(wapiResult.data),
        { status: wapiResult.data?.success ? 200 : 500, headers }
      );
    }

    const baseUrl = integracao.base_url_provider;
    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const clientToken = integracao.security_client_token_header;

    let endpoint;
    let body;

    // ========== TEMPLATES ==========
    if (template_name) {
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-template`;
      body = {
        phone: numero_destino,
        template: template_name,
        variables: template_variables || {}
      };
      console.log('[ENVIAR-WHATSAPP] 📋 Enviando template:', template_name);
    } 
    // ========== ÁUDIO (audio_url específico) ==========
    else if (audio_url) {
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-audio`;
      body = {
        phone: numero_destino,
        audio: audio_url
      };
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
        console.log('[ENVIAR-WHATSAPP] 💬 Áudio como resposta a:', reply_to_message_id);
      }
      
      console.log('[ENVIAR-WHATSAPP] 🎵 Enviando áudio:', { endpoint, body });
    } 
    // ========== MÍDIAS (imagem, vídeo, documento/PDF) ==========
    else if (media_url && media_type) {
      const config = ZAPI_MEDIA_CONFIG[media_type];
      
      if (!config) {
        throw new Error(`Tipo de mídia não suportado: ${media_type}. Tipos válidos: image, video, document`);
      }
      
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/${config.endpoint}`;
      
      // ✅ Construir body usando o campo correto para o tipo de mídia
      body = {
        phone: numero_destino,
        [config.field]: media_url,
        caption: media_caption || ''
      };
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
        console.log('[ENVIAR-WHATSAPP] 💬 Mídia como resposta a:', reply_to_message_id);
      }
      
      console.log('[ENVIAR-WHATSAPP] 📎 Enviando mídia:', {
        tipo: media_type,
        endpoint_usado: config.endpoint,
        campo_json: config.field,
        url_completa: endpoint,
        body_completo: body
      });
    } 
    // ========== MENSAGEM DE TEXTO ==========
    else if (mensagem) {
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
      body = {
        phone: numero_destino,
        message: mensagem
      };

      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
        console.log('[ENVIAR-WHATSAPP] 💬 Texto como resposta a:', reply_to_message_id);
      }

      console.log('[ENVIAR-WHATSAPP] 💬 Enviando texto');
    } else {
      throw new Error('Nenhum conteúdo fornecido (mensagem, template, mídia ou áudio)');
    }

    console.log('[ENVIAR-WHATSAPP] 🌐 Endpoint completo:', endpoint);
    console.log('[ENVIAR-WHATSAPP] 📦 Body final para Z-API:', JSON.stringify(body, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    console.log('[ENVIAR-WHATSAPP] 📥 Resposta bruta Z-API (HTTP ' + response.status + '):', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[ENVIAR-WHATSAPP] ❌ Erro ao fazer parse da resposta:', parseError);
      throw new Error(`Resposta inválida da Z-API: ${responseText.substring(0, 200)}`);
    }

    console.log('[ENVIAR-WHATSAPP] 📥 Resposta Z-API parseada:', JSON.stringify(result, null, 2));

    if (!response.ok || result.error) {
      const errorMsg = result.error || result.message || `Erro HTTP ${response.status}`;
      console.error('[ENVIAR-WHATSAPP] ❌ ERRO Z-API DETALHADO:', {
        status_http: response.status,
        erro_mensagem: errorMsg,
        endpoint_chamado: endpoint,
        body_enviado: body,
        resposta_completa: result
      });
      throw new Error(`Z-API retornou erro: ${errorMsg}`);
    }

    const messageId = result.messageId || result.message?.key?.id || result.key?.id;

    if (!messageId) {
      console.warn('[ENVIAR-WHATSAPP] ⚠️ Nenhum messageId encontrado na resposta da Z-API:', result);
    }

    console.log('[ENVIAR-WHATSAPP] ✅ Mensagem enviada com sucesso! messageId:', messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        response: result
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ENVIAR-WHATSAPP] ❌ ERRO FATAL:', error.message);
    console.error('[ENVIAR-WHATSAPP] ❌ Stack completo:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers }
    );
  }
});