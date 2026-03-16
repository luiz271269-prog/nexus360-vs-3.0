/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  RETRY HANDLER - Tratamento de Retry e Circuit Breaker      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class CircuitBreaker {
  constructor(name, failureThreshold = 5, resetTimeout = 60000) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.warn(`[CIRCUIT BREAKER] ${this.name} opened after ${this.failureCount} failures`);
    }
  }
}

export const circuitBreakers = {
  database: new CircuitBreaker('database', 5, 60000),
  whatsapp: new CircuitBreaker('whatsapp', 3, 30000),
  llm: new CircuitBreaker('llm', 3, 30000)
};

export class RetryHandler {
  static async executeWithRetry(fn, options = {}) {
    const {
      maxRetries = 3,
      initialDelayMs = 1000,
      maxDelayMs = 10000,
      backoffMultiplier = 2,
      circuitBreaker = null,
      onFailureExhausted = null
    } = options;

    let lastError;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (circuitBreaker) {
          return await circuitBreaker.execute(fn);
        }
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Detectar 429 corretamente no Base44 SDK
        const is429 = error?.message?.includes('429') || error?.status === 429;
        
        if (attempt === maxRetries) {
          console.error(`[RETRY] Failed after ${maxRetries} attempts:`, error);
          
          // Se é 429 e esgotou retries, chamar callback de mensagem perdida
          if (is429 && onFailureExhausted) {
            await onFailureExhausted(error);
          }
          
          throw error;
        }

        // Não fazer retry se não é 429
        if (!is429) {
          console.error(`[RETRY] Non-retriable error (${error?.status || 'unknown'}), aborting:`, error);
          throw error;
        }

        console.warn(`[RETRY] 429 Rate Limit detected, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }

    throw lastError;
  }
}