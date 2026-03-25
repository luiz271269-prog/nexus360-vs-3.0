/**
 * ═══════════════════════════════════════════════════════════════
 * NEXUS360 PERMISSIONS SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * ÚNICA FONTE DE LÓGICA para permissões e visibilidade.
 * Princípio: "Tudo visível por padrão, bloqueado apenas por regra explícita"
 * 
 * IMPORTANTE: Este arquivo NÃO substitui o código atual ainda.
 * Ele é a infraestrutura NOVA que será migrada gradualmente.
 */

// ═══════════════════════════════════════════════════════════════
// PRESETS DE BLOQUEIOS POR PERFIL
// ═══════════════════════════════════════════════════════════════

export const BLOQUEIOS_PRESETS = {
  admin: {
    // Admin: Acesso total - sem bloqueios padrão
    setoresBloqueados: [],
    integracoesBloqueadas: [],
    canaisBloqueados: []
  },
  gerente: {
    // Gerente: Visão ampla + gestão - sem bloqueios
    setoresBloqueados: [],
    integracoesBloqueadas: [],
    canaisBloqueados: []
  },
  coordenador: {
    // Coordenador: Supervisão setorial - vê apenas seu setor
    setoresBloqueados: [], // Será preenchido dinamicamente
    integracoesBloqueadas: [],
    canaisBloqueados: []
  },
  senior: {
    // Senior: Supervisor operacional - vê apenas seu setor
    setoresBloqueados: [], // Será preenchido dinamicamente
    integracoesBloqueadas: [],
    canaisBloqueados: []
  },
  pleno: {
    // Pleno: Atendente completo - vê apenas seu setor
    setoresBloqueados: [], // Será preenchido dinamicamente
    integracoesBloqueadas: [],
    canaisBloqueados: []
  },
  junior: {
    // Junior: Atendente básico - vê apenas seu setor
    setoresBloqueados: [], // Será preenchido dinamicamente
    integracoesBloqueadas: [],
    canaisBloqueados: []
  }
};

// ═══════════════════════════════════════════════════════════════
// PRESETS DE PERMISSÕES (Perfis Rápidos)
// ═══════════════════════════════════════════════════════════════

