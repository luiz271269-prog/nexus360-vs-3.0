/**
 * Connection Manager - Gerenciamento Profissional de Múltiplas Conexões WhatsApp
 * 
 * Responsabilidades:
 * - Registro e rastreamento de conexões ativas por instanceId
 * - Atualização de timestamp de última atividade
 * - Limpeza automática de conexões inativas
 * - Métricas e estatísticas por conexão
 * - Validação de instância antes do processamento
 */

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;   // 2 minutos

class ConnectionManager {
  constructor() {
    this.activeConnections = new Map();
    this.metrics = {
      total_connections_created: 0,
      total_connections_removed: 0,
      total_events_processed: 0
    };
    
    this.startCleanupTimer();
    console.log('[ConnectionManager] Initialized');
  }

  /**
   * Registra ou atualiza uma conexão ativa
   */
  register(instanceId, payload = {}) {
    if (!instanceId || instanceId === 'unknown') {
      console.warn('[ConnectionManager] Invalid instanceId provided');
      return false;
    }

    const now = Date.now();
    const existing = this.activeConnections.get(instanceId);

    if (!existing) {
      // Nova conexão
      this.activeConnections.set(instanceId, {
        instanceId: instanceId,
        status: 'active',
        firstSeen: now,
        lastActivity: now,
        eventCount: 1,
        provider: payload.provider || 'z_api',
        metadata: {
          phone: payload.phone || null,
          instanceName: payload.instanceName || null
        }
      });
      this.metrics.total_connections_created++;
      console.log(`[ConnectionManager] NEW connection registered: ${instanceId}`);
    } else {
      // Atualizar conexão existente
      existing.lastActivity = now;
      existing.eventCount++;
      this.activeConnections.set(instanceId, existing);
    }

    this.metrics.total_events_processed++;
    return true;
  }

  /**
   * Obtém informações de uma conexão
   */
  getConnection(instanceId) {
    return this.activeConnections.get(instanceId) || null;
  }

  /**
   * Valida se uma conexão está ativa
   */
  isActive(instanceId) {
    const connection = this.activeConnections.get(instanceId);
    if (!connection) return false;

    const now = Date.now();
    const isActive = (now - connection.lastActivity) < INACTIVITY_TIMEOUT_MS;
    
    if (!isActive) {
      console.warn(`[ConnectionManager] Connection ${instanceId} is INACTIVE (last activity: ${new Date(connection.lastActivity).toISOString()})`);
    }

    return isActive;
  }

  /**
   * Remove conexões inativas
   */
  cleanupInactive() {
    const now = Date.now();
    let removedCount = 0;

    for (const [instanceId, connection] of this.activeConnections.entries()) {
      const inactiveTime = now - connection.lastActivity;
      
      if (inactiveTime > INACTIVITY_TIMEOUT_MS) {
        this.activeConnections.delete(instanceId);
        removedCount++;
        this.metrics.total_connections_removed++;
        
        console.log(`[ConnectionManager] REMOVED inactive connection: ${instanceId} (inactive for ${Math.round(inactiveTime / 1000)}s)`);
      }
    }

    if (removedCount > 0) {
      console.log(`[ConnectionManager] Cleanup completed: ${removedCount} connection(s) removed`);
    }

    return removedCount;
  }

  /**
   * Inicia timer automático de limpeza
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupInactive();
    }, CLEANUP_INTERVAL_MS);

    console.log('[ConnectionManager] Cleanup timer started');
  }

  /**
   * Para o timer de limpeza
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[ConnectionManager] Cleanup timer stopped');
    }
  }

  /**
   * Retorna estatísticas gerais
   */
  getMetrics() {
    const activeCount = this.activeConnections.size;
    const connections = Array.from(this.activeConnections.values());

    return {
      active_connections: activeCount,
      total_connections_created: this.metrics.total_connections_created,
      total_connections_removed: this.metrics.total_connections_removed,
      total_events_processed: this.metrics.total_events_processed,
      connections: connections.map(conn => ({
        instanceId: conn.instanceId,
        status: conn.status,
        uptime_seconds: Math.round((Date.now() - conn.firstSeen) / 1000),
        last_activity_seconds_ago: Math.round((Date.now() - conn.lastActivity) / 1000),
        event_count: conn.eventCount,
        provider: conn.provider
      }))
    };
  }

  /**
   * Retorna lista de conexões ativas
   */
  listActiveConnections() {
    return Array.from(this.activeConnections.keys());
  }

  /**
   * Remove uma conexão específica
   */
  remove(instanceId) {
    const existed = this.activeConnections.has(instanceId);
    if (existed) {
      this.activeConnections.delete(instanceId);
      this.metrics.total_connections_removed++;
      console.log(`[ConnectionManager] Connection manually removed: ${instanceId}`);
    }
    return existed;
  }

  /**
   * Limpa todas as conexões (use com cuidado)
   */
  clear() {
    const count = this.activeConnections.size;
    this.activeConnections.clear();
    console.log(`[ConnectionManager] All connections cleared: ${count} connection(s)`);
    return count;
  }
}

// Singleton instance
const connectionManager = new ConnectionManager();

export { connectionManager };