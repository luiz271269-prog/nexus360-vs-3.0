/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ERROR HANDLER - Tratamento Centralizado de Erros          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class ErrorHandler {
  static ERROR_CATEGORIES = {
    VALIDATION: 'validation',
    NETWORK: 'network',
    DATABASE: 'database',
    INTEGRATION: 'integration',
    RATE_LIMIT: 'rate_limit',
    TIMEOUT: 'timeout',
    UNKNOWN: 'unknown'
  };

  static categorizeError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';

    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return this.ERROR_CATEGORIES.VALIDATION;
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorName.includes('network')) {
      return this.ERROR_CATEGORIES.NETWORK;
    }
    
    if (errorMessage.includes('database') || errorMessage.includes('query')) {
      return this.ERROR_CATEGORIES.DATABASE;
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return this.ERROR_CATEGORIES.RATE_LIMIT;
    }
    
    if (errorMessage.includes('timeout') || errorName.includes('timeout')) {
      return this.ERROR_CATEGORIES.TIMEOUT;
    }
    
    if (errorMessage.includes('integration') || errorMessage.includes('api')) {
      return this.ERROR_CATEGORIES.INTEGRATION;
    }

    return this.ERROR_CATEGORIES.UNKNOWN;
  }

  static handle(error, context = {}) {
    const category = this.categorizeError(error);
    const retryable = [
      this.ERROR_CATEGORIES.NETWORK,
      this.ERROR_CATEGORIES.TIMEOUT,
      this.ERROR_CATEGORIES.RATE_LIMIT
    ].includes(category);

    const errorInfo = {
      message: error.message,
      category,
      retryable,
      context,
      timestamp: new Date().toISOString(),
      userMessage: this.getUserMessage(category)
    };

    console.error('[ERROR HANDLER]', errorInfo);

    return errorInfo;
  }

  static getUserMessage(category) {
    const messages = {
      [this.ERROR_CATEGORIES.VALIDATION]: 'Dados inválidos fornecidos',
      [this.ERROR_CATEGORIES.NETWORK]: 'Erro de conexão. Tente novamente.',
      [this.ERROR_CATEGORIES.DATABASE]: 'Erro ao acessar dados. Tente novamente.',
      [this.ERROR_CATEGORIES.INTEGRATION]: 'Erro na integração externa. Tente novamente.',
      [this.ERROR_CATEGORIES.RATE_LIMIT]: 'Muitas requisições. Aguarde um momento.',
      [this.ERROR_CATEGORIES.TIMEOUT]: 'Operação demorou muito. Tente novamente.',
      [this.ERROR_CATEGORIES.UNKNOWN]: 'Erro inesperado. Entre em contato com o suporte.'
    };

    return messages[category] || messages[this.ERROR_CATEGORIES.UNKNOWN];
  }
}