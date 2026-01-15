/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 MOTOR DE DECISÃO ÚNICO - P1 a P12
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * FONTE ÚNICA DE VERDADE para visibilidade de threads
 * Implementa sequência linear P1-P12 (legado como fallback)
 * 
 * Princípio: Negócio > Tecnologia
 * - Chaves mestras (atribuição/fidelização) ignoram tudo
 * - Fail-safe 24h para mensagens recentes
 * - Hard Core (P1,P9-P11) bloqueia antes de soft core
 * - Nexus360: configurável; Legado: hardcoded
 */

import { usuarioCorresponde, contatoFidelizadoAoUsuario } from './userMatcher';

const normalizar = (v) => (v ? String(v).trim().toLowerCase() : '');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRUÇÃO DE PERMISSÕES (Nexus360)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Monta objeto de permissões processadas a partir do usuário Nexus360
 * Entrada: registro de User com configuracao_visibilidade_nexus
 * Saída: objeto otimizado para decisões rápidas
 */
export function buildUserPermissions(usuario, allIntegracoes = []) {
  if (!usuario) return null;

  const configNexus = usuario.configuracao_visibilidade_nexus || {};
  const acoes = usuario.permissoes_acoes_nexus || {};

  // Extrair bloqueios de HARD CORE (P1/P9/P10/P11) - vêm da tela de permissões
  const hardCoreBloqueios = usuario.hard_core_bloqueios || {};
  
  // Extrair bloqueios ativos (Nexus360 custom)
  const regrasBloqueio = (configNexus.regras_bloqueio || [])
    .filter(r => r.ativa)
    .sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0));

  const regrasLiberacao = (configNexus.regras_liberacao || [])
    .filter(r => r.ativa)
    .sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0));

  // Extrair valores bloqueados por tipo (COMBINAR HARD CORE + CUSTOM)
  const setoresBloqueadosNexus = regrasBloqueio
    .filter(r => r.tipo === 'setor')
    .flatMap(r => r.valores_bloqueados || []);
  const setoresBloqueados = [
    ...(hardCoreBloqueios.setores || []),
    ...setoresBloqueadosNexus
  ];

  const integracoesBloqueadasNexus = regrasBloqueio
    .filter(r => r.tipo === 'integracao')
    .flatMap(r => r.valores_bloqueados || []);
  const integracoesBloqueadas = [
    ...(hardCoreBloqueios.integracoes || []),
    ...integracoesBloqueadasNexus
  ];

  const canaisBloqueadosNexus = regrasBloqueio
    .filter(r => r.tipo === 'canal')
    .flatMap(r => r.valores_bloqueados || []);
  const canaisBloqueados = [
    ...(hardCoreBloqueios.canais || []),
    ...canaisBloqueadosNexus
  ];

  // Extrair regras de liberação
  const janelaRegra = regrasLiberacao.find(r => r.tipo === 'janela_24h');
  const supervisionRegra = regrasLiberacao.find(r => r.tipo === 'gerente_supervisao');

  return {
    // Identificação
    id: usuario.id,
    email: usuario.email,
    role: usuario.role,
    attendant_role: usuario.attendant_role,
    attendant_sector: usuario.attendant_sector,

    // Bloqueios P9-P11
    setoresBloqueados,
    integracoesBloqueados,
    canaisBloqueados,

    // Liberações P5, P8
    janela24hAtiva: !!janelaRegra,
    janela24hHoras: janelaRegra?.configuracao?.horas || 24,
    supervisionAtiva: !!supervisionRegra,
    supervisionMinutos: supervisionRegra?.configuracao?.minutos_sem_resposta || 30,

    // Flags de ação (P6, P7, P11)
    podeVerCarteiraOutros: acoes?.podeVerCarteiraOutros ?? false,
    podeVerConversasOutros: acoes?.podeVerConversasOutros ?? false,
    podeVerTodosSetores: acoes?.podeVerTodosSetores ?? false,
    podeVerTodasConversas: acoes?.podeVerTodasConversas ?? false,
    strictMode: acoes?.strictMode ?? false,

    // Modo padrão P12
    modoVisibilidade: configNexus.modo_visibilidade || 'padrao_liberado',

    // Integração de permissões legadas (fallback)
    whatsapp_permissions: usuario.whatsapp_permissions || [],
    permissoes_visualizacao: usuario.permissoes_visualizacao || {},
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS DE VERIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

function isThreadInterna(thread) {
  return thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';
}

function isParticipante(user, thread) {
  return thread?.participants?.includes(user.id);
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function isAtribuido(user, thread) {
  if (!user || !thread) return false;
  const userId = normalizar(user.id);
  const userEmail = normalizar(user.email);

  if (normalizar(thread.assigned_user_id) === userId) return true;
  if (normalizar(thread.assigned_user_email) === userEmail) return true;
  if (usuarioCorresponde(user, thread.assigned_user_id)) return true;
  if (usuarioCorresponde(user, thread.assigned_user_name)) return true;
  if (usuarioCorresponde(user, thread.assigned_user_email)) return true;

  return false;
}

function isFidelizado(user, contato) {
  if (!user || !contato || !contato.is_cliente_fidelizado) return false;
  return contatoFidelizadoAoUsuario(contato, user);
}

function isGerente(user) {
  return ['gerente', 'coordenador', 'supervisor'].includes(user?.attendant_role);
}

function getSectorFromThread(thread) {
  if (thread?.sector_id) return normalizar(thread.sector_id);
  if (thread?.setor) return normalizar(thread.setor);

  const tags = thread?.contato?.tags || thread?.categorias || [];
  const SETORES = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
  for (const setor of SETORES) {
    if (tags.includes(setor)) return normalizar(setor);
  }

  return null;
}

function horasDesdeUltimaInteracao(thread) {
  if (!thread?.last_inbound_at) return Infinity;
  const diff = Date.now() - new Date(thread.last_inbound_at).getTime();
  return diff / (1000 * 60 * 60);
}

function minutosDesdeUltimaRespostaAtendente(thread) {
  if (!thread?.last_outbound_at) return Infinity;
  const diff = Date.now() - new Date(thread.last_outbound_at).getTime();
  return diff / (1000 * 60);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTOR DE DECISÃO P1-P12
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Implementação linear P1-P12 com diagnóstico
 * @returns { visible, reason_code, decision_path, motivo }
 */
export function canUserSeeThreadDecision(perms, thread, contato = null) {
  if (!perms || !thread) {
    return {
      visible: false,
      reason_code: 'DADOS_INVALIDOS',
      decision_path: ['ERRO'],
      motivo: 'Permissões ou thread inválidas',
    };
  }

  const path = [];
  const logs = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // P1: THREAD INTERNA - PARTICIPAÇÃO OU ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  if (isThreadInterna(thread)) {
    const isParticip = isParticipante(perms, thread);
    const isAdminUser = isAdmin(perms);

    if (isParticip || isAdminUser) {
      path.push('P1_INTERNA_ALLOW');
      logs.push(`✅ P1: Thread interna - ${isAdminUser ? 'Admin' : 'Participante'}`);
      return {
        visible: true,
        reason_code: 'P1_INTERNA_PARTICIPANTE',
        decision_path: path,
        motivo: isAdminUser ? 'Admin - thread interna' : 'Participante da thread interna',
      };
    } else {
      path.push('P1_INTERNA_DENY');
      logs.push(`❌ P1: Thread interna - Não participante`);
      return {
        visible: false,
        reason_code: 'P1_INTERNA_NAO_PARTICIPANTE',
        decision_path: path,
        motivo: 'Não é participante de thread interna',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN / VER TODAS: PERMITE TUDO
  // ═══════════════════════════════════════════════════════════════════════════
  if (isAdmin(perms) || perms.podeVerTodasConversas) {
    path.push('ADMIN_ALLOW');
    logs.push(`✅ Admin ou podeVerTodasConversas - acesso total`);
    return {
      visible: true,
      reason_code: 'ADMIN_FULL_ACCESS',
      decision_path: path,
      motivo: 'Admin ou flag podeVerTodasConversas',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P5: FAIL-SAFE 24h - MENSAGEM RECENTE (ignora P9-P11)
  // Aplica ANTES de chaves mestras para rapidez
  // ═══════════════════════════════════════════════════════════════════════════
  if (perms.janela24hAtiva && !perms.strictMode) {
    const horas = horasDesdeUltimaInteracao(thread);
    const limite = perms.janela24hHoras;

    if (horas < limite && thread.last_message_sender === 'contact') {
      // Proteção: se fidelizado a outro, bloqueia mesmo com fail-safe
      if (contato?.is_cliente_fidelizado && !isFidelizado(perms, contato)) {
        logs.push(`⚠️ P5: Janela 24h ativa MAS fidelizado a outro - DENY`);
        path.push('P5_JANELA_FIDELIZADO_OUTRO');
        return {
          visible: false,
          reason_code: 'P5_JANELA_MAS_FIDELIZADO_OUTRO',
          decision_path: path,
          motivo: `Janela ${limite}h ativa (${horas.toFixed(1)}h) MAS contato fidelizado a outro`,
        };
      }

      path.push('P5_JANELA_ALLOW');
      logs.push(`✅ P5: Fail-safe 24h ativo (${horas.toFixed(1)}h) - ignora P9-P11`);
      return {
        visible: true,
        reason_code: 'P5_JANELA_24H_ATIVA',
        decision_path: path,
        motivo: `Fail-safe 24h ativo (${horas.toFixed(1)}h) - ignora bloqueios técnicos`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P4: FIDELIZAÇÃO AO USUÁRIO (chave mestra - ignora P9-P11)
  // ═══════════════════════════════════════════════════════════════════════════
  if (contato && isFidelizado(perms, contato)) {
    path.push('P4_FIDELIZADO_ALLOW');
    logs.push(`✅ P4: Contato fidelizado ao usuário - ignora bloqueios`);
    return {
      visible: true,
      reason_code: 'P4_FIDELIZADO',
      decision_path: path,
      motivo: 'Contato fidelizado ao usuário (ignora P9-P11)',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P3: ATRIBUIÇÃO AO USUÁRIO (chave mestra - ignora P9-P11)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isAtribuido(perms, thread)) {
    path.push('P3_ATRIBUIDO_ALLOW');
    logs.push(`✅ P3: Thread atribuída ao usuário - ignora bloqueios`);
    return {
      visible: true,
      reason_code: 'P3_ATRIBUIDO',
      decision_path: path,
      motivo: 'Thread atribuída ao usuário (ignora P9-P11)',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUEIO DURO: FIDELIZAÇÃO A OUTRO (bloqueia tudo, inclusive admin em algumas configs)
  // ═══════════════════════════════════════════════════════════════════════════
  if (contato?.is_cliente_fidelizado && !isFidelizado(perms, contato)) {
    path.push('FIDELIZADO_OUTRO_DENY');
    logs.push(`❌ Contato fidelizado a outro atendente - bloqueio total`);
    return {
      visible: false,
      reason_code: 'FIDELIZADO_A_OUTRO',
      decision_path: path,
      motivo: 'Contato fidelizado a outro atendente',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P8: SUPERVISÃO GERENCIAL (gerente vê threads sem resposta)
  // ═══════════════════════════════════════════════════════════════════════════
  if (perms.supervisionAtiva && !perms.strictMode && isGerente(perms)) {
    const minutos = minutosDesdeUltimaRespostaAtendente(thread);
    const limiteMinutos = perms.supervisionMinutos;

    if (minutos > limiteMinutos && thread.last_message_sender === 'contact') {
      path.push('P8_SUPERVISAO_ALLOW');
      logs.push(`✅ P8: Gerente - supervisão (${minutos.toFixed(0)}min sem resposta)`);
      return {
        visible: true,
        reason_code: 'P8_SUPERVISAO_GERENCIAL',
        decision_path: path,
        motivo: `Gerente - supervisão de resposta pendente (${minutos.toFixed(0)}min)`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P7: VER CONVERSAS DE OUTROS (mesmo setor)
  // ═══════════════════════════════════════════════════════════════════════════
  if (perms.podeVerConversasOutros) {
    const setorThread = getSectorFromThread(thread);
    if (setorThread && setorThread === normalizar(perms.attendant_sector)) {
      path.push('P7_CONVERSAS_OUTROS_ALLOW');
      logs.push(`✅ P7: Pode ver conversas de outros do setor`);
      return {
        visible: true,
        reason_code: 'P7_CONVERSAS_OUTROS',
        decision_path: path,
        motivo: 'Permissão para ver conversas de outros (mesmo setor)',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P6: VER CARTEIRAS DE OUTROS (contatos fidelizados a colegas)
  // ═══════════════════════════════════════════════════════════════════════════
  if (perms.podeVerCarteiraOutros && contato?.is_cliente_fidelizado) {
    const setorThread = getSectorFromThread(thread);
    if (setorThread && setorThread === normalizar(perms.attendant_sector)) {
      path.push('P6_CARTEIRA_OUTROS_ALLOW');
      logs.push(`✅ P6: Pode ver carteiras de outros do setor`);
      return {
        visible: true,
        reason_code: 'P6_CARTEIRA_OUTROS',
        decision_path: path,
        motivo: 'Permissão para supervisão de carteiras do setor',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P9: CANAL BLOQUEADO
  // ═══════════════════════════════════════════════════════════════════════════
  if (thread.channel && perms.canaisBloqueados?.includes(thread.channel)) {
    path.push('P9_CANAL_DENY');
    logs.push(`❌ P9: Canal ${thread.channel} bloqueado`);
    return {
      visible: false,
      reason_code: 'P9_CANAL_BLOQUEADO',
      decision_path: path,
      motivo: `Canal ${thread.channel} está bloqueado`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P10: INTEGRAÇÃO BLOQUEADA
  // ═══════════════════════════════════════════════════════════════════════════
  if (thread.whatsapp_integration_id) {
    const integId = thread.whatsapp_integration_id;

    // Verificar em bloqueios Nexus360
    if (perms.integracoesBloqueadas?.includes(integId)) {
      path.push('P10_INTEGRACAO_DENY');
      logs.push(`❌ P10: Integração ${integId} bloqueada (Nexus360)`);
      return {
        visible: false,
        reason_code: 'P10_INTEGRACAO_BLOQUEADA',
        decision_path: path,
        motivo: `Integração ${integId} está bloqueada`,
      };
    }

    // Verificar fallback legado (can_view)
    const legacyPerm = perms.whatsapp_permissions?.find(p => p.integration_id === integId);
    if (legacyPerm && legacyPerm.can_view === false) {
      path.push('P10_INTEGRACAO_LEGACY_DENY');
      logs.push(`❌ P10: Integração ${integId} bloqueada (Legacy can_view=false)`);
      return {
        visible: false,
        reason_code: 'P10_INTEGRACAO_BLOQUEADA_LEGACY',
        decision_path: path,
        motivo: `Integração ${integId} bloqueada (legacy)`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P11: SETOR BLOQUEADO
  // ═══════════════════════════════════════════════════════════════════════════
  if (!perms.podeVerTodosSetores) {
    const setorThread = getSectorFromThread(thread);

    if (setorThread && perms.setoresBloqueados?.includes(setorThread)) {
      path.push('P11_SETOR_DENY');
      logs.push(`❌ P11: Setor ${setorThread} bloqueado`);
      return {
        visible: false,
        reason_code: 'P11_SETOR_BLOQUEADO',
        decision_path: path,
        motivo: `Setor ${setorThread} está bloqueado`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P12: MODO PADRÃO (default allow/deny)
  // ═══════════════════════════════════════════════════════════════════════════
  const allowByDefault = perms.modoVisibilidade === 'padrao_liberado';

  if (allowByDefault) {
    path.push('P12_DEFAULT_ALLOW');
    logs.push(`✅ P12: Modo padrão liberado`);
    return {
      visible: true,
      reason_code: 'P12_PADRAO_LIBERADO',
      decision_path: path,
      motivo: 'Nenhuma regra de bloqueio - modo padrão libera',
    };
  } else {
    path.push('P12_DEFAULT_DENY');
    logs.push(`❌ P12: Modo padrão bloqueado`);
    return {
      visible: false,
      reason_code: 'P12_PADRAO_BLOQUEADO',
      decision_path: path,
      motivo: 'Nenhuma regra de liberação - modo padrão nega',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMUTADOR: LEGACY vs NEXUS360
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Decide qual motor usar baseado no sistema ativo do usuário
 * @param {Object} usuario - User record
 * @param {Object} thread - MessageThread
 * @param {Object} contato - Contact (opcional)
 * @param {Function} legacyDecider - Função do legado (fallback)
 * @param {Array} integracoes - Lista de integrações (para Nexus360)
 * @returns { visible, reason_code, decision_path, motivo, sistema_usado }
 */
export function decidirVisibilidade(usuario, thread, contato = null, legacyDecider = null, integracoes = []) {
  const sistema = usuario?.sistema_permissoes_ativo || 'legacy';

  // Nexus360 ativo: usar decisionEngine
  if (sistema === 'nexus360') {
    const perms = buildUserPermissions(usuario, integracoes);
    const resultado = canUserSeeThreadDecision(perms, thread, contato);
    resultado.sistema_usado = 'nexus360';
    return resultado;
  }

  // Shadow mode: roda ambos, loga divergência, retorna legacy
  if (sistema === 'nexus_shadow') {
    const permsNexus = buildUserPermissions(usuario, integracoes);
    const resultadoNexus = canUserSeeThreadDecision(permsNexus, thread, contato);

    const legacyRaw = legacyDecider ? legacyDecider(usuario, thread) : true;
    const resultadoLegacy = typeof legacyRaw === 'boolean' 
      ? { visible: legacyRaw, reason_code: legacyRaw ? 'LEGACY_ALLOW' : 'LEGACY_DENY', decision_path: [] }
      : legacyRaw;

    if (resultadoNexus.visible !== resultadoLegacy.visible) {
      console.warn('[NEXUS SHADOW DIVERGENCE]', {
        user_id: usuario.id,
        thread_id: thread.id?.substring(0, 8),
        legacy_result: resultadoLegacy.visible,
        nexus_result: resultadoNexus.visible,
        nexus_reason: resultadoNexus.reason_code,
      });
    }

    resultadoLegacy.sistema_usado = 'legacy (shadow-mode)';
    resultadoLegacy.nexus_shadow = resultadoNexus;
    return resultadoLegacy;
  }

  // Legacy (padrão): usar fallback
  const legacyRaw = legacyDecider ? legacyDecider(usuario, thread) : true;
  const resultado = typeof legacyRaw === 'boolean'
    ? { visible: legacyRaw, reason_code: legacyRaw ? 'LEGACY_ALLOW' : 'LEGACY_DENY', decision_path: [], sistema_usado: 'legacy' }
    : { ...legacyRaw, sistema_usado: 'legacy' };
  return resultado;
}

export default {
  buildUserPermissions,
  canUserSeeThreadDecision,
  decidirVisibilidade,
};