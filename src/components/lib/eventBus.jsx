/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  EVENT BUS UNIFICADO - SISTEMA DE EVENTOS                   ║
 * ║  Arquitetura Event-Driven para o VendaPro                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

class EventBus {
  constructor() {
    this.listeners = {};
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Registra um listener para um evento
   */
  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
    
    // Retorna função para remover o listener
    return () => this.off(eventName, callback);
  }

  /**
   * Registra um listener que será executado apenas uma vez
   */
  once(eventName, callback) {
    const wrappedCallback = (...args) => {
      callback(...args);
      this.off(eventName, wrappedCallback);
    };
    return this.on(eventName, wrappedCallback);
  }

  /**
   * Remove um listener específico
   */
  off(eventName, callback) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
  }

  /**
   * Remove todos os listeners de um evento
   */
  removeAllListeners(eventName) {
    if (eventName) {
      delete this.listeners[eventName];
    } else {
      this.listeners = {};
    }
  }

  /**
   * Emite um evento para todos os listeners
   */
  async emit(eventName, data) {
    console.log(`📡 [EventBus] Emitindo evento: ${eventName}`, data);
    
    // Salva no histórico
    this.eventHistory.push({
      eventName,
      data,
      timestamp: new Date().toISOString()
    });
    
    // Limita tamanho do histórico
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // Executa todos os listeners
    const listeners = this.listeners[eventName] || [];
    const promises = listeners.map(callback => {
      try {
        return Promise.resolve(callback(data));
      } catch (error) {
        console.error(`❌ [EventBus] Erro no listener de ${eventName}:`, error);
        return Promise.resolve();
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Retorna o histórico de eventos
   */
  getHistory(eventName = null, limit = 100) {
    let history = [...this.eventHistory];
    
    if (eventName) {
      history = history.filter(event => event.eventName === eventName);
    }
    
    return history.slice(-limit);
  }

  /**
   * Limpa o histórico de eventos
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

// Singleton
const eventBus = new EventBus();

// Tipos de eventos do sistema
export const EVENTOS = {
  // Clientes
  CLIENTE_CRIADO: 'CLIENTE_CRIADO',
  CLIENTE_ATUALIZADO: 'CLIENTE_ATUALIZADO',
  CLIENTE_IMPORTADO: 'CLIENTE_IMPORTADO',
  
  // Vendas
  VENDA_CRIADA: 'VENDA_CRIADA',
  VENDA_ATUALIZADA: 'VENDA_ATUALIZADA',
  VENDA_IMPORTADA: 'VENDA_IMPORTADA',
  
  // Orçamentos
  ORCAMENTO_CRIADO: 'ORCAMENTO_CRIADO',
  ORCAMENTO_ATUALIZADO: 'ORCAMENTO_ATUALIZADO',
  ORCAMENTO_STATUS_MUDOU: 'ORCAMENTO_STATUS_MUDOU',
  ORCAMENTO_IMPORTADO: 'ORCAMENTO_IMPORTADO',
  
  // Produtos
  PRODUTO_CRIADO: 'PRODUTO_CRIADO',
  PRODUTO_ATUALIZADO: 'PRODUTO_ATUALIZADO',
  PRODUTO_IMPORTADO: 'PRODUTO_IMPORTADO',
  
  // Interações
  INTERACAO_CRIADA: 'INTERACAO_CRIADA',
  MENSAGEM_WHATSAPP_RECEBIDA: 'MENSAGEM_WHATSAPP_RECEBIDA',
  MENSAGEM_WHATSAPP_ENVIADA: 'MENSAGEM_WHATSAPP_ENVIADA',
  
  // Tarefas
  TAREFA_CRIADA: 'TAREFA_CRIADA',
  TAREFA_CONCLUIDA: 'TAREFA_CONCLUIDA',
  
  // Scores
  SCORE_ATUALIZADO: 'SCORE_ATUALIZADO',
  
  // Automações
  AUTOMACAO_EXECUTADA: 'AUTOMACAO_EXECUTADA',
  
  // Importação
  IMPORTACAO_INICIADA: 'IMPORTACAO_INICIADA',
  IMPORTACAO_CONCLUIDA: 'IMPORTACAO_CONCLUIDA',
  IMPORTACAO_ERRO: 'IMPORTACAO_ERRO',
  
  // Google Sheets
  SHEETS_DADOS_LIDOS: 'SHEETS_DADOS_LIDOS',
  SHEETS_DADOS_ESCRITOS: 'SHEETS_DADOS_ESCRITOS',
  SHEETS_SINCRONIZACAO: 'SHEETS_SINCRONIZACAO'
};

export default eventBus;