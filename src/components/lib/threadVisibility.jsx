/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 THREAD VISIBILITY - FUNÇÕES AUXILIARES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ⚠️ IMPORTANTE: Este arquivo contém apenas funções AUXILIARES.
 * A lógica de DECISÃO DE VISIBILIDADE está em permissionsService.js (Nexus360)
 * 
 * FUNÇÕES AQUI:
 * - temPermissaoIntegracao: Verifica whatsapp_permissions.can_view
 * - threadSetorVisivel: Verifica permissoes_visualizacao.setores_visiveis
 * - threadConexaoVisivel: Verifica permissoes_visualizacao.conexoes_visiveis
 * - verificarBloqueioThread: Retorna motivo de bloqueio
 * - podeInteragirNaThread: Verifica can_send/can_transfer
 * 
 * NÃO USAR PARA DECISÃO PRINCIPAL: Use permissionsService.canUserSeeThreadBase
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { usuarioCorresponde, contatoFidelizadoAoUsuario } from './userMatcher';

const normalizar = (v) => (v ? String(v).trim().toLowerCase() : '');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS DE PERMISSÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verifica se o usuário tem permissão para a integração (qualquer provedor)
 * ✅ NEXUS360: Lê whatsapp_permissions.can_view (padrão liberado)
 * 
 * ⚠️ ADMIN OBEDECE BLOQUEIOS (sem bypass) - alinhado com VISIBILITY_MATRIX P10
 */
export const temPermissaoIntegracao = (usuario, integracaoId, threadId = null) => {
  // ❌ REMOVIDO: Admin bypass (agora obedece bloqueios P10)
  // if (usuario?.role === 'admin') return true;
  
  const debugPrefix = threadId ? `[Thread ${threadId.substring(0, 8)}]` : '[INTEGRACAO]';
  
  // Primeiro checa whatsapp_permissions (estrutura atual)
  const whatsappPerms = usuario?.whatsapp_permissions || [];
  if (whatsappPerms.length > 0) {
    // ✅ Thread sem integração = liberar (não bloquear)
    if (!integracaoId) return true;
    const perm = whatsappPerms.find(p => p.integration_id === integracaoId);
    const temPermissao = perm?.can_view === true;
    
    // 🔍 DEBUG: Log quando bloquear por falta de permissão
    if (!temPermissao) {
      console.log(`${debugPrefix} [VISIBILIDADE] ❌ Bloqueado por integração: User ${usuario.email} não tem can_view para ${integracaoId}`);
    }
    
    return temPermissao;
  }
  
  // Fallback: integracoes_visiveis em permissoes_visualizacao
  const perms = usuario?.permissoes_visualizacao || {};
  const visiveis = perms.integracoes_visiveis;
  
  // ✅ DECISÃO CONSCIENTE (UX > Segurança na fase inicial):
  // Sem configuração = LIBERA para evitar travamento operacional
  // Fidelização protege dados críticos de qualquer forma
  if (!visiveis || visiveis.length === 0) return true;
  if (!integracaoId) return true; // Thread sem integração = visível
  
  const temPermissao = visiveis.map(normalizar).includes(normalizar(integracaoId));
  
  // 🔍 DEBUG: Log quando bloquear
  if (!temPermissao) {
    console.log(`${debugPrefix} [VISIBILIDADE] ❌ Bloqueado por integração: ${integracaoId} não está em integracoes_visiveis=[${visiveis.join(', ')}]`);
  }
  
  return temPermissao;
};

/**
 * Verifica se o usuário tem permissão para a conexão/número específico
 * ✅ NEXUS360: Admin OBEDECE bloqueios (sem bypass)
 */
export const threadConexaoVisivel = (usuario, conexaoId) => {
  // ❌ REMOVIDO: Admin bypass (agora obedece bloqueios)
  // if (usuario?.role === 'admin') return true;
  
  const perms = usuario?.permissoes_visualizacao || {};
  const visiveis = perms.conexoes_visiveis;
  
  // ✅ FIX: Sem restrições configuradas = acesso liberado
  if (!visiveis || visiveis.length === 0) return true;
  if (!conexaoId) return true; // Thread sem conexão = visível
  
  return visiveis.map(normalizar).includes(normalizar(conexaoId));
};

/**
 * Obtém o setor de uma thread com fallback para etiquetas do contato
 * Modo 1: URA define thread.sector_id → prioridade
 * Modo 2: Etiqueta do contato (Fornecedor, Cliente, etc.) → fallback
 */