export const PERMISSIONS_PRESETS = {
  admin: {
    // Admin: TODAS as permissões liberadas
    podeVerTodasConversas: true,
    podeEnviarMensagens: true,
    podeEnviarMidias: true,
    podeEnviarAudios: true,
    podeTransferirConversa: true,
    podeApagarMensagens: true,
    podeGerenciarFilas: true,
    podeAtribuirConversas: true,
    podeVerDetalhesContato: true,
    podeEditarContato: true,
    podeBloquearContato: true,
    podeDeletarContato: true,
    podeCriarPlaybooks: true,
    podeEditarPlaybooks: true,
    podeGerenciarConexoes: true,
    podeVerRelatorios: true,
    podeExportarDados: true,
    podeGerenciarPermissoes: true,
    podeVerDiagnosticos: true,
    // ✅ NOVAS - Sprint 1 e 2
    podeAssumirDaFila: true,
    podeCriarNotasInternas: true,
    podeVerHistoricoChamadas: true,
    podeResponderMensagens: true,
    podeEncaminharMensagens: true,
    podeCategorizarMensagensIndividuais: true,
    podeAlterarStatusContato: true,
    podeCriarRespostasRapidas: true,
    podeDeletarRespostasRapidas: true,
    podeDeletarPlaybooks: true,
    podeDuplicarPlaybooks: true,
    podeRealizarChamadas: true,
    podeVerMetricasIndividuais: true,
    podeVerMetricasEquipe: true,
    podeConfigurarURA: true
  },
  
  gerente: {
    // Gerente: Visão ampla mas com algumas restrições
    podeVerTodasConversas: true,
    podeEnviarMensagens: true,
    podeEnviarMidias: true,
    podeEnviarAudios: true,
    podeTransferirConversa: true,
    podeApagarMensagens: false,
    podeGerenciarFilas: true,
    podeAtribuirConversas: true,
    podeVerDetalhesContato: true,
    podeEditarContato: true,
    podeBloquearContato: true,
    podeDeletarContato: false,
    podeCriarPlaybooks: true,
    podeEditarPlaybooks: true,
    podeGerenciarConexoes: false,
    podeVerRelatorios: true,
    podeExportarDados: true,
    podeGerenciarPermissoes: false,
    podeVerDiagnosticos: true,
    // ✅ NOVAS - Sprint 1 e 2
    podeAssumirDaFila: true,
    podeCriarNotasInternas: true,
    podeVerHistoricoChamadas: true,
    podeResponderMensagens: true,
    podeEncaminharMensagens: true,
    podeCategorizarMensagensIndividuais: true,
    podeAlterarStatusContato: true,
    podeCriarRespostasRapidas: true,
    podeDeletarRespostasRapidas: false,
    podeDeletarPlaybooks: false,
    podeDuplicarPlaybooks: true,
    podeRealizarChamadas: true,
    podeVerMetricasIndividuais: true,
    podeVerMetricasEquipe: true,
    podeConfigurarURA: true
  },
  
  coordenador: {
    // Coordenador: Similar a gerente com menos poder
    podeVerTodasConversas: true,
    podeEnviarMensagens: true,
    podeEnviarMidias: true,
    podeEnviarAudios: true,
    podeTransferirConversa: true,
    podeApagarMensagens: false,
    podeGerenciarFilas: true,
    podeAtribuirConversas: true,
    podeVerDetalhesContato: true,
    podeEditarContato: true,
    podeBloquearContato: false,
    podeDeletarContato: false,
    podeCriarPlaybooks: true,
    podeEditarPlaybooks: false,
    podeGerenciarConexoes: false,
    podeVerRelatorios: true,
    podeExportarDados: false,
    podeGerenciarPermissoes: false,
    podeVerDiagnosticos: false,
    // ✅ NOVAS - Sprint 1 e 2
    podeAssumirDaFila: true,
    podeCriarNotasInternas: true,
    podeVerHistoricoChamadas: true,
    podeResponderMensagens: true,
    podeEncaminharMensagens: true,
    podeCategorizarMensagensIndividuais: true,
    podeAlterarStatusContato: true,
    podeCriarRespostasRapidas: true,
    podeDeletarRespostasRapidas: false,
    podeDeletarPlaybooks: false,
    podeDuplicarPlaybooks: false,
    podeRealizarChamadas: true,
    podeVerMetricasIndividuais: true,
    podeVerMetricasEquipe: true,
    podeConfigurarURA: false
  },
  
  senior: {
    // Sênior: Supervisor com permissões operacionais
    podeVerTodasConversas: false,
    podeEnviarMensagens: true,
    podeEnviarMidias: true,
    podeEnviarAudios: true,
    podeTransferirConversa: true,
    podeApagarMensagens: false,
    podeGerenciarFilas: false,
    podeAtribuirConversas: true,
    podeVerDetalhesContato: true,
    podeEditarContato: true,
    podeBloquearContato: false,
    podeDeletarContato: false,
    podeCriarPlaybooks: false,
    podeEditarPlaybooks: false,
    podeGerenciarConexoes: false,
    podeVerRelatorios: false,
    podeExportarDados: false,
    podeGerenciarPermissoes: false,
    podeVerDiagnosticos: false,
    // ✅ NOVAS - Sprint 1 e 2
    podeAssumirDaFila: true,
    podeCriarNotasInternas: true,
    podeVerHistoricoChamadas: false,
    podeResponderMensagens: true,
    podeEncaminharMensagens: false,
    podeCategorizarMensagensIndividuais: true,
    podeAlterarStatusContato: false,
    podeCriarRespostasRapidas: false,
    podeDeletarRespostasRapidas: false,
    podeDeletarPlaybooks: false,
    podeDuplicarPlaybooks: false,
    podeRealizarChamadas: true,
    podeVerMetricasIndividuais: true,
    podeVerMetricasEquipe: false,
    podeConfigurarURA: false
  },
  
  pleno: {
    // Pleno: Atendente completo
    podeVerTodasConversas: false,
    podeEnviarMensagens: true,
    podeEnviarMidias: true,
    podeEnviarAudios: true,
    podeTransferirConversa: true,
    podeApagarMensagens: false,
    podeGerenciarFilas: false,
    podeAtribuirConversas: false,
    podeVerDetalhesContato: true,
    podeEditarContato: true,
    podeBloquearContato: false,
    podeDeletarContato: false,
    podeCriarPlaybooks: false,
    podeEditarPlaybooks: false,
    podeGerenciarConexoes: false,
    podeVerRelatorios: false,
    podeExportarDados: false,
    podeGerenciarPermissoes: false,
    podeVerDiagnosticos: false,
    // ✅ NOVAS - Sprint 1 e 2
    podeAssumirDaFila: true,
    podeCriarNotasInternas: true,
    podeVerHistoricoChamadas: false,
    podeResponderMensagens: true,
    podeEncaminharMensagens: false,
    podeCategorizarMensagensIndividuais: false,
    podeAlterarStatusContato: false,
    podeCriarRespostasRapidas: false,
    podeDeletarRespostasRapidas: false,
    podeDeletarPlaybooks: false,
    podeDuplicarPlaybooks: false,
    podeRealizarChamadas: true,
    podeVerMetricasIndividuais: true,
    podeVerMetricasEquipe: false,
    podeConfigurarURA: false
  },
  
  junior: {
    // Júnior: Atendente básico
    podeVerTodasConversas: false,
    podeEnviarMensagens: true,
    podeEnviarMidias: true,
    podeEnviarAudios: false,
    podeTransferirConversa: false,
    podeApagarMensagens: false,
    podeGerenciarFilas: false,
    podeAtribuirConversas: false,
    podeVerDetalhesContato: true,
    podeEditarContato: false,
    podeBloquearContato: false,
    podeDeletarContato: false,
    podeCriarPlaybooks: false,
    podeEditarPlaybooks: false,
    podeGerenciarConexoes: false,
    podeVerRelatorios: false,
    podeExportarDados: false,
    podeGerenciarPermissoes: false,
    podeVerDiagnosticos: false,
    // ✅ NOVAS - Sprint 1 e 2 (BLOQUEADO para júnior na maioria)
    podeAssumirDaFila: false,
    podeCriarNotasInternas: true, // Liberado - baixo risco
    podeVerHistoricoChamadas: false,
    podeResponderMensagens: true,
    podeEncaminharMensagens: false,
    podeCategorizarMensagensIndividuais: false,
    podeAlterarStatusContato: false,
    podeCriarRespostasRapidas: false,
    podeDeletarRespostasRapidas: false,
    podeDeletarPlaybooks: false,
    podeDuplicarPlaybooks: false,
    podeRealizarChamadas: false,
    podeVerMetricasIndividuais: true,
    podeVerMetricasEquipe: false,
    podeConfigurarURA: false
  }
};

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════

