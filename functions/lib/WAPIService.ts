/**
 * Serviço para W-API (duplicado do ZAPIService)
 * Este é um módulo utilitário, não uma função endpoint
 * 
 * NOTA: Ajustar os endpoints conforme documentação da W-API
 */
export default class WAPIService {
  
  static async verificarConexao(integracao) {
    try {
      console.log('🔍 [W-API] Verificando conexão...');

      // TODO: Ajustar URL base e endpoint conforme documentação W-API
      const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.w-api.app';
      const url = `${baseUrl}/instances/${integracao.instance_id_provider}/status`;

      console.log('[W-API] URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${integracao.api_key_provider}`,
          // TODO: Ajustar headers conforme documentação W-API
        }
      });

      const data = await response.json();
      console.log('[W-API] Resposta status:', data);

      // TODO: Ajustar lógica de verificação conforme resposta da W-API
      const conectado = response.ok && (data.connected === true || data.status === 'connected');

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
      const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.w-api.app';
      
      // TODO: Ajustar endpoint conforme documentação W-API
      const url = `${baseUrl}/instances/${integracao.instance_id_provider}/send-text`;

      const payload = {
        phone: numeroFormatado,
        message: mensagem
      };

      if (replyToMessageId) {
        payload.messageId = replyToMessageId;
      }

      console.log('[W-API] Enviando texto:', { url, payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integracao.api_key_provider}`,
          // TODO: Ajustar headers conforme documentação W-API
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
      const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.w-api.app';

      // TODO: Ajustar endpoints conforme documentação W-API
      const endpointMap = {
        'image': 'send-image',
        'video': 'send-video',
        'audio': 'send-audio',
        'document': 'send-document'
      };

      const endpoint = endpointMap[mediaType] || 'send-document';
      const url = `${baseUrl}/instances/${integracao.instance_id_provider}/${endpoint}`;

      const payload = {
        phone: numeroFormatado,
        [mediaType]: mediaUrl,
        caption: caption
      };

      if (replyToMessageId) {
        payload.messageId = replyToMessageId;
      }

      console.log('[W-API] Enviando mídia:', { url, mediaType, payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integracao.api_key_provider}`,
          // TODO: Ajustar headers conforme documentação W-API
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
      const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.w-api.app';
      
      // TODO: Ajustar endpoint conforme documentação W-API
      const url = `${baseUrl}/instances/${integracao.instance_id_provider}/send-audio`;

      const payload = {
        phone: numeroFormatado,
        audio: audioUrl
      };

      if (replyToMessageId) {
        payload.messageId = replyToMessageId;
      }

      console.log('[W-API] Enviando áudio:', { url, payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integracao.api_key_provider}`,
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

  static processarWebhook(payload) {
    try {
      console.log('📥 [W-API] Processando webhook:', payload);

      // TODO: Ajustar parsing conforme formato de webhook da W-API
      
      // Mensagem recebida
      if (payload.event === 'message' || payload.type === 'message' || payload.messageType) {
        return {
          tipo: 'mensagem_recebida',
          remetente: payload.phone || payload.from || payload.sender,
          mensagem: payload.text?.message || payload.message || payload.body || '',
          messageId: payload.messageId || payload.id || payload.key?.id,
          timestamp: payload.timestamp || new Date().toISOString(),
          mediaType: payload.mediaType || 'none',
          mediaUrl: payload.mediaUrl || payload.media?.url,
          pushName: payload.pushName || payload.senderName || payload.contactName,
          dadosCompletos: payload
        };
      }

      // Status de mensagem
      if (payload.event === 'message-status' || payload.type === 'status' || payload.status) {
        return {
          tipo: 'status_mensagem',
          messageId: payload.messageId || payload.id || payload.key?.id,
          status: payload.status,
          timestamp: payload.timestamp || new Date().toISOString(),
          dadosCompletos: payload
        };
      }

      // Conexão
      if (payload.event === 'connection' || payload.type === 'connection') {
        return {
          tipo: 'conexao',
          status: payload.status || payload.state,
          dadosCompletos: payload
        };
      }

      // QR Code
      if (payload.event === 'qrcode' || payload.type === 'qrcode' || payload.qrcode) {
        return {
          tipo: 'qrcode',
          qrCodeUrl: payload.qrcode || payload.qr || payload.base64,
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