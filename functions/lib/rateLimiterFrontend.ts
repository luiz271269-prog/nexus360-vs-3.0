/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  RATE LIMITER FRONTEND - Promise Chain (sem race condition)  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class RateLimiterFrontend {
  private queue: Array<() => Promise<void>> = [];
  private processingPromise: Promise<void> = Promise.resolve();
  private delayMs: number;

  constructor(delayMs: number = 200) {
    this.delayMs = delayMs;
  }

  /**
   * Enfileira uma função para executar com rate limit
   * Garante execução sequencial sem race conditions
   */
  async enqueue(fn: () => Promise<void>): Promise<void> {
    this.queue.push(fn);
    // Encadeia processamento via Promise chain (seguro contra paralelos)
    this.processingPromise = this.processingPromise.then(() => this.process());
    // Espera o processamento completo
    await this.processingPromise;
  }

  /**
   * Processa fila sequencialmente
   */
  private async process(): Promise<void> {
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      try {
        await fn();
      } catch (error) {
        console.error('[RATE LIMITER] Erro ao processar:', error);
        // Continua processando próximas da fila mesmo com erro
      }
      // Aguarda delay antes de processar próxima
      await new Promise(r => setTimeout(r, this.delayMs));
    }
  }

  /**
   * Limpa fila pendente
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Retorna tamanho da fila
   */
  pendingCount(): number {
    return this.queue.length;
  }
}

// Instância global para envios de mensagens
export const messageSendRateLimiter = new RateLimiterFrontend(200); // 200ms entre envios