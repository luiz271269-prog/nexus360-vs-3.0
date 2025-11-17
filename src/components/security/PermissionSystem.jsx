/**
 * PermissionSystem - Sistema de Controle de Acesso Granular
 * Define permissões, roles e políticas de segurança
 */

export const PERMISSIONS = {
  // ===== CLIENTES =====
  CLIENTES_VISUALIZAR: 'clientes:read',
  CLIENTES_CRIAR: 'clientes:create',
  CLIENTES_EDITAR: 'clientes:update',
  CLIENTES_DELETAR: 'clientes:delete',
  CLIENTES_EXPORTAR: 'clientes:export',
  CLIENTES_VER_TODOS: 'clientes:read:all', // Admins veem todos, users só os seus
  
  // ===== VENDAS =====
  VENDAS_VISUALIZAR: 'vendas:read',
  VENDAS_CRIAR: 'vendas:create',
  VENDAS_EDITAR: 'vendas:update',
  VENDAS_DELETAR: 'vendas:delete',
  VENDAS_EXPORTAR: 'vendas:export',
  VENDAS_VER_TODAS: 'vendas:read:all',
  
  // ===== ORÇAMENTOS =====
  ORCAMENTOS_VISUALIZAR: 'orcamentos:read',
  ORCAMENTOS_CRIAR: 'orcamentos:create',
  ORCAMENTOS_EDITAR: 'orcamentos:update',
  ORCAMENTOS_DELETAR: 'orcamentos:delete',
  ORCAMENTOS_APROVAR: 'orcamentos:approve',
  ORCAMENTOS_EXPORTAR: 'orcamentos:export',
  ORCAMENTOS_VER_TODOS: 'orcamentos:read:all',
  
  // ===== PRODUTOS =====
  PRODUTOS_VISUALIZAR: 'produtos:read',
  PRODUTOS_CRIAR: 'produtos:create',
  PRODUTOS_EDITAR: 'produtos:update',
  PRODUTOS_DELETAR: 'produtos:delete',
  PRODUTOS_IMPORTAR: 'produtos:import',
  
  // ===== VENDEDORES =====
  VENDEDORES_VISUALIZAR: 'vendedores:read',
  VENDEDORES_CRIAR: 'vendedores:create',
  VENDEDORES_EDITAR: 'vendedores:update',
  VENDEDORES_DELETAR: 'vendedores:delete',
  VENDEDORES_VER_PERFORMANCE: 'vendedores:performance',
  
  // ===== RELATÓRIOS =====
  RELATORIOS_VISUALIZAR: 'relatorios:read',
  RELATORIOS_EXPORTAR: 'relatorios:export',
  RELATORIOS_FINANCEIROS: 'relatorios:financeiros',
  RELATORIOS_GERENCIAIS: 'relatorios:gerenciais',
  
  // ===== ANALYTICS =====
  ANALYTICS_BASICO: 'analytics:basic',
  ANALYTICS_AVANCADO: 'analytics:advanced',
  ANALYTICS_PREDITIVO: 'analytics:predictive',
  
  // ===== AUTOMAÇÃO =====
  AUTOMACAO_VISUALIZAR: 'automacao:read',
  AUTOMACAO_CRIAR: 'automacao:create',
  AUTOMACAO_EDITAR: 'automacao:update',
  AUTOMACAO_DELETAR: 'automacao:delete',
  AUTOMACAO_EXECUTAR: 'automacao:execute',
  
  // ===== COMUNICAÇÃO =====
  WHATSAPP_ENVIAR: 'whatsapp:send',
  WHATSAPP_VER_CONVERSAS: 'whatsapp:conversations',
  WHATSAPP_CONFIGURAR: 'whatsapp:configure',
  EMAIL_ENVIAR: 'email:send',
  
  // ===== CONFIGURAÇÕES =====
  CONFIG_SISTEMA: 'config:system',
  CONFIG_INTEGRACAO: 'config:integration',
  CONFIG_IA: 'config:ai',
  CONFIG_USUARIOS: 'config:users',
  
  // ===== IMPORTAÇÃO =====
  IMPORTACAO_EXECUTAR: 'import:execute',
  IMPORTACAO_REVISAR: 'import:review',
  IMPORTACAO_APROVAR: 'import:approve',
  
  // ===== BASE CONHECIMENTO =====
  CONHECIMENTO_VISUALIZAR: 'knowledge:read',
  CONHECIMENTO_CRIAR: 'knowledge:create',
  CONHECIMENTO_EDITAR: 'knowledge:update',
  CONHECIMENTO_DELETAR: 'knowledge:delete',
  CONHECIMENTO_APROVAR: 'knowledge:approve',
  
  // ===== AUDITORIA =====
  AUDITORIA_VISUALIZAR: 'audit:read',
  AUDITORIA_EXPORTAR: 'audit:export',
  
  // ===== ADMIN =====
  ADMIN_FULL_ACCESS: 'admin:*'
};

