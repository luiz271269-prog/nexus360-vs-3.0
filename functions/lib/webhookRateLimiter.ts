/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  RATE LIMITER PARA WEBHOOKS                                  ║
 * ║  Previne sobrecarga em picos de tráfego                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

class WebhookRateLimiter {
  constructor(maxRequestsPerMinute = 100) {
    this.maxRequests = maxRequestsPerMinute;
    this.requests = new Map(); // instanceId -> [timestamps]
    this.cleanupInterval = 60000; // 1 minuto
    
    // Limpeza periódica
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  checkLimit(instanceId) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Obter ou criar array de timestamps para esta instância
    if (!this.requests.has(instanceId)) {
      this.requests.set(instanceId, []);
    }
    
    const timestamps = this.requests.get(instanceId);
    
    // Remover timestamps antigos (mais de 1 minuto)
    const recentRequests = timestamps.filter(ts => ts > oneMinuteAgo);
    this.requests.set(instanceId, recentRequests);
    
    // Verificar se excedeu o limite
    if (recentRequests.length >= this.maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((recentRequests[0] + 60000 - now) / 1000)
      };
    }
    
    // Adicionar timestamp atual
    recentRequests.push(now);
    this.requests.set(instanceId, recentRequests);
    
    return {
      allowed: true,
      remaining: this.maxRequests - recentRequests.length
    };
  }

  cleanup() {
    const oneMinuteAgo = Date.now() - 60000;
    
    for (const [instanceId, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(ts => ts > oneMinuteAgo);
      
      if (recentRequests.length === 0) {
        this.requests.delete(instanceId);
      } else {
        this.requests.set(instanceId, recentRequests);
      }
    }
  }

  getStats() {
    const stats = {};
    
    for (const [instanceId, timestamps] of this.requests.entries()) {
      stats[instanceId] = {
        requestsLastMinute: timestamps.length,
        remaining: this.maxRequests - timestamps.length
      };
    }
    
    return stats;
  }
}

// Singleton global
const globalWebhookLimiter = new WebhookRateLimiter(100);

export { globalWebhookLimiter, WebhookRateLimiter };