export const getSectorFromThreadOrTags = (thread) => {
  // PRIORIDADE 1: Setor explícito da URA
  if (thread?.sector_id) return normalizar(thread.sector_id);
  if (thread?.setor) return normalizar(thread.setor);
  
  // PRIORIDADE 2: Etiquetas setoriais do contato
  const tags = thread?.contato?.tags || thread?.categorias || [];
  const tagsNormalizadas = tags.map(normalizar);
  
  // Mapeamento: etiqueta → setor
  const SETORES = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
  
  for (const setor of SETORES) {
    if (tagsNormalizadas.includes(setor)) {
      return setor;
    }
  }
  
  return null; // Sem setor definido
};

/**
 * Verifica se usuário pode ver thread baseado no setor (URA ou etiqueta)
 * ✅ NEXUS360: Admin OBEDECE bloqueios (sem bypass) - alinhado com P11
 */
export const threadSetorVisivel = (usuario, thread) => {
  // ❌ REMOVIDO: Admin bypass (agora obedece bloqueios P11)
  // if (usuario?.role === 'admin') return true;
  
  const perms = usuario?.permissoes_visualizacao || {};
  const setoresUser = perms.setores_visiveis;
  
  // ✅ REGRA SUAVIZADA: Sem configuração = LIBERA (não bloqueia por padrão)
  // Só bloqueia se houver configuração explícita e não estiver na lista
  if (!setoresUser || setoresUser.length === 0) {
    console.log(`[VISIBILIDADE] ✅ Usuário ${usuario?.email} sem setores configurados - liberando (sem restrição)`);
    return true;
  }
  
  // Obter setor da thread (URA ou etiqueta)
  const setorThread = getSectorFromThreadOrTags(thread);
  
  // Thread sem setor definido = visível para todos
  if (!setorThread) return true;
  
  // Verificar se usuário tem permissão para este setor
  const setoresUserNormalizados = setoresUser.map(normalizar);
  const temPermissao = setoresUserNormalizados.includes(setorThread);
  
  // 🔍 DEBUG: Log quando bloquear
  if (!temPermissao) {
    console.log(`[VISIBILIDADE] ❌ Bloqueado por setor: Thread setor="${setorThread}" (URA/tag) | User setores=[${setoresUser.join(', ')}]`);
  }
  
  return temPermissao;
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS DE RELAÇÃO THREAD X USUÁRIO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verifica se a thread está atribuída ao usuário (ESTRITO E SEGURO)
 * Compara ID, Email e Nome com normalização para evitar falsos negativos
 * por espaços, maiúsculas ou tipo de dados inconsistentes no banco
 */
export const isAtribuidoAoUsuario = (usuario, thread) => {
  if (!usuario || !thread) return false;
  
  const userId = normalizar(usuario.id);
  const userEmail = normalizar(usuario.email);
  
  // ✅ PROTEÇÃO CONTRA DADOS SUJOS (espaços, maiúsculas)
  // 1. Checagem Direta de ID (O mais confiável)
  if (thread.assigned_user_id && normalizar(thread.assigned_user_id) === userId) {
    return true;
  }

  // 2. Checagem de Email (Fallback comum)
  if (thread.assigned_user_email && normalizar(thread.assigned_user_email) === userEmail) {
    return true;
  }

  // 3. Checagem via helper externo + nome (para entidades inconsistentes)
  if (usuarioCorresponde(usuario, thread.assigned_user_id) || 
      usuarioCorresponde(usuario, thread.assigned_user_name) ||
      usuarioCorresponde(usuario, thread.assigned_user_email)) {
    return true;
  }

  return false;
};

/**
 * Verifica se o contato está fidelizado ao usuário
 * ✅ DEFENSIVO: Trata contato null, usuario null, e validação dupla
 */
export const isFidelizadoAoUsuario = (usuario, contato) => {
  // Proteção contra null/undefined (ponto de falha #2: Contato Null)
  if (!contato || !usuario) return false;
  
  // Chamar matcher - já trata dados sujos e normaliza (ponto de falha #1 e #3)
  const resultado = contatoFidelizadoAoUsuario(contato, usuario);
  
  // Validação defensiva: se contato tem flag is_cliente_fidelizado = true
  // mas matcher retornou false, registrar para debug (indica falha no matcher)
  if (contato.is_cliente_fidelizado && !resultado) {
    // Apenas um aviso - não muda o resultado
    // Se o matcher falhou aqui, é bug no userMatcher.js
  }
  
  return resultado;
};

/**
 * Verifica se a thread não está atribuída a ninguém
 * ✅ THREADS INTERNAS NUNCA SÃO "NÃO ATRIBUÍDAS" (já têm participants)
 */
export const isNaoAtribuida = (thread) => {
  // Threads internas não usam assigned_user_id (usam participants)
  if (thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group') {
    return false;
  }
  
  return !thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email;
};

/**
 * Verifica se o usuário já conversou com este contato/thread
 * Analisa o campo ultimo_atendente_id ou mensagens anteriores
 */
export const usuarioJaConversouComContato = (usuario, thread, mensagensThread = []) => {
  if (!usuario || !thread) return false;
  
  // 1. Verificar se há registro do último atendente na thread
  if (thread.ultimo_atendente_id) {
    if (usuarioCorresponde(usuario, thread.ultimo_atendente_id)) {
      return true;
    }
  }
  
  // 2. Verificar nas mensagens se o usuário já enviou alguma
  if (mensagensThread && mensagensThread.length > 0) {
    const usuarioEnviouMensagem = mensagensThread.some(msg => 
      msg.sender_type === 'user' && usuarioCorresponde(usuario, msg.sender_id)
    );
    if (usuarioEnviouMensagem) {
      return true;
    }
  }
  
  return false;
};

// ═══════════════════════════════════════════════════════════════════════════════
// REGRA BASE: "MINHA CAIXA" (sem filtro de atendente)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * ✅ Conversas atribuídas ao próprio usuário
 * ✅ Conversas de contatos fidelizados (se não atribuídas a outro)
 * ✅ Conversas não atribuídas (S/atend.) - SEMPRE VISÍVEIS PARA TODOS
 * ✅ Conversas não atribuídas onde o usuário JÁ CONVERSOU anteriormente
 * ❌ Conversas atribuídas a outro atendente
 * ❌ Conversas fidelizadas a outro atendente
 * 
 * REGRA PRINCIPAL: Todo usuário SEMPRE vê:
 * - Suas conversas atribuídas
 * - Contatos fidelizados a ele
 * - TODAS as conversas não atribuídas (para poder atender)
 */
export const canUserSeeThreadBase = (usuario, thread, mensagensThread = []) => {
  if (!usuario || !thread) return false;

  const perms = usuario.permissoes_visualizacao || {};
  const isAdmin = usuario.role === 'admin';
  const isAdminOrAll = isAdmin || !!perms.pode_ver_todas_conversas;

  // ✅ THREADS INTERNAS - visibilidade baseada APENAS em participação/admin
  // ZERO regras de WhatsApp/integração/conexão/setor aplicadas
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    const isParticipant = thread.participants?.includes(usuario.id);
    
    // Participante OU admin/gerente pode ver
    return Boolean(isParticipant || isAdminOrAll);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORDEM DE PRIORIDADE - VISIBILIDADE BASE (AGNÓSTICA DE PROVEDOR)
  // ═══════════════════════════════════════════════════════════════════════════════
  const contato = thread.contato;
  const fidelizado = isFidelizadoAoUsuario(usuario, contato);
  const atribuido = isAtribuidoAoUsuario(usuario, thread);
  const naoAtribuida = isNaoAtribuida(thread);
  const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuario.attendant_role);

  // 0) Admin / "ver todas" - VÊ TUDO (todas as threads, todos os provedores)
  if (isAdminOrAll) {
    return true;
  }

  // 🔔 PRIORIDADE ZERO: FAIL-SAFE ABSOLUTO - MENSAGENS RECEBIDAS <24h
  // → SEMPRE VISÍVEL (ignora TUDO: atribuição, integração, setor, conexão)
  // → ÚNICO BLOQUEIO: Fidelização a OUTRO (proteção de cliente VIP)
  if (thread.last_inbound_at && thread.last_message_sender === 'contact') {
    const horasSemResposta = (Date.now() - new Date(thread.last_inbound_at).getTime()) / (1000 * 60 * 60);
    
    if (horasSemResposta < 24) {
      // Respeitar fidelização a OUTRO (proteção VIP)
      if (contato?.is_cliente_fidelizado && !fidelizado) {
        console.log(`[VISIBILIDADE] 🛑 Thread ${thread.id?.substring(0, 8)} - Mensagem <24h MAS fidelizada a outro`);
        return false;
      }
      
      console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - FAIL-SAFE 24h ATIVADO (${horasSemResposta.toFixed(1)}h) - IGNORA atribuição/integração/setor`);
      return true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔑 CHAVE MESTRA ABSOLUTA: "Se é o dono, nunca bloqueia"
  // ═══════════════════════════════════════════════════════════════════════════════
  // Verificada DEPOIS do fail-safe (para threads "frias")
  
  // 🔑 PRIORIDADE #1: Contato FIDELIZADO ao usuário
  // → SEMPRE VÊ (ignora integração/setor/conexão/permissão/filtros)
  if (fidelizado) {
    return true;
  }

  // 🔑 PRIORIDADE #2: Thread ATRIBUÍDA ao usuário
  // → SEMPRE VÊ (ignora integração/setor/conexão/permissão/filtros)
  if (atribuido) {
    return true;
  }

  // 🔑 PRIORIDADE #2.5: HISTÓRICO DE ATENDIMENTO
  // → Usuário já esteve nesta conversa (shared_with_users = ex-atendentes)
  const estaNoHistorico =
    thread.shared_with_users?.includes(usuario.id) ||
    thread.atendentes_historico?.includes(usuario.id) ||
    thread.metadata?.atendentes_anteriores?.includes(usuario.id);

  if (estaNoHistorico) {
    return true;
  }

  // 🛑 BLOQUEIO ABSOLUTO: Contato fidelizado a OUTRO usuário
  // → Só o dono vê (bloqueia todos outros - inclui admin/gerente)
  if (contato?.is_cliente_fidelizado) {
    return false;
  }

  // 4) GERENTES veem threads SEM RESPOSTA há 30+ minutos
  if (isGerente && thread.last_inbound_at) {
    const tempoSemResposta = Date.now() - new Date(thread.last_inbound_at).getTime();
    const minutos30 = 30 * 60 * 1000;
    
    if (tempoSemResposta > minutos30 && thread.last_message_sender === 'contact') {
      console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - Gerente vê (30min sem resposta)`);
      return true;
    }
  }

  // 5) GERENTES podem ver qualquer thread do sistema (exceto fidelizadas a outro)
  if (isGerente) {
    // Se a thread está atribuída a outro, gerente ainda pode visualizar
    if (thread.assigned_user_id) {
      console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - Gerente pode visualizar (atribuída a outro)`);
      return true;
    }
  }

  // 7) Thread NÃO ATRIBUÍDA (S/atend.) - todos podem ver SE tiverem permissão de integração
  if (naoAtribuida) {
    // ✅ EXCEÇÃO CRÍTICA: MENSAGENS RECEBIDAS com interação nas últimas 24h
    // Se o contato enviou mensagem recentemente → SEMPRE VISÍVEL
    if (thread.last_inbound_at) {
      const horasSemResposta = (Date.now() - new Date(thread.last_inbound_at).getTime()) / (1000 * 60 * 60);
      
      // Mensagem NOVA (< 24h) de cliente esperando → SEMPRE VISÍVEL (ignora integração)
      if (horasSemResposta < 24 && thread.last_message_sender === 'contact') {
        console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - MENSAGEM RECEBIDA RECENTE (${horasSemResposta.toFixed(1)}h) - SEMPRE VISÍVEL`);
        return true;
      }
    }
    
    // Para threads "frias" (sem interação recente), aplicar filtros técnicos
    const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id, thread.id);
    if (!integracaoOk) {
      console.log(`[VISIBILIDADE] ❌ Thread ${thread.id?.substring(0, 8)} bloqueada - Integração sem permissão`);
      return false;
    }

    const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
    if (!conexaoOk) {
      console.log(`[VISIBILIDADE] ❌ Thread ${thread.id?.substring(0, 8)} bloqueada - Conexão sem permissão`);
      return false;
    }

    const setorOk = threadSetorVisivel(usuario, thread);
    if (!setorOk) {
      const setor = thread.sector_id || thread.setor || 'N/A';
      console.log(`[VISIBILIDADE] ❌ Thread ${thread.id?.substring(0, 8)} bloqueada - Setor ${setor} sem permissão`);
      return false;
    }
    
    console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - NÃO ATRIBUÍDA + permissões OK - visível`);
    return true;
  }
  
  // 6️⃣ Thread atribuída a OUTRO (não fidelizada) - aplicar filtros técnicos
  // Gerentes podem ver, atendentes comuns não
  if (!isGerente) {
    console.log(`[VISIBILIDADE] ❌ Thread ${thread.id?.substring(0, 8)} bloqueada - Atribuída a outro`);
    return false;
  }
  
  // Gerente pode ver, mas verificar permissões de integração
  const integracaoOkGerente = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id, thread.id);
  if (!integracaoOkGerente) {
    console.log(`[VISIBILIDADE] ❌ Thread ${thread.id?.substring(0, 8)} bloqueada - Gerente sem permissão em integração`);
    return false;
  }

  console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - Gerente pode visualizar`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGRA COM FILTROS: Funil de 5 Estágios
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * 🟢 ESTÁGIO 1: BARREIRA DE SEGURANÇA (Hardware & Permissões)
 * 🔵 ESTÁGIO 2: FILTRO DE ESCOPO (Abas: my, unassigned, all)
 * 🟠 ESTÁGIO 3: FILTROS DE ATRIBUTOS (Conexão, Atendente, etc.)
 * 🟣 ESTÁGIO 4: BUSCA TEXTUAL (aplicada em Comunicacao.jsx)
 * 🔴 ESTÁGIO 5: DEDUPLICAÇÃO (aplicada em Comunicacao.jsx)
 * 
 * @param {Object} usuario - Usuário logado
 * @param {Object} thread - Thread a verificar
 * @param {Object} filtros - Filtros ativos da tela
 * @param {string} filtros.atendenteId - ID do atendente selecionado no filtro
 * @param {string} filtros.integracaoId - ID da integração selecionada
 * @param {string} filtros.conexaoId - ID da conexão selecionada
 * @param {string} filtros.sectorId - ID do setor selecionado no filtro
 * @param {string} filtros.scope - 'my' | 'unassigned' | 'all'
 */