export const ROLES = {
  SUPER_ADMIN: {
    id: 'super_admin',
    nome: 'Super Administrador',
    descricao: 'Acesso completo ao sistema',
    permissions: [PERMISSIONS.ADMIN_FULL_ACCESS]
  },
  
  ADMIN: {
    id: 'admin',
    nome: 'Administrador',
    descricao: 'Gerencia o sistema e usuários',
    permissions: [
      // Clientes
      PERMISSIONS.CLIENTES_VISUALIZAR,
      PERMISSIONS.CLIENTES_CRIAR,
      PERMISSIONS.CLIENTES_EDITAR,
      PERMISSIONS.CLIENTES_DELETAR,
      PERMISSIONS.CLIENTES_EXPORTAR,
      PERMISSIONS.CLIENTES_VER_TODOS,
      
      // Vendas
      PERMISSIONS.VENDAS_VISUALIZAR,
      PERMISSIONS.VENDAS_CRIAR,
      PERMISSIONS.VENDAS_EDITAR,
      PERMISSIONS.VENDAS_DELETAR,
      PERMISSIONS.VENDAS_EXPORTAR,
      PERMISSIONS.VENDAS_VER_TODAS,
      
      // Orçamentos
      PERMISSIONS.ORCAMENTOS_VISUALIZAR,
      PERMISSIONS.ORCAMENTOS_CRIAR,
      PERMISSIONS.ORCAMENTOS_EDITAR,
      PERMISSIONS.ORCAMENTOS_DELETAR,
      PERMISSIONS.ORCAMENTOS_APROVAR,
      PERMISSIONS.ORCAMENTOS_EXPORTAR,
      PERMISSIONS.ORCAMENTOS_VER_TODOS,
      
      // Produtos
      PERMISSIONS.PRODUTOS_VISUALIZAR,
      PERMISSIONS.PRODUTOS_CRIAR,
      PERMISSIONS.PRODUTOS_EDITAR,
      PERMISSIONS.PRODUTOS_DELETAR,
      PERMISSIONS.PRODUTOS_IMPORTAR,
      
      // Vendedores
      PERMISSIONS.VENDEDORES_VISUALIZAR,
      PERMISSIONS.VENDEDORES_CRIAR,
      PERMISSIONS.VENDEDORES_EDITAR,
      PERMISSIONS.VENDEDORES_DELETAR,
      PERMISSIONS.VENDEDORES_VER_PERFORMANCE,
      
      // Relatórios
      PERMISSIONS.RELATORIOS_VISUALIZAR,
      PERMISSIONS.RELATORIOS_EXPORTAR,
      PERMISSIONS.RELATORIOS_FINANCEIROS,
      PERMISSIONS.RELATORIOS_GERENCIAIS,
      
      // Analytics
      PERMISSIONS.ANALYTICS_BASICO,
      PERMISSIONS.ANALYTICS_AVANCADO,
      PERMISSIONS.ANALYTICS_PREDITIVO,
      
      // Automação
      PERMISSIONS.AUTOMACAO_VISUALIZAR,
      PERMISSIONS.AUTOMACAO_CRIAR,
      PERMISSIONS.AUTOMACAO_EDITAR,
      PERMISSIONS.AUTOMACAO_DELETAR,
      PERMISSIONS.AUTOMACAO_EXECUTAR,
      
      // Comunicação
      PERMISSIONS.WHATSAPP_ENVIAR,
      PERMISSIONS.WHATSAPP_VER_CONVERSAS,
      PERMISSIONS.WHATSAPP_CONFIGURAR,
      PERMISSIONS.EMAIL_ENVIAR,
      
      // Configurações
      PERMISSIONS.CONFIG_SISTEMA,
      PERMISSIONS.CONFIG_INTEGRACAO,
      PERMISSIONS.CONFIG_IA,
      PERMISSIONS.CONFIG_USUARIOS,
      
      // Importação
      PERMISSIONS.IMPORTACAO_EXECUTAR,
      PERMISSIONS.IMPORTACAO_REVISAR,
      PERMISSIONS.IMPORTACAO_APROVAR,
      
      // Base Conhecimento
      PERMISSIONS.CONHECIMENTO_VISUALIZAR,
      PERMISSIONS.CONHECIMENTO_CRIAR,
      PERMISSIONS.CONHECIMENTO_EDITAR,
      PERMISSIONS.CONHECIMENTO_DELETAR,
      PERMISSIONS.CONHECIMENTO_APROVAR,
      
      // Auditoria
      PERMISSIONS.AUDITORIA_VISUALIZAR,
      PERMISSIONS.AUDITORIA_EXPORTAR
    ]
  },
  
  GERENTE_VENDAS: {
    id: 'gerente_vendas',
    nome: 'Gerente de Vendas',
    descricao: 'Gerencia equipe de vendas e relatórios',
    permissions: [
      // Clientes
      PERMISSIONS.CLIENTES_VISUALIZAR,
      PERMISSIONS.CLIENTES_CRIAR,
      PERMISSIONS.CLIENTES_EDITAR,
      PERMISSIONS.CLIENTES_VER_TODOS,
      
      // Vendas
      PERMISSIONS.VENDAS_VISUALIZAR,
      PERMISSIONS.VENDAS_CRIAR,
      PERMISSIONS.VENDAS_EDITAR,
      PERMISSIONS.VENDAS_VER_TODAS,
      PERMISSIONS.VENDAS_EXPORTAR,
      
      // Orçamentos
      PERMISSIONS.ORCAMENTOS_VISUALIZAR,
      PERMISSIONS.ORCAMENTOS_CRIAR,
      PERMISSIONS.ORCAMENTOS_EDITAR,
      PERMISSIONS.ORCAMENTOS_APROVAR,
      PERMISSIONS.ORCAMENTOS_VER_TODOS,
      
      // Produtos
      PERMISSIONS.PRODUTOS_VISUALIZAR,
      
      // Vendedores
      PERMISSIONS.VENDEDORES_VISUALIZAR,
      PERMISSIONS.VENDEDORES_VER_PERFORMANCE,
      
      // Relatórios
      PERMISSIONS.RELATORIOS_VISUALIZAR,
      PERMISSIONS.RELATORIOS_EXPORTAR,
      PERMISSIONS.RELATORIOS_GERENCIAIS,
      
      // Analytics
      PERMISSIONS.ANALYTICS_BASICO,
      PERMISSIONS.ANALYTICS_AVANCADO,
      
      // Automação
      PERMISSIONS.AUTOMACAO_VISUALIZAR,
      PERMISSIONS.AUTOMACAO_CRIAR,
      PERMISSIONS.AUTOMACAO_EDITAR,
      
      // Comunicação
      PERMISSIONS.WHATSAPP_ENVIAR,
      PERMISSIONS.WHATSAPP_VER_CONVERSAS,
      PERMISSIONS.EMAIL_ENVIAR,
      
      // Base Conhecimento
      PERMISSIONS.CONHECIMENTO_VISUALIZAR,
      PERMISSIONS.CONHECIMENTO_CRIAR,
      PERMISSIONS.CONHECIMENTO_EDITAR
    ]
  },
  
  VENDEDOR: {
    id: 'vendedor',
    nome: 'Vendedor',
    descricao: 'Vendedor com acesso aos seus clientes',
    permissions: [
      // Clientes (apenas os seus)
      PERMISSIONS.CLIENTES_VISUALIZAR,
      PERMISSIONS.CLIENTES_CRIAR,
      PERMISSIONS.CLIENTES_EDITAR,
      
      // Vendas (apenas as suas)
      PERMISSIONS.VENDAS_VISUALIZAR,
      PERMISSIONS.VENDAS_CRIAR,
      PERMISSIONS.VENDAS_EDITAR,
      
      // Orçamentos (apenas os seus)
      PERMISSIONS.ORCAMENTOS_VISUALIZAR,
      PERMISSIONS.ORCAMENTOS_CRIAR,
      PERMISSIONS.ORCAMENTOS_EDITAR,
      
      // Produtos
      PERMISSIONS.PRODUTOS_VISUALIZAR,
      
      // Relatórios básicos
      PERMISSIONS.RELATORIOS_VISUALIZAR,
      
      // Analytics básico
      PERMISSIONS.ANALYTICS_BASICO,
      
      // Comunicação
      PERMISSIONS.WHATSAPP_ENVIAR,
      PERMISSIONS.WHATSAPP_VER_CONVERSAS,
      PERMISSIONS.EMAIL_ENVIAR,
      
      // Base Conhecimento
      PERMISSIONS.CONHECIMENTO_VISUALIZAR
    ]
  },
  
  SUPORTE: {
    id: 'suporte',
    nome: 'Suporte',
    descricao: 'Acesso a comunicação e atendimento',
    permissions: [
      // Clientes (visualizar todos)
      PERMISSIONS.CLIENTES_VISUALIZAR,
      PERMISSIONS.CLIENTES_VER_TODOS,
      
      // Produtos
      PERMISSIONS.PRODUTOS_VISUALIZAR,
      
      // Comunicação
      PERMISSIONS.WHATSAPP_ENVIAR,
      PERMISSIONS.WHATSAPP_VER_CONVERSAS,
      PERMISSIONS.EMAIL_ENVIAR,
      
      // Base Conhecimento
      PERMISSIONS.CONHECIMENTO_VISUALIZAR,
      PERMISSIONS.CONHECIMENTO_CRIAR
    ]
  },
  
  FINANCEIRO: {
    id: 'financeiro',
    nome: 'Financeiro',
    descricao: 'Acesso a dados financeiros',
    permissions: [
      // Clientes
      PERMISSIONS.CLIENTES_VISUALIZAR,
      PERMISSIONS.CLIENTES_VER_TODOS,
      
      // Vendas
      PERMISSIONS.VENDAS_VISUALIZAR,
      PERMISSIONS.VENDAS_VER_TODAS,
      PERMISSIONS.VENDAS_EXPORTAR,
      
      // Orçamentos
      PERMISSIONS.ORCAMENTOS_VISUALIZAR,
      PERMISSIONS.ORCAMENTOS_VER_TODOS,
      PERMISSIONS.ORCAMENTOS_APROVAR,
      
      // Produtos
      PERMISSIONS.PRODUTOS_VISUALIZAR,
      
      // Relatórios
      PERMISSIONS.RELATORIOS_VISUALIZAR,
      PERMISSIONS.RELATORIOS_EXPORTAR,
      PERMISSIONS.RELATORIOS_FINANCEIROS,
      
      // Analytics
      PERMISSIONS.ANALYTICS_BASICO,
      PERMISSIONS.ANALYTICS_AVANCADO
    ]
  },
  
  VIEWER: {
    id: 'viewer',
    nome: 'Visualizador',
    descricao: 'Acesso somente leitura',
    permissions: [
      PERMISSIONS.CLIENTES_VISUALIZAR,
      PERMISSIONS.VENDAS_VISUALIZAR,
      PERMISSIONS.ORCAMENTOS_VISUALIZAR,
      PERMISSIONS.PRODUTOS_VISUALIZAR,
      PERMISSIONS.RELATORIOS_VISUALIZAR,
      PERMISSIONS.ANALYTICS_BASICO,
      PERMISSIONS.CONHECIMENTO_VISUALIZAR
    ]
  }
};

