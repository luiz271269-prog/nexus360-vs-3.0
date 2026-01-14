/**
 * ═══════════════════════════════════════════════════════════════
 * NEXUS360 LEGACY CONVERTER
 * ═══════════════════════════════════════════════════════════════
 * 
 * Converte configurações LEGADAS para formato Nexus360.
 * Usado para migração automática 1-clique.
 */

/**
 * Converte usuário legado para configuração Nexus360.
 * 
 * @param {Object} user - Registro User completo
 * @returns {Object} Configuração Nexus360 pronta
 */
export function buildPolicyFromLegacyUser(user) {
  if (!user) return null;
  
  const config = {
    configuracao_visibilidade_nexus: {
      modo_visibilidade: 'padrao_liberado', // Nexus360 default
      regras_bloqueio: [],
      regras_liberacao: [],
      deduplicacao: {
        ativa: true,
        criterio: 'contact_id',
        manter: 'mais_recente',
        excecoes: [
          { condicao: 'thread_interna', desativar_dedup: true },
          { condicao: 'admin_com_busca', desativar_dedup: true }
        ]
      }
    },
    permissoes_acoes_nexus: {},
    diagnostico_nexus: {
      ativo: false,
      log_level: 'info'
    }
  };
  
  // ═══════════════════════════════════════════════════════════════
  // MIGRAR BLOQUEIOS
  // ═══════════════════════════════════════════════════════════════
  
  // Setores bloqueados (se existir lógica legada)
  const setoresVisiveis = user.permissoes_visualizacao?.setores_visiveis || [];
  const todosSetores = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
  
  if (setoresVisiveis.length > 0 && setoresVisiveis.length < todosSetores.length) {
    // Se tem setores específicos visíveis, bloquear os outros
    const setoresBloqueados = todosSetores.filter(s => !setoresVisiveis.includes(s));
    
    if (setoresBloqueados.length > 0) {
      config.configuracao_visibilidade_nexus.regras_bloqueio.push({
        tipo: 'setor',
        valores_bloqueados: setoresBloqueados,
        ativa: true,
        prioridade: 10,
        descricao: 'Migrado automaticamente de setores_visiveis'
      });
    }
  }
  
  // Integrações bloqueadas
  const integracoesVisiveis = user.permissoes_visualizacao?.integracoes_visiveis || [];
  const whatsappPerms = user.whatsapp_permissions || [];
  
  // Se tem whatsapp_permissions com can_view=false, bloquear essas
  const integracoesBloqueadas = whatsappPerms
    .filter(p => p.can_view === false)
    .map(p => p.integration_id);
  
  if (integracoesBloqueadas.length > 0) {
    config.configuracao_visibilidade_nexus.regras_bloqueio.push({
      tipo: 'integracao',
      valores_bloqueados: integracoesBloqueadas,
      ativa: true,
      prioridade: 10,
      descricao: 'Migrado de whatsapp_permissions com can_view=false'
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MIGRAR LIBERAÇÕES
  // ═══════════════════════════════════════════════════════════════
  
  // Janela 24h (sempre ativa por padrão no legado)
  config.configuracao_visibilidade_nexus.regras_liberacao.push({
    tipo: 'janela_24h',
    ativa: true,
    prioridade: 5,
    configuracao: { horas: 24 }
  });
  
  // Supervisão gerencial (se for gerente/coordenador)
  const nivelAtendente = user.attendant_role;
  if (['gerente', 'coordenador'].includes(nivelAtendente) || user.role === 'admin') {
    config.configuracao_visibilidade_nexus.regras_liberacao.push({
      tipo: 'gerente_supervisao',
      ativa: true,
      prioridade: 5,
      configuracao: { minutos_sem_resposta: 30 }
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MIGRAR PERMISSÕES DE AÇÕES
  // ═══════════════════════════════════════════════════════════════
  
  const permsComunicacao = user.permissoes_comunicacao || {};
  
  config.permissoes_acoes_nexus = {
    // Visualização
    podeVerTodasConversas: permsComunicacao.pode_ver_todas_conversas ?? (user.role === 'admin'),
    
    // Mensagens
    podeEnviarMensagens: permsComunicacao.pode_enviar_mensagens ?? true,
    podeEnviarMidias: permsComunicacao.pode_enviar_midias ?? true,
    podeEnviarAudios: permsComunicacao.pode_enviar_audios ?? true,
    
    // Gestão de conversas
    podeTransferirConversa: permsComunicacao.pode_transferir_conversas ?? true,
    podeApagarMensagens: permsComunicacao.pode_apagar_mensagens ?? false,
    podeAtribuirConversas: permsComunicacao.pode_atribuir_conversas ?? (user.role === 'admin'),
    podeGerenciarFilas: user.role === 'admin' || ['gerente', 'coordenador'].includes(nivelAtendente),
    
    // Contatos
    podeVerDetalhesContato: true,
    podeEditarContato: permsComunicacao.pode_editar_contatos ?? true,
    podeBloquearContato: permsComunicacao.pode_bloquear_contatos ?? false,
    podeDeletarContato: permsComunicacao.pode_deletar_contatos ?? false,
    
    // Playbooks
    podeCriarPlaybooks: permsComunicacao.pode_criar_templates ?? (user.role === 'admin'),
    podeEditarPlaybooks: user.role === 'admin',
    
    // Sistema
    podeGerenciarConexoes: user.role === 'admin',
    podeVerRelatorios: ['admin', 'gerente', 'coordenador'].includes(user.role) || ['gerente', 'coordenador'].includes(nivelAtendente),
    podeExportarDados: user.role === 'admin',
    podeGerenciarPermissoes: user.role === 'admin',
    podeVerDiagnosticos: user.role === 'admin'
  };
  
  return config;
}

/**
 * Analisa divergência entre decisão legado e Nexus360.
 * 
 * @param {Object} user - Usuário completo
 * @param {Object} thread - Thread a verificar
 * @param {Array} allIntegracoes - Todas integrações WhatsApp
 * @returns {Object} Análise comparativa
 */
export function analyzeDivergence(user, thread, allIntegracoes = []) {
  // 1. Decisão LEGADO
  const legado = calcularDecisaoLegado(user, thread);
  
  // 2. Decisão NEXUS360
  const userPermissions = buildUserPermissions(user, allIntegracoes);
  const nexusDecision = canUserSeeThreadBase(userPermissions, thread, thread.contact);
  const nexusDiagnostico = diagnosticarVisibilidadeThread(userPermissions, thread, thread.contact);
  
  // 3. Comparação
  const isMatch = legado.decision === nexusDecision;
  
  let reason = "✅ Decisões idênticas";
  let severity = "success";
  
  if (!isMatch) {
    if (legado.decision && !nexusDecision) {
      reason = "🚨 CRÍTICO: Legado permite mas Nexus bloqueia (Falso Negativo)";
      severity = "error";
    } else {
      reason = "⚠️ ALERTA: Legado bloqueia mas Nexus permite (Falso Positivo)";
      severity = "warning";
    }
  }
  
  return {
    threadId: thread.id,
    contactName: thread.contact?.nome || thread.last_message_sender_name || "Desconhecido",
    threadType: thread.thread_type || 'contact_external',
    
    // Decisões
    legacyDecision: legado.decision,
    legacyMotivo: legado.motivo,
    
    nexusDecision,
    nexusMotivo: nexusDiagnostico?.motivo || 'N/A',
    nexusReasonCode: nexusDiagnostico?.reason_code || 'N/A',
    nexusDecisionPath: nexusDiagnostico?.decision_path || [],
    
    // Comparação
    isMatch,
    reason,
    severity,
    
    // Debug
    threadData: {
      assigned: thread.assigned_user_id,
      sector: thread.sector_id,
      integration: thread.whatsapp_integration_id,
      channel: thread.channel,
      lastInbound: thread.last_inbound_at
    }
  };
}

/**
 * Executa análise em lote de múltiplas threads.
 * 
 * @param {Object} user - Usuário
 * @param {Array} threads - Lista de threads
 * @param {Array} allIntegracoes - Integrações
 * @returns {Object} Estatísticas + resultados
 */
export function executarAnaliseEmLote(user, threads, allIntegracoes = []) {
  const resultados = threads.map(thread => analyzeDivergence(user, thread, allIntegracoes));
  
  const stats = {
    total: resultados.length,
    matches: resultados.filter(r => r.isMatch).length,
    divergencias: resultados.filter(r => !r.isMatch).length,
    criticosFalsoNegativo: resultados.filter(r => r.severity === 'error').length,
    alertasFalsoPositivo: resultados.filter(r => r.severity === 'warning').length,
    taxa_aderencia: resultados.length > 0 ? (resultados.filter(r => r.isMatch).length / resultados.length * 100).toFixed(1) : 0
  };
  
  return {
    stats,
    resultados,
    timestamp: new Date().toISOString()
  };
}