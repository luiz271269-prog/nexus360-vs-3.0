import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    if (!integration_id) {
      throw new Error('integration_id é obrigatório');
    }

    if (!numero_destino) {
      throw new Error('numero_destino é obrigatório');
    }

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      throw new Error('Integração WhatsApp não encontrada');
    }

    console.log('[ENVIAR-WHATSAPP] 🔗 Integração carregada:', integracao.nome_instancia);

    const baseUrl = integracao.base_url_provider;
    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const clientToken = integracao.security_client_token_header;

    let endpoint;
    let body;

    if (template_name) {
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-template`;
      body = {
        phone: numero_destino,
        template: template_name,
        variables: template_variables || {}
      };
      console.log('[ENVIAR-WHATSAPP] 📋 Enviando template:', template_name);
    } else if (audio_url) {
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-audio`;
      body = {
        phone: numero_destino,
        audio: audio_url
      };
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
        console.log('[ENVIAR-WHATSAPP] 💬 Áudio como resposta a:', reply_to_message_id);
      }
      
      console.log('[ENVIAR-WHATSAPP] 🎵 Enviando áudio');
    } else if (media_url && media_type) {
      const mediaEndpoints = {
        image: 'send-image',
        video: 'send-video',
        document: 'send-document'
      };
      
      const mediaEndpoint = mediaEndpoints[media_type] || 'send-document';
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/${mediaEndpoint}`;
      
      if (media_type === 'image') {
        body = {
          phone: numero_destino,
          image: media_url,
          caption: media_caption || ''
        };
      } else if (media_type === 'video') {
        body = {
          phone: numero_destino,
          video: media_url,
          caption: media_caption || ''
        };
      } else {
        body = {
          phone: numero_destino,
          document: media_url,
          caption: media_caption || ''
        };
      }
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
        console.log('[ENVIAR-WHATSAPP] 💬 Mídia como resposta a:', reply_to_message_id);
      }
      
      console.log('[ENVIAR-WHATSAPP] 📎 Enviando mídia:', media_type);
    } else if (mensagem) {
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

    console.log('[ENVIAR-WHATSAPP] 🌐 Endpoint:', endpoint);
    console.log('[ENVIAR-WHATSAPP] 📦 Body:', JSON.stringify(body, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    console.log('[ENVIAR-WHATSAPP] 📥 Resposta bruta Z-API:', responseText);

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
      console.error('[ENVIAR-WHATSAPP] ❌ Erro Z-API:', errorMsg);
      throw new Error(errorMsg);
    }

    const messageId = result.messageId || result.message?.key?.id || result.key?.id;

    console.log('[ENVIAR-WHATSAPP] ✅ Mensagem enviada com sucesso! ID:', messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        response: result
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ENVIAR-WHATSAPP] ❌ Erro fatal:', error.message);
    console.error('[ENVIAR-WHATSAPP] ❌ Stack:', error.stack);
    
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