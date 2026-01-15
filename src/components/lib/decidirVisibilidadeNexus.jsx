/**
 * Motor de Decisão Nexus360: Regras P1-P12
 * Ordem: Hard Core (P1,P9-P11) → Ownership (P3,P4,P6,P7) → Soft Core (P5,P8,P12)
 */

/**
 * Verifica se thread é interna e usuário não participa
 */
function isThreadInternaNaoParticipante(user, thread) {
  if (thread.thread_type !== 'team_internal') return false;
  const participants = thread.participants || [];
  return !participants.includes(user.id);
}

/**
 * Verifica P9: Canal bloqueado
 */
function canalBloqueado(cfg, thread) {
  const bloqueios = cfg?.regras_bloqueio?.find(r => r.tipo === 'canal' && r.ativa);
  if (!bloqueios) return false;
  return bloqueios.valores_bloqueados?.includes(thread.channel);
}

/**
 * Verifica P10: Integração bloqueada
 */
function integracaoBloqueada(cfg, thread, integracoes) {
  const bloqueios = cfg?.regras_bloqueio?.find(r => r.tipo === 'integracao' && r.ativa);
  if (!bloqueios) return false;
  return bloqueios.valores_bloqueados?.includes(thread.whatsapp_integration_id);
}

/**
 * Verifica P11: Setor bloqueado
 */
function setorBloqueado(cfg, thread) {
  const bloqueios = cfg?.regras_bloqueio?.find(r => r.tipo === 'setor' && r.ativa);
  if (!bloqueios) return false;
  return bloqueios.valores_bloqueados?.includes(thread.sector_id);
}

/**
 * Verifica P3: Usuário é dono da thread
 */
function isOwner(user, thread) {
  return thread.assigned_user_id === user.id;
}

/**
 * Verifica P7: Pode ver conversas de outros atendentes do setor
 */
function podeVerConversasOutros(user, thread, acoes) {
  if (!acoes?.podeVerConversasOutros) return false;
  // Deve estar no mesmo setor
  return user.setor === thread.sector_id;
}

/**
 * Verifica P6: Pode ver carteiras de outros atendentes
 */
function podeVerCarteiraOutros(user, thread, acoes) {
  if (!acoes?.podeVerCarteiraOutros) return false;
  // Contatos fidelizados a colegas do mesmo setor
  return user.setor === thread.sector_id && thread.is_fidelizado;
}

/**
 * Verifica P5: Janela de 24h (última interação recente)
 */
function janelaAtiva(cfg, thread) {
  const regra = cfg?.regras_liberacao?.find(r => r.tipo === 'janela_24h' && r.ativa);
  if (!regra) return false;

  const horas = regra.configuracao?.horas || 24;
  const ultimaInteracao = thread.last_inbound_at ? new Date(thread.last_inbound_at) : null;

  if (!ultimaInteracao) return false;

  const agora = new Date();
  const diffMs = agora - ultimaInteracao;
  const diffHoras = diffMs / (1000 * 60 * 60);

  return diffHoras <= horas;
}

/**
 * Verifica P8: Supervisão gerencial (resposta pendente > X minutos)
 */
function supervisaoGerencialAtiva(cfg, thread, user) {
  const regra = cfg?.regras_liberacao?.find(r => r.tipo === 'gerente_supervisao' && r.ativa);
  if (!regra) return false;

  // Apenas coordenador/gerente
  if (!['coordenador', 'gerente'].includes(user.attendant_role)) return false;

  const minutos = regra.configuracao?.minutos_sem_resposta || 30;
  const ultimaRespostaAtendente = thread.last_outbound_at ? new Date(thread.last_outbound_at) : null;

  if (!ultimaRespostaAtendente) return false;

  const agora = new Date();
  const diffMs = agora - ultimaRespostaAtendente;
  const diffMinutos = diffMs / (1000 * 60);

  return diffMinutos >= minutos;
}

/**
 * Motor principal: Decide se user pode ver thread
 */
