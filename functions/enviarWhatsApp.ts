import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// FUNÇÃO UNIFICADA DE ENVIO WHATSAPP - v2.0.0
// ============================================================================
// Suporta Z-API e W-API em uma única função inteligente
// Detecta automaticamente o provedor e adapta o envio
// ============================================================================

const VERSION = 'v2.1.0';
const WAPI_BASE_URL = 'https://api.w-api.app/v1';

// Configuração de mídia por provedor
const MEDIA_CONFIG = {
  image: { endpoint: 'send-image', field: 'image' },
  video: { endpoint: 'send-video', field: 'video' },
  document: { endpoint: 'send-document', field: 'document' },
  audio: { endpoint: 'send-audio', field: 'audio' }
};

// Extrair extensão de uma URL (usado para documentos W-API)
function extrairExtensao(url) {
  if (!url) return 'file';
  try {
    const path = new URL(url).pathname;
    const parts = path.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].split('?')[0].toLowerCase();
    }
  } catch (e) {}
  return 'file';
}

// Formatar número de telefone (apenas dígitos)
function formatarNumero(numero) {
  if (!numero) return '';
  return String(numero).replace(/\D/g, '');
}

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

    console.log('[ENVIAR-WHATSAPP-UNIFICADO] 📤 Payload recebido:', JSON.stringify(payload, null, 2));

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
          },
          version: VERSION
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de conteúdo
    if (!mensagem && !template_name && !media_url && !audio_url) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum conteúdo fornecido. Forneça: mensagem, template_name, media_url ou audio_url',
          version: VERSION
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de mídia
    if (media_url && !media_type) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'media_type é obrigatório quando media_url é fornecido. Valores: image, video, document',
          version: VERSION
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de tipo de mídia suportado
    if (media_type && !MEDIA_CONFIG[media_type]) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Tipo de mídia não suportado: ${media_type}`,
          supported_types: Object.keys(MEDIA_CONFIG),
          version: VERSION
        }),
        { status: 400, headers }
      );
    }

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      throw new Error('Integração WhatsApp não encontrada');
    }

    // ✅ Detectar provedor
    const isWAPI = integracao.api_provider === 'w_api';
    const providerName = isWAPI ? 'W-API' : 'Z-API';
    
    console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 🔗 Integração: ${integracao.nome_instancia} | Provedor: ${providerName}`);

    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const clientToken = integracao.security_client_token_header;
    const baseUrl = isWAPI ? WAPI_BASE_URL : integracao.base_url_provider;
    
    // Formatar número (W-API prefere apenas dígitos)
    const numeroFormatado = formatarNumero(numero_destino);

    let endpoint;
    let body;

    // ========== TEMPLATES ==========
    if (template_name) {
      if (isWAPI) {
        endpoint = `${baseUrl}/message/send-template?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          template: template_name,
          variables: template_variables || {},
          delayMessage: 1
        };
      } else {
        endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-template`;
        body = {
          phone: numero_destino,
          template: template_name,
          variables: template_variables || {}
        };
      }
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📋 Enviando template (${providerName}):`, template_name);
    } 
    
    // ========== ÁUDIO ==========
    else if (audio_url) {
      if (isWAPI) {
        // W-API: usar send-audio (campo 'url' para a URL do áudio)
        // Baseado no WAPIService que funciona
        endpoint = `${baseUrl}/message/send-audio?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          url: audio_url,         // W-API usa 'url' não 'audio'
          delayMessage: 1
        };
        
        if (reply_to_message_id) {
          body.messageId = reply_to_message_id;
        }
      } else {
        // Z-API: usar send-audio (formato oficial da documentação)
        // Endpoint: POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-audio
        // Docs: https://developer.z-api.io/en/message/send-message-audio
        endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-audio`;
        body = {
          phone: numeroFormatado, // Apenas dígitos: 5511999999999
          audio: audio_url,       // Z-API usa 'audio' para URL ou Base64
          waveform: true          // Mostrar forma de onda (melhor UX)
        };
        
        // Adicionar reply se existir
        if (reply_to_message_id) {
          body.messageId = reply_to_message_id;
        }
      }
      
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 🎵 Enviando áudio (${providerName}):`, audio_url);
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 🎵 Body áudio:`, JSON.stringify(body));
    } 
    
    // ========== MÍDIAS (imagem, vídeo, documento) ==========
    else if (media_url && media_type) {
      const config = MEDIA_CONFIG[media_type];
      
      if (isWAPI) {
        endpoint = `${baseUrl}/message/${config.endpoint}?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          [config.field]: media_url,
          delayMessage: 1
        };
        
        // Caption apenas para imagem e vídeo no W-API
        if ((media_type === 'image' || media_type === 'video') && media_caption) {
          body.caption = media_caption;
        }
        
        // Documento W-API precisa de extension e fileName
        if (media_type === 'document') {
          body.extension = extrairExtensao(media_url);
          if (media_caption) {
            body.fileName = media_caption;
          }
        }
      } else {
        // Z-API: usar endpoint correto para cada tipo
        endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/${config.endpoint}`;
        
        if (media_type === 'document') {
          // Z-API documento: usar campo 'document' com URL
          body = {
            phone: numeroFormatado,
            document: media_url
          };
          // Nome do arquivo para exibição
          if (media_caption) {
            body.fileName = media_caption;
          }
        } else {
          // Imagem/Vídeo: usar campo correspondente
          body = {
            phone: numeroFormatado,
            [config.field]: media_url
          };
          if (media_caption) {
            body.caption = media_caption;
          }
        }
      }
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }
      
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📎 Enviando ${media_type} (${providerName}):`, media_url);
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📎 Body documento:`, JSON.stringify(body));
    } 
    
    // ========== TEXTO ==========
    else if (mensagem) {
      if (isWAPI) {
        endpoint = `${baseUrl}/message/send-text?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          message: mensagem,
          delayMessage: 1
        };
      } else {
        endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
        body = {
          phone: numero_destino,
          message: mensagem
        };
      }

      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }

      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 💬 Enviando texto (${providerName})`);
    } else {
      throw new Error('Nenhum conteúdo fornecido');
    }

    console.log('[ENVIAR-WHATSAPP-UNIFICADO] 🌐 Endpoint:', endpoint);
    console.log('[ENVIAR-WHATSAPP-UNIFICADO] 📦 Body:', JSON.stringify(body, null, 2));

    // ✅ Configurar headers conforme o provedor
    const requestHeaders = {
      'Content-Type': 'application/json'
    };
    
    if (isWAPI) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      requestHeaders['Client-Token'] = clientToken;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📥 Resposta ${providerName} (HTTP ${response.status}):`, responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[ENVIAR-WHATSAPP-UNIFICADO] ❌ Erro ao fazer parse:', parseError);
      throw new Error(`Resposta inválida do ${providerName}: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok || result.error) {
      const errorMsg = result.error || result.message || `Erro HTTP ${response.status}`;
      console.error(`[ENVIAR-WHATSAPP-UNIFICADO] ❌ ERRO ${providerName}:`, {
        status_http: response.status,
        erro: errorMsg,
        endpoint,
        body,
        resposta: result
      });
      throw new Error(`${providerName} retornou erro: ${errorMsg}`);
    }

    const messageId = result.messageId || result.message?.key?.id || result.key?.id || result.id;

    if (!messageId) {
      console.warn(`[ENVIAR-WHATSAPP-UNIFICADO] ⚠️ Nenhum messageId encontrado na resposta:`, result);
    }

    console.log(`[ENVIAR-WHATSAPP-UNIFICADO] ✅ Mensagem enviada via ${providerName}! messageId:`, messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        response: result,
        provider: isWAPI ? 'w_api' : 'z_api',
        version: VERSION
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ENVIAR-WHATSAPP-UNIFICADO] ❌ ERRO:', error.message);
    console.error('[ENVIAR-WHATSAPP-UNIFICADO] ❌ Stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        version: VERSION
      }),
      { status: 500, headers }
    );
  }
});