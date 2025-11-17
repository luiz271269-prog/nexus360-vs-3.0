import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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
      reply_to_message_id // 🆕 NOVO PARÂMETRO
    } = payload;

    if (!integration_id) {
      throw new Error('integration_id é obrigatório');
    }

    if (!numero_destino) {
      throw new Error('numero_destino é obrigatório');
    }

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      throw new Error('Integração WhatsApp não encontrada');
    }

    console.log('[ENVIAR-WHATSAPP] 🔗 Integração carregada:', integracao.nome_instancia);

    // Montar URL da Z-API
    const baseUrl = integracao.base_url_provider;
    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const clientToken = integracao.security_client_token_header;

    let endpoint;
    let body;

    if (template_name) {
      // Enviar Template
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-template`;
      body = {
        phone: numero_destino,
        template: template_name,
        variables: template_variables || {}
      };
      console.log('[ENVIAR-WHATSAPP] 📋 Enviando template:', template_name);
    } else if (audio_url) {
      // Enviar Áudio
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-audio`;
      body = {
        phone: numero_destino,
        audio: audio_url
      };
      console.log('[ENVIAR-WHATSAPP] 🎵 Enviando áudio');
    } else if (media_url) {
      // Enviar Mídia
      const mediaEndpoints = {
        image: 'send-image',
        video: 'send-video',
        document: 'send-document'
      };
      const mediaEndpoint = mediaEndpoints[media_type] || 'send-document';
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/${mediaEndpoint}`;
      
      body = {
        phone: numero_destino,
        [media_type === 'image' ? 'image' : media_type === 'video' ? 'video' : 'document']: media_url,
        caption: media_caption || ''
      };
      console.log('[ENVIAR-WHATSAPP] 📎 Enviando mídia:', media_type);
    } else if (mensagem) {
      // Enviar Texto
      endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
      body = {
        phone: numero_destino,
        message: mensagem
      };

      // 🆕 ADICIONAR REPLY SE HOUVER
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
        console.log('[ENVIAR-WHATSAPP] 💬 Enviando como resposta a:', reply_to_message_id);
      }

      console.log('[ENVIAR-WHATSAPP] 💬 Enviando texto');
    } else {
      throw new Error('Nenhum conteúdo fornecido (mensagem, template, mídia ou áudio)');
    }

    console.log('[ENVIAR-WHATSAPP] 🌐 Endpoint:', endpoint);
    console.log('[ENVIAR-WHATSAPP] 📦 Body:', JSON.stringify(body, null, 2));

    // Fazer requisição para Z-API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    console.log('[ENVIAR-WHATSAPP] 📥 Resposta Z-API:', JSON.stringify(result, null, 2));

    if (!response.ok || result.error) {
      throw new Error(result.error || result.message || 'Erro ao enviar via Z-API');
    }

    // Extrair messageId da resposta
    const messageId = result.messageId || result.message?.key?.id || result.key?.id;

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        response: result
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ENVIAR-WHATSAPP] ❌ Erro:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers }
    );
  }
});