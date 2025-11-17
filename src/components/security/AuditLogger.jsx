import { AuditLog } from "@/entities/AuditLog";
import { User } from "@/entities/User";

/**
 * AuditLogger - Sistema de Auditoria
 * Registra todas as ações críticas no sistema
 */
export class AuditLogger {
  
  /**
   * Registra uma ação no log de auditoria
   */
  static async log(config) {
    try {
      const user = await User.me().catch(() => null);
      
      const logEntry = {
        usuario_id: user?.id || 'anonimo',
        usuario_email: user?.email || 'anonimo',
        usuario_nome: user?.full_name || 'Anônimo',
        acao: config.acao,
        entidade_tipo: config.entidade_tipo,
        entidade_id: config.entidade_id,
        entidade_nome: config.entidade_nome,
        dados_anteriores: config.dados_anteriores,
        dados_novos: config.dados_novos,
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent,
        resultado: config.resultado || 'sucesso',
        motivo_bloqueio: config.motivo_bloqueio,
        metadata: config.metadata || {},
        timestamp: new Date().toISOString(),
        duracao_ms: config.duracao_ms
      };
      
      await AuditLog.create(logEntry);
      
      console.log(`📝 [Audit] ${config.acao} em ${config.entidade_tipo}`, logEntry);
      
    } catch (error) {
      console.error("❌ [Audit] Erro ao registrar log:", error);
      // Não falhar a operação principal se o log falhar
    }
  }
  
  /**
   * Registra criação de entidade
   */
  static async logCreate(entidadeTipo, entidadeId, entidadeNome, dados) {
    await this.log({
      acao: 'criar',
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      entidade_nome: entidadeNome,
      dados_novos: dados
    });
  }
  
  /**
   * Registra edição de entidade
   */
  static async logUpdate(entidadeTipo, entidadeId, entidadeNome, dadosAnteriores, dadosNovos) {
    await this.log({
      acao: 'editar',
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      entidade_nome: entidadeNome,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosNovos
    });
  }
  
  /**
   * Registra exclusão de entidade
   */
  static async logDelete(entidadeTipo, entidadeId, entidadeNome, dados) {
    await this.log({
      acao: 'deletar',
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      entidade_nome: entidadeNome,
      dados_anteriores: dados
    });
  }
  
  /**
   * Registra visualização de dados sensíveis
   */
  static async logView(entidadeTipo, entidadeId, entidadeNome) {
    await this.log({
      acao: 'visualizar',
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      entidade_nome: entidadeNome
    });
  }
  
  /**
   * Registra exportação de dados
   */
  static async logExport(entidadeTipo, quantidade, formato) {
    await this.log({
      acao: 'exportar',
      entidade_tipo: entidadeTipo,
      metadata: {
        quantidade,
        formato
      }
    });
  }
  
  /**
   * Registra tentativa bloqueada por permissão
   */
  static async logBlocked(acao, entidadeTipo, motivo) {
    await this.log({
      acao,
      entidade_tipo: entidadeTipo,
      resultado: 'bloqueado',
      motivo_bloqueio: motivo
    });
  }
  
  /**
   * Registra alteração de configuração
   */
  static async logConfigChange(configNome, valorAntigo, valorNovo) {
    await this.log({
      acao: 'config_alterar',
      entidade_tipo: 'Configuracao',
      entidade_nome: configNome,
      dados_anteriores: { valor: valorAntigo },
      dados_novos: { valor: valorNovo }
    });
  }
  
  /**
   * Registra execução de automação
   */
  static async logAutomationExecution(automacaoNome, resultado, detalhes) {
    await this.log({
      acao: 'automacao_executar',
      entidade_tipo: 'Automacao',
      entidade_nome: automacaoNome,
      resultado,
      metadata: detalhes
    });
  }
  
  /**
   * Busca logs de auditoria
   */
  static async getLogs(filtros = {}, limite = 100) {
    try {
      return await AuditLog.filter(filtros, '-timestamp', limite);
    } catch (error) {
      console.error("Erro ao buscar logs:", error);
      return [];
    }
  }
  
  /**
   * Busca logs de um usuário específico
   */
  static async getLogsByUser(userId, limite = 50) {
    return await this.getLogs({ usuario_id: userId }, limite);
  }
  
  /**
   * Busca logs de uma entidade específica
   */
  static async getLogsByEntity(entidadeTipo, entidadeId, limite = 20) {
    return await this.getLogs({ 
      entidade_tipo: entidadeTipo, 
      entidade_id: entidadeId 
    }, limite);
  }
  
  /**
   * Busca tentativas bloqueadas
   */
  static async getBlockedAttempts(limite = 50) {
    return await this.getLogs({ resultado: 'bloqueado' }, limite);
  }
  
  /**
   * Obtém IP do cliente (simplificado)
   */
  static async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }
}

export default AuditLogger;