function extrairValores(regras, tipo) {
  return regras
    .filter(r => r.tipo === tipo && r.ativa)
    .flatMap(r => r.valores_bloqueados || []);
}

function regraAtiva(regras, tipo) {
  return regras.some(r => r.tipo === tipo && r.ativa);
}

function extrairConfig(regras, tipo, campoConfig) {
  const regra = regras.find(r => r.tipo === tipo && r.ativa);
  return regra?.configuracao?.[campoConfig];
}

function construirMapaIntegracoes(usuario, allIntegracoes) {
  const whatsappPerms = usuario.whatsapp_permissions || [];
  const integracoesMap = {};
  
  // ✅ CIRÚRGICA: Se whatsapp_permissions[] está vazio = LIBERA TUDO (compatibilidade)
  const temPermissoesConfiguradas = whatsappPerms.length > 0;
  
  allIntegracoes.forEach(integracao => {
    const perm = whatsappPerms.find(p => p.integration_id === integracao.id);
    
    // ✅ LÓGICA CORRIGIDA:
    // - Sem permissões configuradas = libera tudo (default true)
    // - Com permissões configuradas = respeita valores EXATOS (false = bloqueado)
    if (temPermissoesConfiguradas && !perm) {
      // Integração não está na lista de permissões = BLOQUEADO
      integracoesMap[integracao.id] = {
        can_view: false,
        can_send: false,
        can_receive: false,
        integration_name: integracao.nome_instancia || 'Sem nome'
      };
    } else if (perm) {
      // Integração tem permissão configurada = usa valores EXATOS
      integracoesMap[integracao.id] = {
        can_view: perm.can_view === true, // ✅ Explícito: deve ser true
        can_send: perm.can_send === true,
        can_receive: perm.can_receive === true,
        integration_name: perm.integration_name || integracao.nome_instancia || 'Sem nome'
      };
    } else {
      // Sem permissões configuradas = LIBERA (compatibilidade)
      integracoesMap[integracao.id] = {
        can_view: true,
        can_send: true,
        can_receive: true,
        integration_name: integracao.nome_instancia || 'Sem nome'
      };
    }
  });
  
  // Aplicar bloqueios explícitos de regras_bloqueio
  const regrasBloqueio = usuario.configuracao_visibilidade_nexus?.regras_bloqueio || [];
  regrasBloqueio.forEach(regra => {
    if (regra.tipo === 'integracao' && regra.ativa) {
      regra.valores_bloqueados?.forEach(integId => {
        if (integracoesMap[integId]) {
          integracoesMap[integId].can_view = false;
        }
      });
    }
  });
  
  return integracoesMap;
}

