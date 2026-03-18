/**
 * EvolutionAPIService - Integração com Evolution API
 * Documentação: https://doc.evolution-api.com
 */
export class EvolutionAPIService {
  
  static async enviarMensagem(integracao, destinatario, mensagem, opcoes = {}) {
    try {
      const baseUrl = integracao.base_url_provider;
      const instanceName = integracao.nome_instancia;
      const apiKey = integracao.api_key_provider;
      
      const url = `${baseUrl}/message/sendText/${instanceName}`;
      
      const payload = {
        number: destinatario.replace('@s.whatsapp.net', ''),
        text: mensagem,
        delay: opcoes.delay || 0
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evolution API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        messageId: data.key?.id,
        timestamp: data.messageTimestamp,
        provider: 'evolution_api'
      };
      
    } catch (error) {
      console.error("❌ [Evolution] Erro ao enviar mensagem:", error);
      throw error;
    }
  }

  static async enviarMidia(integracao, destinatario, mediaUrl, tipo, opcoes = {}) {
    try {
      const baseUrl = integracao.base_url_provider;
      const instanceName = integracao.nome_instancia;
      const apiKey = integracao.api_key_provider;
      
      const payload = {
        number: destinatario.replace('@s.whatsapp.net', ''),
        media: mediaUrl,
        caption: opcoes.caption || '',
        delay: opcoes.delay || 0
      };
      
      const url = `${baseUrl}/message/sendMedia/${instanceName}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evolution API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        messageId: data.key?.id,
        timestamp: data.messageTimestamp,
        provider: 'evolution_api'
      };
      
    } catch (error) {
      console.error("❌ [Evolution] Erro ao enviar mídia:", error);
      throw error;
    }
  }

  static async verificarConexao(integracao) {
    try {
      const baseUrl = integracao.base_url_provider;
      const instanceName = integracao.nome_instancia;
      const apiKey = integracao.api_key_provider;
      
      const url = `${baseUrl}/instance/connectionState/${instanceName}`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': apiKey
        }
      });
      
      if (!response.ok) {
        return {
          conectado: false,
          erro: `HTTP ${response.status}`
        };
      }
      
      const data = await response.json();
      
      return {
        conectado: data.state === 'open',
        status: data.state,
        detalhes: data
      };
      
    } catch (error) {
      return {
        conectado: false,
        erro: error.message
      };
    }
  }

  static async gerarQRCode(integracao) {
    try {
      const baseUrl = integracao.base_url_provider;
      const instanceName = integracao.nome_instancia;
      const apiKey = integracao.api_key_provider;
      
      const url = `${baseUrl}/instance/connect/${instanceName}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao gerar QR Code: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        qrcode: data.base64 || data.qrcode,
        code: data.code
      };
      
    } catch (error) {
      console.error("❌ [Evolution] Erro ao gerar QR Code:", error);
      throw error;
    }
  }

  static async validarWebhook(body, headers) {
    return true;
  }
}

export default EvolutionAPIService;