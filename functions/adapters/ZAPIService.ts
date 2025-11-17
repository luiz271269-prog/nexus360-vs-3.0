/**
 * Serviço simplificado para Z-API
 */
export default class ZAPIService {
  
  static async verificarConexao(integracao) {
    try {
      console.log('🔍 [Z-API] Verificando conexão...');

      const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.z-api.io';
      const url = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/status`;

      console.log('[Z-API] URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Client-Token': integracao.security_client_token_header
        }
      });

      const data = await response.json();
      console.log('[Z-API] Resposta status:', data);

      const conectado = response.ok && data.connected === true;
      const smartphoneConectado = data.smartphoneConnected === true;

      return {
        conectado: conectado && smartphoneConectado,
        dados_conexao: data,
        mensagem: conectado && smartphoneConectado 
          ? 'WhatsApp conectado via Z-API' 
          : 'WhatsApp desconectado ou smartphone offline'
      };

    } catch (error) {
      console.error('❌ [Z-API] Erro:', error);
      return {
        conectado: false,
        erro: error.message
      };
    }
  }

  static async enviarMensagemTexto(integracao, destinatario, mensagem) {
    try {
      const numeroFormatado = destinatario.replace(/\D/g, '');
      const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.z-api.io';
      const url = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;

      const payload = {
        phone: numeroFormatado,
        message: mensagem
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': integracao.security_client_token_header
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
        messageId: data.messageId || data.key?.id,
        dados: data
      };

    } catch (error) {
      console.error('❌ [Z-API] Erro ao enviar:', error);
      throw error;
    }
  }

  static async enviarMensagemMidia(integracao, destinatario, mediaUrl, mediaType, caption = '') {
    try {
      const numeroFormatado = destinatario.replace(/\D/g, '');
      const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.z-api.io';

      const endpointMap = {
        'image': 'send-image',
        'video': 'send-video',
        'audio': 'send-audio',
        'document': 'send-document'
      };

      const endpoint = endpointMap[mediaType] || 'send-document';
      const url = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/${endpoint}`;

      const payload = {
        phone: numeroFormatado,
        [mediaType]: mediaUrl,
        caption: caption
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': integracao.security_client_token_header
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
        messageId: data.messageId || data.key?.id,
        dados: data
      };

    } catch (error) {
      console.error('❌ [Z-API] Erro ao enviar mídia:', error);
      throw error;
    }
  }

  static processarWebhook(payload) {
    try {
      console.log('📥 [Z-API] Processando webhook:', payload);

      // Mensagem recebida
      if (payload.event === 'message-received' || payload.messageType) {
        return {
          tipo: 'mensagem_recebida',
          remetente: payload.phone || payload.from,
          mensagem: payload.text?.message || payload.message || '',
          messageId: payload.messageId || payload.key?.id,
          timestamp: payload.timestamp || new Date().toISOString(),
          dadosCompletos: payload
        };
      }

      // Status de mensagem
      if (payload.event === 'message-update' || payload.status) {
        return {
          tipo: 'status_mensagem',
          messageId: payload.messageId || payload.key?.id,
          status: payload.status,
          timestamp: payload.timestamp || new Date().toISOString(),
          dadosCompletos: payload
        };
      }

      return {
        tipo: 'desconhecido',
        dadosCompletos: payload
      };

    } catch (error) {
      console.error('❌ [Z-API] Erro ao processar webhook:', error);
      throw error;
    }
  }
}