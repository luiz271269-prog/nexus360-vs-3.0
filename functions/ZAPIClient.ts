/**
 * Cliente Z-API Centralizado e Robusto
 * Versão 2.0 com Retry Logic e Logs Detalhados
 */

export class ZAPIClient {
  constructor(instanceId, clientToken, baseUrl = 'https://api.z-api.io') {
    if (!instanceId || !clientToken) {
      throw new Error('ZAPIClient requer instanceId e clientToken');
    }

    this.instanceId = instanceId.trim();
    this.clientToken = clientToken.trim();
    this.baseUrl = baseUrl.replace(/\/$/, '');
    
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  }

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _fetchWithRetry(url, options, attempt = 1) {
    try {
      console.log(`[ZAPIClient] Requisicao (tentativa ${attempt}/${this.maxRetries}): ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status >= 400) {
        const errorBody = await response.text();
        console.error(`[ZAPIClient] Erro HTTP ${response.status}:`, {
          url,
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (this.retryableStatusCodes.includes(response.status) && attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`[ZAPIClient] Retry em ${delay}ms...`);
          await this._sleep(delay);
          return this._fetchWithRetry(url, options, attempt + 1);
        }

        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      console.log(`[ZAPIClient] Sucesso (tentativa ${attempt}):`, data);
      return data;

    } catch (error) {
      console.error(`[ZAPIClient] Erro na tentativa ${attempt}:`, error);

      if (attempt < this.maxRetries && (error.name === 'AbortError' || error.message.includes('fetch'))) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`[ZAPIClient] Retry em ${delay}ms (erro de rede)...`);
        await this._sleep(delay);
        return this._fetchWithRetry(url, options, attempt + 1);
      }

      throw error;
    }
  }

  async getStatus() {
    const url = `${this.baseUrl}/instances/${this.instanceId}/status`;
    
    return this._fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': this.clientToken
      }
    });
  }

  async sendText(phone, message) {
    const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.clientToken}/send-text`;
    
    return this._fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });
  }

  async sendImage(phone, image, caption = '') {
    const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.clientToken}/send-image`;
    
    return this._fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, image, caption })
    });
  }

  async sendAudio(phone, audio) {
    const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.clientToken}/send-audio`;
    
    return this._fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, audio })
    });
  }

  async sendDocument(phone, document, filename = 'documento.pdf') {
    const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.clientToken}/send-document`;
    
    return this._fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, document, filename })
    });
  }

  async request(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.clientToken}${endpoint}`;
    
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return this._fetchWithRetry(url, options);
  }
}