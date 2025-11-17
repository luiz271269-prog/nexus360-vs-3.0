/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  NOTIFICATION SERVICE - NOTIFICAÇÕES EM TEMPO REAL          ║
 * ║  Usa Server-Sent Events (SSE) para push notifications       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

class NotificationService {
  constructor() {
    this.listeners = new Map();
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 segundo inicial
  }

  /**
   * Conecta ao servidor SSE para receber notificações
   */
  connect(userId) {
    if (this.eventSource) {
      console.log('⚠️ Já conectado ao SSE');
      return;
    }

    try {
      // TODO: Substituir pela URL real do endpoint SSE quando disponível
      // this.eventSource = new EventSource(`/api/notifications/stream?userId=${userId}`);
      
      console.log('🔌 Conectando ao servidor de notificações (modo simulação)...');
      
      // Simulação para desenvolvimento - remover em produção
      this.simulateConnection();
      
      /*
      QUANDO SSE ESTIVER PRONTO NO BACKEND, USE ESTE CÓDIGO:
      
      this.eventSource = new EventSource(`/api/notifications/stream?userId=${userId}`);
      
      this.eventSource.onopen = () => {
        console.log('✅ Conectado ao servidor de notificações');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          this.handleNotification(notification);
        } catch (error) {
          console.error('❌ Erro ao processar notificação:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ Erro na conexão SSE:', error);
        this.eventSource.close();
        this.eventSource = null;
        this.attemptReconnect(userId);
      };
      */
    } catch (error) {
      console.error('❌ Erro ao conectar ao SSE:', error);
    }
  }

  /**
   * Simula conexão SSE para desenvolvimento
   * TODO: Remover quando SSE estiver implementado no backend
   */
  simulateConnection() {
    console.log('🔧 Modo simulação SSE ativo (desenvolvimento)');
    
    // Mock completo do EventSource com todos os métodos necessários
    this.eventSource = {
      readyState: 1, // 1 = OPEN
      close: () => {
        console.log('🔌 Mock SSE: close() chamado');
        this.eventSource.readyState = 2; // 2 = CLOSED
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  }

  /**
   * Tenta reconectar ao servidor SSE
   */
  attemptReconnect(userId) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Número máximo de tentativas de reconexão atingido');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(userId);
    }, delay);
  }

  /**
   * Processa notificação recebida
   */
  handleNotification(notification) {
    console.log('📬 Notificação recebida:', notification);
    
    const { type, data, timestamp } = notification;
    
    // Chamar listeners registrados para este tipo de notificação
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(callback => {
      try {
        callback(data, timestamp);
      } catch (error) {
        console.error(`❌ Erro ao executar listener para ${type}:`, error);
      }
    });
    
    // Listener global (se existir)
    const globalListeners = this.listeners.get('*') || [];
    globalListeners.forEach(callback => {
      try {
        callback({ type, data, timestamp });
      } catch (error) {
        console.error('❌ Erro ao executar listener global:', error);
      }
    });
  }

  /**
   * Registra listener para tipo específico de notificação
   */
  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
    
    // Retorna função para remover o listener
    return () => this.off(type, callback);
  }

  /**
   * Remove listener
   */
  off(type, callback) {
    if (!this.listeners.has(type)) return;
    
    const listeners = this.listeners.get(type);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Envia notificação local (para testes ou fallback)
   */
  sendLocalNotification(type, data) {
    this.handleNotification({
      type,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Desconecta do servidor SSE
   */
  disconnect() {
    if (this.eventSource && typeof this.eventSource.close === 'function') {
      try {
        this.eventSource.close();
        console.log('🔌 Desconectado do servidor de notificações');
      } catch (error) {
        console.error('⚠️ Erro ao desconectar:', error);
      }
      this.eventSource = null;
    }
    this.listeners.clear();
  }

  /**
   * Verifica se está conectado
   */
  isConnected() {
    return this.eventSource && this.eventSource.readyState === 1;
  }
}

// Exportar instância singleton como default
const notificationService = new NotificationService();
export default notificationService;