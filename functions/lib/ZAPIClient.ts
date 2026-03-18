/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ZAPI CLIENT - CLIENTE CENTRALIZADO PARA Z-API               ║
 * ║  Versão: 2.0 - Endpoints atualizados (2024-2025)           ║
 * ║  Documentação: https://developer.z-api.io                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class ZAPIClient {
  constructor(instanceId, clientToken, baseUrl = 'https://api.z-api.io') {
    this.instanceId = instanceId;
    this.clientToken = clientToken;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = 10000;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  formatarTelefone(numero) {
    if (!numero) {
      throw new Error('Número de telefone não fornecido');
    }

    let numeroLimpo = numero.replace(/\D/g, '');
    
    if (!numeroLimpo.startsWith('55')) {
      numeroLimpo = '55' + numeroLimpo;
    }

    if (numeroLimpo.length < 12 || numeroLimpo.length > 13) {
      throw new Error(`Número de telefone inválido: ${numero}. Esperado 12-13 dígitos (ex: 5548999999999)`);
    }

    return numeroLimpo;
  }

  async fazerRequisicao(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Client-Token': this.clientToken,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const fetchOptions = {
      method: options.method || 'GET',
      headers,
      ...(options.body && { body: JSON.stringify(options.body) })
    };

    let ultimoErro;

    for (let tentativa = 1; tentativa <= this.maxRetries; tentativa++) {
      try {
        console.log(`[ZAPI CLIENT] Tentativa ${tentativa}/${this.maxRetries}:`, {
          url,
          method: fetchOptions.method,
          body: options.body
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseText = await response.text();
        let responseData;

        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { rawResponse: responseText };
        }

        console.log(`[ZAPI CLIENT] Resposta HTTP ${response.status}:`, responseData);

        const erroSemantico = this.verificarErroSemantico(response.status, responseData);
        
        if (erroSemantico) {
          console.warn(`[ZAPI CLIENT] Erro semântico detectado:`, erroSemantico);
          return {
            success: false,
            status: response.status,
            error: erroSemantico.mensagem,
            tipo_erro: erroSemantico.tipo,
            data: responseData
          };
        }

        if (response.ok) {
          console.log(`[ZAPI CLIENT] Requisição bem-sucedida`);
          return {
            success: true,
            status: response.status,
            data: responseData
          };
        }

        ultimoErro = {
          success: false,
          status: response.status,
          error: this.interpretarErroHTTP(response.status, responseData),
          tipo_erro: this.classificarErroHTTP(response.status),
          data: responseData
        };

        if (response.status >= 500 && tentativa < this.maxRetries) {
          console.log(`[ZAPI CLIENT] Erro ${response.status}, aguardando retry...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * tentativa));
          continue;
        }

        return ultimoErro;

      } catch (error) {
        console.error(`[ZAPI CLIENT] Erro na tentativa ${tentativa}:`, error.message);
        
        ultimoErro = {
          success: false,
          status: 'NETWORK_ERROR',
          error: `Erro de rede ou timeout: ${error.message}`,
          tipo_erro: 'network',
          data: null
        };

        if (tentativa < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * tentativa));
        }
      }
    }

    return ultimoErro;
  }

  verificarErroSemantico(statusHTTP, responseData) {
    if (statusHTTP !== 200) return null;

    const textoResposta = JSON.stringify(responseData).toLowerCase();

    if (textoResposta.includes('not_found') || textoResposta.includes('not found')) {
      return {
        tipo: 'endpoint_invalido',
        mensagem: 'Endpoint não encontrado. Verifique a configuração da instância na Z-API.'
      };
    }

    if (textoResposta.includes('unable to find matching target resource method')) {
      return {
        tipo: 'metodo_nao_suportado',
        mensagem: 'Método ou recurso não suportado pela Z-API. Endpoint pode estar obsoleto.'
      };
    }

    if (responseData.error || responseData.message?.toLowerCase().includes('error')) {
      return {
        tipo: 'erro_api',
        mensagem: responseData.error || responseData.message
      };
    }

    return null;
  }

  interpretarErroHTTP(status, responseData) {
    const mensagensPadrao = {
      400: 'Requisição inválida. Verifique o formato do número de telefone e dos parâmetros.',
      401: 'Não autorizado. Verifique se o Client-Token está correto.',
      403: 'Acesso negado. A instância pode não ter permissão para esta ação.',
      404: 'Recurso não encontrado. O endpoint pode estar incorreto ou a instância não existe.',
      429: 'Muitas requisições. Aguarde alguns segundos e tente novamente.',
      500: 'Erro interno da Z-API. Tente novamente em alguns minutos.',
      503: 'Serviço Z-API temporariamente indisponível. Tente novamente.'
    };

    const mensagemEspecifica = responseData?.message || responseData?.error || responseData?.details;
    const mensagemPadrao = mensagensPadrao[status] || `Erro HTTP ${status}`;

    return mensagemEspecifica || mensagemPadrao;
  }

  classificarErroHTTP(status) {
    if (status >= 400 && status < 500) return 'client_error';
    if (status >= 500) return 'server_error';
    return 'unknown';
  }

  async obterStatusInstancia() {
    console.log('[ZAPI CLIENT] Obtendo status da instância...');
    
    let resultado = await this.fazerRequisicao(`/instances/${this.instanceId}/instance`);
    
    if (!resultado.success && resultado.tipo_erro === 'endpoint_invalido') {
      console.log('[ZAPI CLIENT] Tentando endpoint alternativo v2...');
      resultado = await this.fazerRequisicao(`/v2/${this.instanceId}/status`);
    }

    return resultado;
  }

  async enviarMensagemTexto(numeroDestino, mensagem) {
    console.log('[ZAPI CLIENT] Enviando mensagem de texto...');

    const numeroFormatado = this.formatarTelefone(numeroDestino);

    if (!mensagem || mensagem.trim().length === 0) {
      throw new Error('Mensagem não pode estar vazia');
    }

    const payload = {
      phone: numeroFormatado,
      message: mensagem.trim()
    };

    console.log('[ZAPI CLIENT] Payload:', payload);

    return await this.fazerRequisicao(`/instances/${this.instanceId}/messages/send-text`, {
      method: 'POST',
      body: payload
    });
  }

  async enviarImagem(numeroDestino, imageUrl, caption = '') {
    const numeroFormatado = this.formatarTelefone(numeroDestino);

    return await this.fazerRequisicao(`/instances/${this.instanceId}/messages/send-image`, {
      method: 'POST',
      body: {
        phone: numeroFormatado,
        image: imageUrl,
        caption: caption
      }
    });
  }

  async enviarVideo(numeroDestino, videoUrl, caption = '') {
    const numeroFormatado = this.formatarTelefone(numeroDestino);

    return await this.fazerRequisicao(`/instances/${this.instanceId}/messages/send-video`, {
      method: 'POST',
      body: {
        phone: numeroFormatado,
        video: videoUrl,
        caption: caption
      }
    });
  }

  async enviarAudio(numeroDestino, audioUrl) {
    const numeroFormatado = this.formatarTelefone(numeroDestino);

    return await this.fazerRequisicao(`/instances/${this.instanceId}/messages/send-audio`, {
      method: 'POST',
      body: {
        phone: numeroFormatado,
        audio: audioUrl
      }
    });
  }

  async enviarDocumento(numeroDestino, documentUrl, filename = 'documento.pdf') {
    const numeroFormatado = this.formatarTelefone(numeroDestino);

    return await this.fazerRequisicao(`/instances/${this.instanceId}/messages/send-document`, {
      method: 'POST',
      body: {
        phone: numeroFormatado,
        document: documentUrl,
        filename: filename
      }
    });
  }
}