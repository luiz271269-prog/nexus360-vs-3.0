/**
 * Serviço para W-API
 * Baseado na documentação oficial: https://api.w-api.app/v1
 * 
 * Diferenças da Z-API:
 * - URL base: https://api.w-api.app/v1
 * - instanceId vai como query parameter (?instanceId=XXX)
 * - Token vai no header Authorization: Bearer XXX
 * - Estrutura de payload diferente (phone, message, delayMessage)
 */
export default class WAPIService {
  
  static async verificarConexao(integracao) {
    try {
      console.log('🔍 [W-API] Verificando conexão...');

      const instanceId = integracao.instance_id_provider;
      const token = integracao.api_key_provider;
      
      // W-API: GET /v1/instance/status?instanceId=XXX
      const url = `https://api.w-api.app/v1/instance/status?instanceId=${instanceId}`;

      console.log('[W-API] URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      console.log('[W-API] Resposta status:', data);

      // W-API retorna { connected: true/false, ... }
      const conectado = response.ok && data.connected === true;

      return {
        conectado: conectado,
        dados_conexao: data,
        mensagem: conectado 
          ? 'WhatsApp conectado via W-API' 
          : 'WhatsApp desconectado'
      };

    } catch (error) {
      console.error('❌ [W-API] Erro:', error);
      return {
        conectado: false,
        erro: error.message
      };
    }
  }

  static async enviarMensagemTexto(integracao, destinatario, mensagem, replyToMessageId = null) {
    try {
      const numeroFormatado = destinatario.replace(/\D/g, '');
      const instanceId = integracao.instance_id_provider;
      const token = integracao.api_key_provider;
      
      // W-API: POST /v1/message/send-text?instanceId=XXX
      const url = `https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`;

      const payload = {
        phone: numeroFormatado,
        message: mensagem,
        delayMessage: 1 // Delay recomendado pela doc
      };

      if (replyToMessageId) {
        payload.messageId = replyToMessageId;
      }

      console.log('[W-API] Enviando texto:', { url, payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return {
        sucesso: true,
        messageId: data.messageId || data.key?.id || data.id,
        dados: data
      };

    } catch (error) {
      console.error('❌ [W-API] Erro ao enviar:', error);
      throw error;
    }
  }

  static async enviarMensagemMidia(integracao, destinatario, mediaUrl, mediaType, caption = '', replyToMessageId = null) {
    try {
      const numeroFormatado = destinatario.replace(/\D/g, '');
      const instanceId = integracao.instance_id_provider;
      const token = integracao.api_key_provider;

      // W-API endpoints de mídia
      const endpointMap = {
        'image': 'send-image',
        'video': 'send-video',
        'audio': 'send-audio',
        'document': 'send-document'
      };

      const endpoint = endpointMap[mediaType] || 'send-document';
      const url = `https://api.w-api.app/v1/message/${endpoint}?instanceId=${instanceId}`;

      // W-API usa 'url' para mídia, não o nome do tipo
      const payload = {
        phone: numeroFormatado,
        url: mediaUrl,
        caption: caption,
        delayMessage: 1
      };

      if (replyToMessageId) {
        payload.messageId = replyToMessageId;
      }

      console.log('[W-API] Enviando mídia:', { url, mediaType, payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return {
        sucesso: true,
        messageId: data.messageId || data.key?.id || data.id,
        dados: data
      };

    } catch (error) {
      console.error('❌ [W-API] Erro ao enviar mídia:', error);
      throw error;
    }
  }

  static async enviarAudio(integracao, destinatario, audioUrl, replyToMessageId = null) {
    try {
      const numeroFormatado = destinatario.replace(/\D/g, '');
      const instanceId = integracao.instance_id_provider;
      const token = integracao.api_key_provider;
      
      // W-API: POST /v1/message/send-audio?instanceId=XXX
      const url = `https://api.w-api.app/v1/message/send-audio?instanceId=${instanceId}`;

      const payload = {
        phone: numeroFormatado,
        url: audioUrl,
        delayMessage: 1
      };

      if (replyToMessageId) {
        payload.messageId = replyToMessageId;
      }

      console.log('[W-API] Enviando áudio:', { url, payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return {
        sucesso: true,
        messageId: data.messageId || data.key?.id || data.id,
        dados: data
      };

    } catch (error) {
      console.error('❌ [W-API] Erro ao enviar áudio:', error);
      throw error;
    }
  }

  /**
   * Processa webhook da W-API
   * Evento principal: webhookReceived
   * Estrutura: { event, sender: { id }, chat: { id }, msgContent: { ... }, instanceId }
   */
  static processarWebhook(payload) {
    try {
      console.log('📥 [W-API] Processando webhook:', payload);

      const evento = payload.event || '';
      
      // Mensagem recebida - evento: webhookReceived
      if (evento === 'webhookReceived' || payload.msgContent) {
        // Extrair telefone do sender.id ou chat.id (formato: 5511999999999@s.whatsapp.net)
        const rawPhone = payload.sender?.id || payload.chat?.id || '';
        const telefone = rawPhone.replace(/@.*$/, ''); // Remove @s.whatsapp.net
        
        // Extrair texto da mensagem (estrutura aninhada da W-API)
        let mensagem = '';
        let mediaType = 'none';
        let mediaUrl = null;
        
        if (payload.msgContent) {
          if (payload.msgContent.extendedTextMessage) {
            mensagem = payload.msgContent.extendedTextMessage.text || '';
          } else if (payload.msgContent.conversation) {
            mensagem = payload.msgContent.conversation;
          } else if (payload.msgContent.imageMessage) {
            mediaType = 'image';
            mediaUrl = payload.msgContent.imageMessage.url;
            mensagem = payload.msgContent.imageMessage.caption || '[Imagem]';
          } else if (payload.msgContent.videoMessage) {
            mediaType = 'video';
            mediaUrl = payload.msgContent.videoMessage.url;
            mensagem = payload.msgContent.videoMessage.caption || '[Vídeo]';
          } else if (payload.msgContent.audioMessage) {
            mediaType = 'audio';
            mediaUrl = payload.msgContent.audioMessage.url;
            mensagem = '[Áudio]';
          } else if (payload.msgContent.documentMessage) {
            mediaType = 'document';
            mediaUrl = payload.msgContent.documentMessage.url;
            mensagem = payload.msgContent.documentMessage.fileName || '[Documento]';
          } else if (payload.msgContent.stickerMessage) {
            mediaType = 'sticker';
            mediaUrl = payload.msgContent.stickerMessage.url;
            mensagem = '[Sticker]';
          } else if (payload.msgContent.contactMessage || payload.msgContent.contactsArrayMessage) {
            mediaType = 'contact';
            mensagem = '📇 Contato compartilhado';
          } else if (payload.msgContent.locationMessage) {
            mediaType = 'location';
            mensagem = '📍 Localização';
          }
        }
        
        return {
          tipo: 'mensagem_recebida',
          remetente: telefone,
          mensagem: mensagem,
          messageId: payload.messageId || payload.key?.id,
          timestamp: payload.timestamp || new Date().toISOString(),
          mediaType: mediaType,
          mediaUrl: mediaUrl,
          pushName: payload.pushName || payload.senderName || payload.sender?.pushName,
          instanceId: payload.instanceId,
          dadosCompletos: payload
        };
      }

      // Status de mensagem - evento: webhookDelivery
      if (evento === 'webhookDelivery' || evento === 'message-status') {
        return {
          tipo: 'status_mensagem',
          messageId: payload.messageId || payload.key?.id,
          status: payload.status || payload.ack,
          timestamp: payload.timestamp || new Date().toISOString(),
          dadosCompletos: payload
        };
      }

      // Conexão
      if (evento === 'connection' || evento === 'webhookConnection') {
        return {
          tipo: 'conexao',
          status: payload.connected ? 'conectado' : 'desconectado',
          instanceId: payload.instanceId,
          dadosCompletos: payload
        };
      }

      // QR Code
      if (evento === 'qrcode' || payload.qrcode) {
        return {
          tipo: 'qrcode',
          qrCodeUrl: payload.qrcode || payload.qr || payload.base64,
          instanceId: payload.instanceId,
          dadosCompletos: payload
        };
      }

      return {
        tipo: 'desconhecido',
        dadosCompletos: payload
      };

    } catch (error) {
      console.error('❌ [W-API] Erro ao processar webhook:', error);
      throw error;
    }
  }
}