// ═══════════════════════════════════════════════════════════════
// CONSTRUÇÃO DO OBJETO DE PERMISSÕES
// ═══════════════════════════════════════════════════════════════

/**
 * Constrói objeto unificado de permissões processadas.
 * Entrada: registro do entities/User
 * Saída: objeto otimizado para decisões rápidas
 */
export function buildUserPermissions(usuario, allIntegracoes = []) {
  if (!usuario) return null;
  
  // Extrair configurações (novo formato Nexus360)
  const configNexus = usuario.configuracao_visibilidade_nexus || {};
  const acoes = usuario.permissoes_acoes_nexus || {};
  
  // ETAPA 1: Começar com preset baseado em role/attendant_role
  const nivelAtendente = usuario.role === 'admin' ? 'admin' : (usuario.attendant_role || 'pleno');
  const basePermissions = { ...PERMISSIONS_PRESETS[nivelAtendente] } || { ...PERMISSIONS_PRESETS.pleno };
  const bloqueiosPreset = BLOQUEIOS_PRESETS[nivelAtendente] || BLOQUEIOS_PRESETS.pleno;
  
  // ETAPA 2: Processar regras de bloqueio/liberação
  const regrasBloqueio = (configNexus.regras_bloqueio || [])
    .filter(r => r.ativa)
    .sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0));
  
  const regrasLiberacao = (configNexus.regras_liberacao || [])
    .filter(r => r.ativa)
    .sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0));
  
  // ETAPA 3: Aplicar bloqueios padrão do perfil
  const setorUsuario = usuario.attendant_sector || 'geral';
  let setoresBloqueadosBase = [...(bloqueiosPreset.setoresBloqueados || [])];
  
  // Para coordenador/senior/pleno/junior: bloquear setores fora do seu
  if (['coordenador', 'senior', 'pleno', 'junior'].includes(nivelAtendente)) {
    const todosSetores = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
    setoresBloqueadosBase = todosSetores.filter(s => s !== setorUsuario);
  }
  
  // ETAPA 4: Construir objeto final
  const userPermissions = {
    // Identificação
    id: usuario.id,
    email: usuario.email,
    full_name: usuario.display_name || usuario.full_name, // ✅ Prioriza nome editável
    role: usuario.role,
    attendant_role: nivelAtendente,
    attendant_sector: setorUsuario,
    
    // Regras de bloqueio (preset + exceções individuais)
    setoresBloqueados: [
      ...setoresBloqueadosBase,
      ...extrairValores(regrasBloqueio, 'setor')
    ],
    integracoesBloqueadas: [
      ...(bloqueiosPreset.integracoesBloqueadas || []),
      ...extrairValores(regrasBloqueio, 'integracao')
    ],
    canaisBloqueados: [
      ...(bloqueiosPreset.canaisBloqueados || []),
      ...extrairValores(regrasBloqueio, 'canal')
    ],
    provedoresBloqueados: extrairValores(regrasBloqueio, 'provedor'),
    
    // Regras de liberação (flags + configs)
    janela24hAtiva: regraAtiva(regrasLiberacao, 'janela_24h'),
    janela24hHoras: extrairConfig(regrasLiberacao, 'janela_24h', 'horas') || 24,
    gerenteSupervisaoAtiva: regraAtiva(regrasLiberacao, 'gerente_supervisao'),
    gerenteSupervisaoMinutos: extrairConfig(regrasLiberacao, 'gerente_supervisao', 'minutos_sem_resposta') || 30,
    
    // Deduplicação
    deduplicacaoAtiva: configNexus.deduplicacao?.ativa ?? true,
    deduplicacaoCriterio: configNexus.deduplicacao?.criterio || 'contact_id',
    deduplicacaoExcecoes: configNexus.deduplicacao?.excecoes || [],
    
    // Permissões de ações (93 flags)
    ...basePermissions,
    ...acoes, // Customizações sobrescrevem preset
    
    // Mapa de integrações
    integracoes: construirMapaIntegracoes(usuario, allIntegracoes),
    
    // Diagnóstico
    diagnostico: {
      ativo: usuario.diagnostico_nexus?.ativo ?? false,
      decision_path: [],
      reason_code: null
    },
    
    // Configuração de interface
    escoposDisponiveis: usuario.configuracao_interface_nexus?.escopos_disponiveis || [
      { id: 'all', nome: 'Todas', regra: 'mostrar_tudo' },
      { id: 'my', nome: 'Minhas Conversas', regra: 'atribuido_ou_fidelizado' },
      { id: 'unassigned', nome: 'Não Atribuídas', regra: 'sem_assigned_user_id' }
    ]
  };
  
  return userPermissions;
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES DE VERIFICAÇÃO (Auxiliares)
// ═══════════════════════════════════════════════════════════════