export function decidirVisibilidadeNexus(user, thread, integracoes = []) {
  const cfg = user.configuracao_visibilidade_nexus;
  const acoes = user.permissoes_acoes_nexus;
  const decision_path = [];

  // ===== 1) HARD CORE: Compliance e Segurança =====

  // P1: Thread interna sem participação
  if (isThreadInternaNaoParticipante(user, thread)) {
    return {
      decision: 'DENY',
      reason_code: 'P1_THREAD_INTERNA_NAO_PARTICIPANTE',
      decision_path: [...decision_path, 'P1_DENY'],
    };
  }

  // P9: Canal bloqueado
  if (canalBloqueado(cfg, thread)) {
    return {
      decision: 'DENY',
      reason_code: 'P9_CANAL_BLOQUEADO',
      decision_path: [...decision_path, 'P9_DENY'],
    };
  }

  // P10: Integração bloqueada
  if (integracaoBloqueada(cfg, thread, integracoes)) {
    return {
      decision: 'DENY',
      reason_code: 'P10_INTEGRACAO_BLOQUEADA',
      decision_path: [...decision_path, 'P10_DENY'],
    };
  }

  // P11: Setor bloqueado
  if (setorBloqueado(cfg, thread)) {
    return {
      decision: 'DENY',
      reason_code: 'P11_SETOR_BLOQUEADO',
      decision_path: [...decision_path, 'P11_DENY'],
    };
  }

  // ===== 2) OWNERSHIP & COLABORAÇÃO =====

  // P3: User é dono (assigned_user_id)
  if (isOwner(user, thread)) {
    return {
      decision: 'ALLOW',
      reason_code: 'P3_OWNER',
      decision_path: [...decision_path, 'P3_ALLOW'],
    };
  }

  // P7: Pode ver conversas de outros do mesmo setor
  if (podeVerConversasOutros(user, thread, acoes)) {
    return {
      decision: 'ALLOW',
      reason_code: 'P7_CONVERSAS_OUTROS',
      decision_path: [...decision_path, 'P7_ALLOW'],
    };
  }

  // P6: Pode ver carteiras de outros atendentes
  if (podeVerCarteiraOutros(user, thread, acoes)) {
    return {
      decision: 'ALLOW',
      reason_code: 'P6_CARTEIRA_OUTROS',
      decision_path: [...decision_path, 'P6_ALLOW'],
    };
  }

  // ===== 3) SOFT CORE: Exceções Configuráveis =====

  // P5: Janela de 24h (ou custom)
  if (janelaAtiva(cfg, thread)) {
    return {
      decision: 'ALLOW',
      reason_code: 'P5_JANELA_ATIVA',
      decision_path: [...decision_path, 'P5_ALLOW'],
    };
  }

  // P8: Supervisão gerencial
  if (supervisaoGerencialAtiva(cfg, thread, user)) {
    return {
      decision: 'ALLOW',
      reason_code: 'P8_SUPERVISAO_GERENCIAL',
      decision_path: [...decision_path, 'P8_ALLOW'],
    };
  }

  // P_ACAO: Flag "Ver Todas Conversas"
  if (acoes?.podeVerTodasConversas) {
    return {
      decision: 'ALLOW',
      reason_code: 'P_ACAO_VER_TODAS',
      decision_path: [...decision_path, 'P_ACAO_ALLOW'],
    };
  }

  // ===== 4) DEFAULT (P12) =====
  const allowDefault = cfg?.modo_visibilidade === 'padrao_liberado';

  return {
    decision: allowDefault ? 'ALLOW' : 'DENY',
    reason_code: allowDefault ? 'P12_DEFAULT_ALLOW' : 'P12_DEFAULT_DENY',
    decision_path: [...decision_path, `P12_${allowDefault ? 'ALLOW' : 'DENY'}`],
  };
}

/**
 * Wrapper com seleção de runtime (legacy/shadow/ativo)
 */
export function decidirVisibilidade(user, thread, integracoes = [], runtimeMode = 'legacy', legacyDecider = null) {
  const runtime = runtimeMode || user.sistema_permissoes_ativo || 'legacy';

  // Sempre chama legado para baseline
  const legacyResult = legacyDecider?.(user, thread) ?? { decision: 'ALLOW' };

  // Runtime: legacy
  if (runtime === 'legacy') {
    return legacyResult;
  }

  // Runtime: nexus360_ativo
  if (runtime === 'nexus_ativo') {
    return decidirVisibilidadeNexus(user, thread, integracoes);
  }

  // Runtime: nexus_shadow (calcula ambas, loga divergências, retorna legado)
  if (runtime === 'nexus_shadow') {
    const nexusResult = decidirVisibilidadeNexus(user, thread, integracoes);
    if (nexusResult.decision !== legacyResult.decision) {
      console.warn('[NEXUS SHADOW]', {
        user_id: user.id,
        thread_id: thread.id,
        legacy: legacyResult.decision,
        nexus: nexusResult.decision,
        nexus_reason: nexusResult.reason_code,
      });
    }
    return legacyResult; // Shadow não afeta o resultado
  }

  // Default: legacy
  return legacyResult;
}