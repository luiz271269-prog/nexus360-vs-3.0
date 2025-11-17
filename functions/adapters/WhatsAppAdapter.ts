
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  WHATSAPP ADAPTER - VERSÃO FINAL CORRIGIDA                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export default class WhatsAppAdapter {
  
  /**
   * Verifica conexão com o provider
   */
  static async verificarConexao(integracao) {
    try {
      if (integracao.api_provider === 'z_api') {
        return await this.verificarConexaoZAPI(integracao);
      } else if (integracao.api_provider === 'evolution_api') {
        return await this.verificarConexaoEvolution(integracao);
      }
      
      throw new Error('Provider não suportado');
    } catch (error) {
      console.error('❌ [Adapter] Erro:', error);
      return {
        conectado: false,
        erro: error.message
      };
    }
  }

  /**
   * Verifica conexão Z-API
   */
  static async verificarConexaoZAPI(integracao) {
    try {
      const baseUrl = integracao.base_url_provider.replace(/\/$/, '');
      const url = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;

      // SEM header Client-Token!
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      
      // A Z-API retorna 400 com mensagem de "phone is required" se a instância e o token estiverem corretos, mas não houver 'phone' no payload.
      // Isso indica que a conexão (autenticação) está OK.
      const autenticado = response.status === 400 && 
                         (data.error?.includes('phone') || 
                          data.message?.includes('phone'));
      
      const conectado = response.ok || autenticado;

      return {
        conectado,
        dados_conexao: data,
        mensagem: conectado ? 'WhatsApp conectado' : 'WhatsApp desconectado'
      };
    } catch (error) {
      return {
        conectado: false,
        erro: error.message
      };
    }
  }

  /**
   * Verifica conexão Evolution API
   */
  static async verificarConexaoEvolution(integracao) {
    try {
      const baseUrl = integracao.base_url_provider.replace(/\/$/, '');
      const url = `${baseUrl}/instance/connectionState/${integracao.instance_id_provider}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': integracao.api_key_provider
        }
      });

      const data = await response.json();
      const conectado = data.state === 'open';

      return {
        conectado,
        dados_conexao: data,
        mensagem: conectado ? 'WhatsApp conectado' : 'WhatsApp desconectado'
      };
    } catch (error) {
      return {
        conectado: false,
        erro: error.message
      };
    }
  }

  /**
   * Envia mensagem
   */
  static async enviarMensagem(integracao, destinatario, conteudo, opcoes = {}) {
    if (integracao.api_provider === 'z_api') {
      return await this.enviarMensagemZAPI(integracao, destinatario, conteudo, opcoes);
    } else if (integracao.api_provider === 'evolution_api') {
      return await this.enviarMensagemEvolution(integracao, destinatario, conteudo, opcoes);
    }
    
    throw new Error('Provider não suportado');
  }

  /**
   * Envia mensagem Z-API
   */
  static async enviarMensagemZAPI(integracao, destinatario, conteudo, opcoes = {}) {
    try {
      const numeroLimpo = destinatario.replace(/\D/g, '');
      const baseUrl = integracao.base_url_provider.replace(/\/$/, '');
      
      if (opcoes.media_url) {
        // Enviar mídia
        const mediaTypeMap = {
          'image': 'send-image',
          'video': 'send-video',
          'audio': 'send-audio',
          'document': 'send-document'
        };
        
        const endpoint = mediaTypeMap[opcoes.media_type] || 'send-document';
        const url = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/${endpoint}`;
        
        const payload = {
          phone: numeroLimpo,
          [opcoes.media_type]: opcoes.media_url,
          caption: conteudo || ''
        };
        
        // SEM header Client-Token!
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
      } else {
        // Enviar texto
        const url = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
        
        const payload = {
          phone: numeroLimpo,
          message: conteudo
        };
        
        // SEM header Client-Token!
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
      }
    } catch (error) {
      console.error('❌ [Z-API] Erro ao enviar:', error);
      throw error;
    }
  }

  /**
   * Envia mensagem Evolution API
   */
  static async enviarMensagemEvolution(integracao, destinatario, conteudo) {
    try {
      const baseUrl = integracao.base_url_provider.replace(/\/$/, '');
      const url = `${baseUrl}/message/sendText/${integracao.instance_id_provider}`;
      
      const payload = {
        number: destinatario.replace(/\D/g, ''),
        text: conteudo
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': integracao.api_key_provider
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ [Evolution] Erro ao enviar:', error);
      throw error;
    }
  }
}