export function isAtribuidoAoUsuario(userPermissions, thread) {
  if (!userPermissions || !thread) return false;
  return thread.assigned_user_id === userPermissions.id;
}

export function isFidelizadoAoUsuario(userPermissions, contact) {
  if (!userPermissions || !contact) return false;
  if (!contact.is_cliente_fidelizado) return false;
  
  const setorUser = userPermissions.attendant_sector;
  
  // Verificar campos de fidelização por setor
  const camposFidelizacao = {
    vendas: 'atendente_fidelizado_vendas',
    assistencia: 'atendente_fidelizado_assistencia',
    financeiro: 'atendente_fidelizado_financeiro',
    fornecedor: 'atendente_fidelizado_fornecedor'
  };
  
  const campoFidelizacao = camposFidelizacao[setorUser];
  if (!campoFidelizacao) return false;
  
  return contact[campoFidelizacao] === userPermissions.email;
}

export function isNaoAtribuida(thread) {
  return !thread?.assigned_user_id;
}

export function getSectorFromThreadOrTags(thread) {
  if (thread.sector_id) return thread.sector_id;
  
  // Tentar extrair de categorias/tags
  const categorias = thread.categorias || [];
  const setoresValidos = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
  
  for (const cat of categorias) {
    if (setoresValidos.includes(cat)) return cat;
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════
// VISIBILITY MATRIX (Matriz de Decisão Centralizada)
// ═══════════════════════════════════════════════════════════════

export const VISIBILITY_MATRIX = [
  {
    priority: 1,
    name: 'thread_interna',
    check: (userPerms, thread, contact) => {
      // Threads internas (team/sector) - sempre por participação
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        const isParticipant = thread.participants?.includes(userPerms.id);
        const isAdmin = userPerms.role === 'admin';
        
        if (isParticipant || isAdmin) {
          return { 
            visible: true, 
            motivo: isAdmin ? 'Admin - acesso total threads internas' : 'Participante da thread interna',
            decision_path: ['ALLOW:thread_interna'],
            reason_code: isAdmin ? 'ADMIN_INTERNAL_THREAD' : 'PARTICIPANT_INTERNAL_THREAD'
          };
        } else {
          return { 
            visible: false, 
            motivo: 'Não é participante da thread interna',
            decision_path: ['DENY:thread_interna'],
            reason_code: 'NOT_PARTICIPANT',
            bloqueio: true
          };
        }
      }
      return null;
    }
  },
  
  {
    priority: 2,
    name: 'thread_atribuida',
    check: (userPerms, thread, contact) => {
      if (isAtribuidoAoUsuario(userPerms, thread)) {
        // ✅ CIRÚRGICO: Thread atribuída mas usuário sem permissão para integração = ainda bloqueia
        const integracaoId = thread.whatsapp_integration_id;
        if (integracaoId) {
          const permIntegracao = userPerms.integracoes?.[integracaoId];
          if (permIntegracao && permIntegracao.can_view === false) {
            return { 
              visible: false, 
              motivo: `Thread atribuída mas integração ${permIntegracao.integration_name} bloqueada`,
              decision_path: ['DENY:thread_atribuida_sem_permissao_integracao'],
              reason_code: 'ASSIGNED_BUT_INTEGRATION_BLOCKED',
              bloqueio: true
            };
          }
        }

        return { 
          visible: true, 
          motivo: 'Thread atribuída ao usuário (sobrepõe bloqueios)',
          decision_path: ['ALLOW:thread_atribuida'],
          reason_code: 'ASSIGNED_TO_USER'
        };
      }
      return null;
    }
  },

  {
    priority: 2.5,
    name: 'historico_atendimento',
    check: (userPerms, thread, contact) => {
      // ✅ Cobre todos os campos de histórico (shared_with_users, atendentes_historico, metadata.atendentes_anteriores, ultimo_atendente_id)
      const uid = userPerms.id;
      const jaParticipou =
        thread.shared_with_users?.includes(uid) ||
        thread.atendentes_historico?.includes(uid) ||
        thread.metadata?.atendentes_anteriores?.includes(uid);

      if (jaParticipou) {
        return {
          visible: true,
          motivo: 'Usuário já atendeu esta conversa (histórico)',
          decision_path: ['ALLOW:historico_atendimento'],
          reason_code: 'HISTORY_ACCESS'
        };
      }
      return null;
    }
  },
  
  {
    priority: 3,
    name: 'contato_fidelizado',
    check: (userPerms, thread, contact) => {
      if (contact && isFidelizadoAoUsuario(userPerms, contact)) {
        return { 
          visible: true, 
          motivo: 'Contato fidelizado ao usuário (sobrepõe bloqueios)',
          decision_path: ['ALLOW:contato_fidelizado'],
          reason_code: 'LOYAL_CONTACT'
        };
      }
      return null;
    }
  },
  
  {
    priority: 4,
    name: 'bloqueio_integracao',
    check: (userPerms, thread, contact) => {
      const integracaoId = thread.whatsapp_integration_id;
      if (!integracaoId) return null;

      const permIntegracao = userPerms.integracoes?.[integracaoId];

      // ✅ REGRA PRIMÁRIA: Se integração está explicitamente bloqueada (can_view === false)
      // PREVALECE SOBRE TUDO, inclusive admin
      if (permIntegracao && permIntegracao.can_view === false) {
        return { 
          visible: false, 
          motivo: `Integração ${permIntegracao.integration_name} bloqueada para visualização`,
          decision_path: ['DENY:bloqueio_integracao'],
          reason_code: 'INTEGRATION_BLOCKED',
          metadata: { integracaoId, nome: permIntegracao.integration_name },
          bloqueio: true
        };
      }

      // ✅ BYPASS ADMIN: Só se não houver bloqueio explícito definido
      // Admin sem regras definidas = libera tudo
      if (userPerms.role === 'admin' && !permIntegracao) {
        return null; // Libera (bypass admin)
      }

      // Integração não mapeada ou sem permissão definida = libera (fail-safe)
      if (!permIntegracao) {
        return null;
      }

      return null;
    }
  },
  
  {
    priority: 5,
    name: 'bloqueio_setor',
    check: (userPerms, thread, contact) => {
      const setorThread = getSectorFromThreadOrTags(thread);
      if (!setorThread) return null;
      
      // ✅ REGRA PRIMÁRIA: Bloqueio explícito prevalece sobre tudo (até admin)
      if (userPerms.setoresBloqueados?.includes(setorThread)) {
        return { 
          visible: false, 
          motivo: `Setor ${setorThread} bloqueado explicitamente`,
          decision_path: ['DENY:bloqueio_setor'],
          reason_code: 'SECTOR_BLOCKED',
          metadata: { setor: setorThread },
          bloqueio: true
        };
      }
      
      // ✅ Admin sem bloqueios explícitos = libera automaticamente
      return null;
    }
  },
  
  {
    priority: 6,
    name: 'bloqueio_canal',
    check: (userPerms, thread, contact) => {
      const canal = thread.channel;
      if (!canal) return null;
      
      // ✅ REGRA PRIMÁRIA: Bloqueio explícito prevalece sobre tudo (até admin)
      if (userPerms.canaisBloqueados?.includes(canal)) {
        return { 
          visible: false, 
          motivo: `Canal ${canal} bloqueado explicitamente`,
          decision_path: ['DENY:bloqueio_canal'],
          reason_code: 'CHANNEL_BLOCKED',
          metadata: { canal },
          bloqueio: true
        };
      }
      
      // ✅ Admin sem bloqueios explícitos = libera automaticamente
      return null;
    }
  },
  
  {
    priority: 7,
    name: 'janela_24h',
    check: (userPerms, thread, contact) => {
      if (!userPerms.janela24hAtiva) return null;
      
      if (thread.last_inbound_at && thread.last_message_sender === 'contact') {
        const horas = (Date.now() - new Date(thread.last_inbound_at)) / (1000 * 60 * 60);
        const limite = userPerms.janela24hHoras || 24;
        
        if (horas < limite) {
          // Proteção: se fidelizado a outro, não libera
          if (contact?.is_cliente_fidelizado && !isFidelizadoAoUsuario(userPerms, contact)) {
            return null;
          }
          
          return { 
            visible: true, 
            motivo: `Janela ${limite}h ativa (${horas.toFixed(1)}h sem resposta)`,
            decision_path: ['ALLOW:janela_24h'],
            reason_code: 'WINDOW_24H_ACTIVE',
            metadata: { horas: horas.toFixed(1), limite }
          };
        }
      }
      return null;
    }
  },
  
  {
    priority: 8,
    name: 'bloqueio_fidelizado_outro',
    check: (userPerms, thread, contact) => {
      if (contact?.is_cliente_fidelizado && !isFidelizadoAoUsuario(userPerms, contact)) {
        return { 
          visible: false, 
          motivo: 'Contato fidelizado a outro usuário',
          decision_path: ['DENY:fidelizado_outro'],
          reason_code: 'LOYAL_TO_ANOTHER',
          bloqueio: true
        };
      }
      return null;
    }
  },
  
  {
    priority: 9,
    name: 'bloqueio_atribuido_outro',
    check: (userPerms, thread, contact) => {
      // Gerente pode ver threads atribuídas a outros (supervisão)
      if (userPerms.podeVerTodasConversas) return null;
      
      if (thread.assigned_user_id && !isAtribuidoAoUsuario(userPerms, thread)) {
        return { 
          visible: false, 
          motivo: 'Thread atribuída a outro usuário',
          decision_path: ['DENY:atribuido_outro'],
          reason_code: 'ASSIGNED_TO_ANOTHER',
          bloqueio: true
        };
      }
      return null;
    }
  },
  
  {
    priority: 10,
    name: 'gerente_supervisao',
    check: (userPerms, thread, contact) => {
      if (!userPerms.gerenteSupervisaoAtiva) return null;
      if (!userPerms.podeVerTodasConversas) return null;
      
      // Gerente vê threads sem resposta há X minutos
      if (thread.last_inbound_at && thread.last_message_sender === 'contact') {
        const minutos = (Date.now() - new Date(thread.last_inbound_at)) / (1000 * 60);
        const limiteMinutos = userPerms.gerenteSupervisaoMinutos || 30;
        
        if (minutos > limiteMinutos) {
          return { 
            visible: true, 
            motivo: `Gerente - supervisão threads sem resposta (${minutos.toFixed(0)}min)`,
            decision_path: ['ALLOW:gerente_supervisao'],
            reason_code: 'MANAGER_SUPERVISION',
            metadata: { minutos: minutos.toFixed(0), limite: limiteMinutos }
          };
        }
      }
      
      return null;
    }
  },
  
  {
    priority: 12,
    name: 'nexus360_default',
    check: (userPerms, thread, contact) => {
      // FAIL-SAFE: Default liberado (Nexus360)
      return { 
        visible: true, 
        motivo: 'Nenhuma regra explícita de bloqueio (padrão Nexus360 liberado)',
        decision_path: ['ALLOW:nexus360_default'],
        reason_code: 'DEFAULT_ALLOW'
      };
    }
  }
];

// ═══════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL: Decisão de Visibilidade
// ═══════════════════════════════════════════════════════════════

/**
 * Determina se o usuário pode ver a thread (base de segurança).
 * NÃO considera filtros de UI (scope, busca, etc.).
 * 
 * @param {Object} userPermissions - Objeto retornado por buildUserPermissions
 * @param {Object} thread - Thread a verificar
 * @param {Object} contact - Contato associado (opcional)
 * @returns {boolean} - true se visível, false se bloqueado
 */
export function canUserSeeThreadBase(userPermissions, thread, contact = null) {
  if (!userPermissions || !thread) return false;
  
  const decisionPath = [];
  let finalReasonCode = null;
  let finalMotivo = null;
  
  // ✅ CRÍTICO: Ordenar regras por priority numérica (previne bugs de ordem)
  const regrasOrdenadas = [...VISIBILITY_MATRIX].sort((a, b) => a.priority - b.priority);
  
  // Iterar matriz em ordem de prioridade
  for (const rule of regrasOrdenadas) {
    const resultado = rule.check(userPermissions, thread, contact);
    
    if (resultado !== null) {
      // Acumular decision_path
      if (resultado.decision_path) {
        decisionPath.push(...resultado.decision_path);
      }
      
      finalReasonCode = resultado.reason_code;
      finalMotivo = resultado.motivo;
      
      // Log diagnóstico (se ativo)
      if (userPermissions.diagnostico?.ativo) {
        const threadId = thread.id?.substring(0, 8) || 'unknown';
        const emoji = resultado.visible ? '✅' : '🔒';
        console.log(`[NEXUS360] ${emoji} Thread ${threadId} - Regra: ${rule.name} - ${resultado.motivo}`);
        
        // Armazenar no objeto (para debugging)
        userPermissions.diagnostico.decision_path = decisionPath;
        userPermissions.diagnostico.reason_code = finalReasonCode;
        userPermissions.diagnostico.motivo = finalMotivo;
      }
      
      return resultado.visible;
    }
  }
  
  // Fallback: liberar (nunca deveria chegar aqui - regra 12 sempre retorna)
  console.warn('[NEXUS360] ⚠️ Thread alcançou fallback (bug na VISIBILITY_MATRIX)');
  return true;
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÃO: Verificar Permissão de Ação
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica se o usuário pode realizar uma ação específica.
 * 
 * @param {Object} userPermissions - Objeto de permissões
 * @param {string} actionKey - Chave da ação (ex: 'podeEnviarMensagens')
 * @returns {boolean}
 */
export function canUserPerformAction(userPermissions, actionKey) {
  if (!userPermissions) return false;
  
  // NEXUS360: Default liberado (usa ?? true)
  return userPermissions[actionKey] ?? true;
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÃO: Aplicar Filtro de Escopo (UI)
// ═══════════════════════════════════════════════════════════════

/**
 * Aplica filtro de escopo (my, unassigned, all) sobre threads.
 * Esta função NÃO afeta segurança, apenas reorganiza para UI.
 * 
 * @param {Array} threads - Threads já filtradas por segurança
 * @param {Object} escopo - Configuração do escopo { id, nome, regra }
 * @param {Object} userPermissions - Permissões do usuário
 * @returns {Array} - Threads filtradas
 */
export function aplicarFiltroEscopo(threads, escopo, userPermissions) {
  if (!escopo || escopo.regra === 'mostrar_tudo') {
    return threads; // Sem filtro
  }
  
  switch (escopo.regra) {
    case 'atribuido_ou_fidelizado':
      return threads.filter(t => {
        const isAtribuido = isAtribuidoAoUsuario(userPermissions, t);
        const isFidelizado = t.contato && isFidelizadoAoUsuario(userPermissions, t.contato);
        const uid = userPermissions.id;
        // ✅ Cobrir todos os campos de histórico/participação
        const estaNoHistorico =
          t.shared_with_users?.includes(uid) ||
          t.atendentes_historico?.includes(uid) ||
          t.participants?.includes(uid);
        return isAtribuido || isFidelizado || estaNoHistorico;
      });
    
    case 'sem_assigned_user_id':
      return threads.filter(t => isNaoAtribuida(t));
    
    default:
      return threads;
  }
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÃO: Deduplicação Configurável
// ═══════════════════════════════════════════════════════════════

/**
 * Determina se thread deve ser deduplicada.
 * 
 * @param {Object} userPermissions
 * @param {Object} thread
 * @param {boolean} temBuscaPorTexto
 * @returns {boolean} - true se deve deduplicar
 */
export function deveDeduplicarThread(userPermissions, thread, temBuscaPorTexto) {
  if (!userPermissions.deduplicacaoAtiva) return false;
  
  // Verificar exceções
  const excecoes = userPermissions.deduplicacaoExcecoes || [];
  
  for (const excecao of excecoes) {
    // Exceção: threads internas nunca deduplicam
    if (excecao.condicao === 'thread_interna') {
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        return !excecao.desativar_dedup;
      }
    }
    
    // Exceção: admin com busca não deduplica
    if (excecao.condicao === 'admin_com_busca') {
      if (userPermissions.role === 'admin' && temBuscaPorTexto) {
        return !excecao.desativar_dedup;
      }
    }
  }
  
  return true; // Deduplicar por padrão
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÃO: Diagnóstico Detalhado
// ═══════════════════════════════════════════════════════════════

/**
 * Retorna diagnóstico detalhado de por que thread está visível/bloqueada.
 * Útil para modal de diagnóstico admin.
 */
export function diagnosticarVisibilidadeThread(userPermissions, thread, contact = null) {
  const resultado = {
    threadId: thread.id,
    visible: false,
    motivo: null,
    reason_code: null,
    decision_path: [],
    regra_aplicada: null,
    metadata: {}
  };
  
  for (const rule of VISIBILITY_MATRIX) {
    const check = rule.check(userPermissions, thread, contact);
    
    if (check !== null) {
      resultado.visible = check.visible;
      resultado.motivo = check.motivo;
      resultado.reason_code = check.reason_code;
      resultado.decision_path = check.decision_path || [];
      resultado.regra_aplicada = rule.name;
      resultado.metadata = check.metadata || {};
      resultado.bloqueio = check.bloqueio || false;
      break;
    }
  }
  
  return resultado;
}