/**
 * Classe para gerenciar permissões
 */
export class PermissionManager {
  
  /**
   * Verifica se o usuário tem uma permissão específica
   */
  static hasPermission(user, permission) {
    if (!user) return false;
    
    // Super admin tem tudo
    if (user.role === 'super_admin') return true;
    
    // Buscar role do usuário
    const userRole = this.getRoleByKey(user.role);
    if (!userRole) return false;
    
    // Admin full access
    if (userRole.permissions.includes(PERMISSIONS.ADMIN_FULL_ACCESS)) {
      return true;
    }
    
    // Verificar permissão específica
    return userRole.permissions.includes(permission);
  }
  
  /**
   * Verifica múltiplas permissões (AND)
   */
  static hasAllPermissions(user, permissions) {
    return permissions.every(p => this.hasPermission(user, p));
  }
  
  /**
   * Verifica se tem pelo menos uma das permissões (OR)
   */
  static hasAnyPermission(user, permissions) {
    return permissions.some(p => this.hasPermission(user, p));
  }
  
  /**
   * Busca role por chave
   */
  static getRoleByKey(roleKey) {
    return Object.values(ROLES).find(r => r.id === roleKey);
  }
  
  /**
   * Lista todas as permissões do usuário
   */
  static getUserPermissions(user) {
    if (!user) return [];
    
    if (user.role === 'super_admin') {
      return Object.values(PERMISSIONS);
    }
    
    const userRole = this.getRoleByKey(user.role);
    return userRole ? userRole.permissions : [];
  }
  
  /**
   * Verifica se usuário pode acessar recurso específico
   */
  static canAccessResource(user, resource, action = 'read') {
    const permission = `${resource}:${action}`;
    return this.hasPermission(user, permission);
  }
  
  /**
   * Verifica se pode ver todos os recursos ou apenas os seus
   */
  static canSeeAll(user, resource) {
    const permission = `${resource}:read:all`;
    return this.hasPermission(user, permission);
  }
}

export default PermissionManager;