export const canUserSeeThreadWithFilters = (usuario, thread, filtros = {}) => {
  if (!usuario || !thread) return false;

  const perms = usuario.permissoes_visualizacao || {};
  const isAdmin = usuario.role === 'admin';
  const isAdminOrAll = isAdmin || !!perms.pode_ver_todas_conversas;

  // ✅ THREADS INTERNAS - visibilidade baseada APENAS em participação (ignora TODOS os filtros)
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    const isParticipant = thread.participants?.includes(usuario.id);
    return Boolean(isParticipant || isAdminOrAll);
  }

  const contato = thread.contato;
  const atribuido = isAtribuidoAoUsuario(usuario, thread);
  const fidelizado = isFidelizadoAoUsuario(usuario, contato);

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ PRIORIDADES ABSOLUTAS (IGNORAM TODAS AS RESTRIÇÕES)
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🔔 PRIORIDADE ZERO: FAIL-SAFE ABSOLUTO - MENSAGENS RECEBIDAS <24h
  // → SEMPRE VISÍVEL (ignora atribuição, integração, setor, conexão)
  // → ÚNICO BLOQUEIO: Fidelização a OUTRO (proteção VIP)
  // → RESPEITA ESCOPO: Não aparece em "my" se não for minha
  if (thread.last_inbound_at && thread.last_message_sender === 'contact') {
    const horasSemResposta = (Date.now() - new Date(thread.last_inbound_at).getTime()) / (1000 * 60 * 60);

    if (horasSemResposta < 24) {
      // Respeitar fidelização a OUTRO (proteção VIP)
      if (contato?.is_cliente_fidelizado && !fidelizado) {
        console.log(`[VISIBILIDADE] 🛑 Thread ${thread.id?.substring(0, 8)} - Mensagem <24h MAS fidelizada a outro`);
        return false;
      }

      console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - FAIL-SAFE 24h (${horasSemResposta.toFixed(1)}h) - IGNORA atribuição/integração/setor`);

      // 🎯 APLICAR APENAS ESCOPO (my/unassigned/all)
      if (filtros.scope === 'my') {
        // Mensagem recente mas não é minha → mostrar em "não atribuídas" ou "todas"
        return false;
      }

      if (filtros.scope === 'unassigned') {
        return isNaoAtribuida(thread); // Só mostra se não atribuída
      }

      // scope=all ou sem scope → sempre visível
      return true;
    }
  }

  // PRIORIDADE 1: Thread ATRIBUÍDA ao usuário → SEMPRE VÊ
  if (atribuido) {
    return true;
  }

  // PRIORIDADE 2: Contato FIDELIZADO ao usuário → SEMPRE VÊ
  // ✅ CRÍTICO: Fidelização ignora integração, setor, conexão
  if (fidelizado) {
    console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - FIDELIZADA ao usuário ${usuario.email} (ignora restrições)`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🟢 ESTÁGIO 1: BARREIRA DE SEGURANÇA (apenas para não-atribuídas/não-fidelizadas)
  // Aplicado apenas para threads "frias" (sem mensagem recente <24h)
  // ═══════════════════════════════════════════════════════════════════════
  
  const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id, thread.id);
  if (!integracaoOk) return false;

  const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
  if (!conexaoOk) return false;

  const setorOk = threadSetorVisivel(usuario, thread);
  if (!setorOk) return false;

  // ═══════════════════════════════════════════════════════════════════════
  // 🔵 ESTÁGIO 2: FILTRO DE ESCOPO (Abas de Navegação)
  // ═══════════════════════════════════════════════════════════════════════

  // A. Aba "Minhas Conversas" (scope = 'my')
  if (filtros.scope === 'my') {
    // Atribuição e fidelização já foram checadas no topo (PRIORIDADES ABSOLUTAS)
    // Se chegou aqui, não é atribuída nem fidelizada ao usuário
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🟠 ESTÁGIO 3: FILTROS DE ATRIBUTOS (Refinamento)
  // Aplicar TODOS os filtros selecionados (Lógica AND)
  // IMPORTANTE: Aplicar antes de verificar escopo para que filtros funcionem em todas abas
  // ═══════════════════════════════════════════════════════════════════════

  // 3.1 Filtro por Conexão Específica selecionada no dropdown
  if (filtros.integracaoId && filtros.integracaoId !== 'all') {
    if (normalizar(filtros.integracaoId) !== normalizar(thread.whatsapp_integration_id)) {
      return false;
    }
  }

  // 3.2 Filtro por conexão/número selecionada
  if (filtros.conexaoId && filtros.conexaoId !== 'all') {
    if (normalizar(filtros.conexaoId) !== normalizar(thread.conexao_id)) {
      return false;
    }
  }

  // B. Aba "Não Atribuídas" (scope = 'unassigned')
  // NOTA: A lógica de contexto (mostrar todas threads do contato) é feita em Comunicacao.jsx
  if (filtros.scope === 'unassigned') {
    // Thread órfã = sem assigned_user_id e sem assigned_user_email
    const baseCheck = naoAtribuida && (isAdminOrAll || perms.pode_ver_nao_atribuidas !== false);
    
    if (!baseCheck) return false;
    
    // Aplicar filtro de setor se selecionado
    if (filtros.sectorId && filtros.sectorId !== 'all') {
      const threadSetor = normalizar(thread.sector_id || thread.setor);
      if (threadSetor !== normalizar(filtros.sectorId)) {
        return false;
      }
    }
    
    return true;
  }

  // C. Aba "Todas" (scope = 'all') - Admin/Gerentes veem tudo que passou no Estágio 1
  // Para usuários comuns, usar regra base (atribuído + fidelizado + não atribuídas)
  if (filtros.scope === 'all') {
    if (isAdminOrAll) return true;
    return canUserSeeThreadBase(usuario, thread);
  }

  // 3.3 Filtro por Atendente Específico
  if (filtros.atendenteId && filtros.atendenteId !== 'all' && filtros.atendenteId !== usuario.id) {
    const alvoIdNorm = normalizar(filtros.atendenteId);

    // Verificar se pode ver esse atendente (permissões)
    const atendentesVisiveis = perms.atendentes_visiveis || [];
    const podeVerAtendente = isAdminOrAll || atendentesVisiveis.map(normalizar).includes(alvoIdNorm);

    if (!podeVerAtendente) {
      return false;
    }

    // Mostrar apenas conversas atribuídas ao atendente alvo
    const atribuidaAoAlvo = normalizar(thread.assigned_user_id) === alvoIdNorm;
    return atribuidaAoAlvo;
  }

  // Sem escopo definido → usar regra base
  return canUserSeeThreadBase(usuario, thread);
};

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRAR LISTA DE ATENDENTES PARA O FILTRO
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Retorna apenas os atendentes que o usuário pode ver no filtro
 */
export const filtrarAtendentesVisiveis = (usuario, todosAtendentes) => {
  if (!usuario || !todosAtendentes?.length) return [];

  const isAdmin = usuario.role === 'admin';
  const podeVerTodas = usuario.permissoes_visualizacao?.pode_ver_todas_conversas === true;
  const atendentesVisiveis = usuario.permissoes_visualizacao?.atendentes_visiveis || [];

  // Admin ou pode_ver_todas_conversas = vê todos
  if (isAdmin || podeVerTodas) {
    return todosAtendentes;
  }

  // Se não tem lista de atendentes visíveis, não mostra ninguém no filtro
  if (atendentesVisiveis.length === 0) {
    return [];
  }

  // Filtrar apenas os permitidos
  return todosAtendentes.filter(att => 
    atendentesVisiveis.map(normalizar).includes(normalizar(att.id))
  );
};

/**
 * Retorna o motivo pelo qual o usuário não pode acessar a thread
 * ORDEM DE PRIORIDADE (verificações em cascata):
 * @returns {Object} { bloqueado: boolean, motivo: string, atendenteResponsavel: string|null }
 */
export const verificarBloqueioThread = (usuario, thread, contato = null) => {
  if (!usuario || !thread) {
    return { bloqueado: true, motivo: 'dados_invalidos', atendenteResponsavel: null };
  }

  const perms = usuario.permissoes_visualizacao || {};
  const podeVerTodas = perms.pode_ver_todas_conversas === true;
  const isAdmin = usuario.role === 'admin';

  // ✅ CORREÇÃO: Admin NUNCA é bloqueado em verificação de interação
  if (isAdmin || podeVerTodas) {
    console.log(`[BLOQUEIO] ✅ BYPASS ADMIN - Usuário ${usuario.email} tem acesso total`);
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // ✅ THREADS INTERNAS - visibilidade baseada em participação apenas
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    const isParticipant = thread.participants?.includes(usuario.id);
    if (isParticipant) {
      return { bloqueado: false, motivo: null, atendenteResponsavel: null };
    }
    return { bloqueado: true, motivo: 'nao_participante', atendenteResponsavel: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIORIDADE 1: Thread ATRIBUÍDA ao usuário → NUNCA bloqueia (ignora TUDO)
  // ═══════════════════════════════════════════════════════════════════════════════
  const isAtribuido = isAtribuidoAoUsuario(usuario, thread);
  if (isAtribuido) {
    console.log(`[BLOQUEIO] ✅ LIBERADO - Thread ATRIBUÍDA ao usuário: ${usuario.email}`);
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIORIDADE 1.5: HISTÓRICO DE ATENDIMENTO - usuário já atendeu esta conversa
  // shared_with_users preserva ex-atendentes após transferência
  // ═══════════════════════════════════════════════════════════════════════════════
  const estaNoHistorico =
    thread.shared_with_users?.includes(usuario.id) ||
    thread.atendentes_historico?.includes(usuario.id) ||
    thread.metadata?.atendentes_anteriores?.includes(usuario.id);

  if (estaNoHistorico) {
    console.log(`[BLOQUEIO] ✅ LIBERADO - Usuário no histórico da conversa: ${usuario.email}`);
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIORIDADE 2: Contato FIDELIZADO ao usuário → NUNCA bloqueia (ignora TUDO)
  // ═══════════════════════════════════════════════════════════════════════════════
  const isFidelizado = contato && isFidelizadoAoUsuario(usuario, contato);
  if (isFidelizado) {
    console.log(`[BLOQUEIO] ✅ LIBERADO - Contato FIDELIZADO ao usuário: ${usuario.email}`);
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIORIDADE 3: Thread NÃO ATRIBUÍDA → verificar permissões de integração/setor
  // ═══════════════════════════════════════════════════════════════════════════════
  const naoAtribuida = isNaoAtribuida(thread);
  if (naoAtribuida) {
    // Verificar permissões básicas antes de permitir
    if (!temPermissaoIntegracao(usuario, thread.whatsapp_integration_id)) {
      console.log(`[BLOQUEIO] ❌ BLOQUEADO - Sem permissão em integração: ${thread.whatsapp_integration_id}`);
      return { bloqueado: true, motivo: 'sem_permissao_integracao', atendenteResponsavel: null };
    }
    if (!threadConexaoVisivel(usuario, thread.conexao_id)) {
      console.log(`[BLOQUEIO] ❌ BLOQUEADO - Sem permissão em conexão: ${thread.conexao_id}`);
      return { bloqueado: true, motivo: 'sem_permissao_conexao', atendenteResponsavel: null };
    }
    if (!threadSetorVisivel(usuario, thread.sector_id || thread.setor)) {
      console.log(`[BLOQUEIO] ❌ BLOQUEADO - Sem permissão em setor: ${thread.sector_id}`);
      return { bloqueado: true, motivo: 'outro_setor', atendenteResponsavel: null };
    }
    
    console.log(`[BLOQUEIO] ✅ LIBERADO - Thread não atribuída, usuário tem permissões`);
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIORIDADE 4: Thread atribuída/fidelizada a OUTRO → BLOQUEADO
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Thread atribuída a outro
  if (thread.assigned_user_id) {
    console.log(`[BLOQUEIO] ❌ BLOQUEADO - Thread atribuída a outro: ${thread.assigned_user_id}`);
    return { 
      bloqueado: true, 
      motivo: 'atribuida_outro', 
      atendenteResponsavel: thread.assigned_user_name || thread.assigned_user_email || 'outro atendente'
    };
  }

  // Contato fidelizado a outro
  if (contato) {
    const camposFidelizacao = [
      'atendente_fidelizado_vendas',
      'atendente_fidelizado_assistencia', 
      'atendente_fidelizado_financeiro',
      'atendente_fidelizado_fornecedor',
      'vendedor_responsavel'
    ];
    
    for (const campo of camposFidelizacao) {
      const valor = contato[campo];
      if (valor && !usuarioCorresponde(usuario, valor)) {
        console.log(`[BLOQUEIO] ❌ BLOQUEADO - Contato fidelizado a outro em ${campo}: ${valor}`);
        return { 
          bloqueado: true, 
          motivo: 'fidelizada_outro', 
          atendenteResponsavel: valor
        };
      }
    }
  }

  console.log(`[BLOQUEIO] ✅ LIBERADO - Passou em todas as prioridades (fallback)`);
  return { bloqueado: false, motivo: null, atendenteResponsavel: null };
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICAR SE PODE INTERAGIR (enviar mensagem) NA THREAD
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Verifica se o usuário pode enviar mensagens nesta thread
 * REGRA SIMPLES:
 * - Admin: sempre pode
 * - Thread ATRIBUÍDA ao usuário: sempre pode (ignora tudo)
 * - Contato FIDELIZADO ao usuário: sempre pode (ignora tudo)
 * - Gerente/Supervisor do SETOR: pode enviar (se não atribuída a outro)
 * - Thread NÃO ATRIBUÍDA: pode (auto-atribui ao enviar)
 * - Outros casos: bloqueado
 */
export const podeInteragirNaThread = (usuario, thread, contato = null) => {
  if (!usuario || !thread) return false;
  
  // ❌ REMOVIDO: Admin bypass
  // ✅ NEXUS360: Admin obedece can_send de whatsapp_permissions
  
  // 🔑 PRIORIDADE ABSOLUTA #1: Thread ATRIBUÍDA ao usuário → SEMPRE PODE (ignora tudo)
  // ✅ FIX: Verifica ANTES de qualquer outra condição
  if (isAtribuidoAoUsuario(usuario, thread)) {
    console.log(`[INTERACAO] ✅ Usuário ${usuario.email} pode enviar (thread ATRIBUÍDO ao criador - ignora permissões)`);
    return true;
  }
  
  // 🔑 PRIORIDADE ABSOLUTA #2: Contato FIDELIZADO ao usuário → SEMPRE PODE
  // Verifica ANTES de integração/setor
  if (contato && isFidelizadoAoUsuario(usuario, contato)) {
    console.log(`[INTERACAO] ✅ Usuário ${usuario.email} pode enviar (contato fidelizado)`);
    return true;
  }
  
  // PRIORIDADE 3: Gerente/Supervisor → pode enviar (se não atribuída a outro)
  const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuario.attendant_role);
  if (isGerente) {
    // Se a thread está atribuída a outro, bloquear (respeitar atribuição)
    if (thread.assigned_user_id && !isAtribuidoAoUsuario(usuario, thread)) {
      return false;
    }
    // Gerente pode enviar (thread não atribuída ou atribuída a ele)
    return true;
  }
  
  // PRIORIDADE 4: Thread NÃO ATRIBUÍDA → pode interagir (auto-atribui)
  if (isNaoAtribuida(thread)) {
    return true;
  }
  
  // Todos outros casos: bloqueado (atribuída/fidelizada a outro)
  return false;
};

export default {
  temPermissaoIntegracao,
  threadConexaoVisivel,
  threadSetorVisivel,
  isAtribuidoAoUsuario,
  isFidelizadoAoUsuario,
  isNaoAtribuida,
  usuarioJaConversouComContato,
  canUserSeeThreadBase,
  canUserSeeThreadWithFilters,
  filtrarAtendentesVisiveis,
  verificarBloqueioThread,
  podeInteragirNaThread
};