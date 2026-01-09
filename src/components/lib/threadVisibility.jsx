/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 REGRAS DE VISIBILIDADE DE THREADS - FUNIL DE 5 ESTÁGIOS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 🟢 ESTÁGIO 1: BARREIRA DE SEGURANÇA (Hardware & Permissões)
 *    - Filtro de Integração (user.whatsapp_permissions)
 *    - Filtro de Setor (user.permissoes_visualizacao.setores_visiveis)
 *    - Filtro de Conexão (user.permissoes_visualizacao.conexoes_visiveis)
 *    - Exceção: Admin/pode_ver_todas_conversas ignora bloqueios
 * 
 * 🔵 ESTÁGIO 2: FILTRO DE ESCOPO (Abas de Navegação)
 *    A. "Minhas Conversas" (my): Atribuição Direta OU Fidelização OU Interação Recente
 *    B. "Não Atribuídas" (unassigned): assigned_user_id === NULL
 *    C. "Todas" (all): Tudo que passou no Estágio 1 (para Gestores)
 * 
 * 🟠 ESTÁGIO 3: FILTROS DE ATRIBUTOS (Refinamento - Lógica AND)
 *    - Conexão específica selecionada
 *    - Tipo de contato (Lead, Cliente, etc.)
 *    - Etiquetas do contato (Tags)
 *    - Etiquetas de mensagem (Categorias)
 * 
 * 🟣 ESTÁGIO 4: BUSCA TEXTUAL (aplicada em Comunicacao.jsx)
 *    - Nome, telefone, empresa
 *    - Injeção de "Clientes sem Contato" se busca não encontrar threads
 * 
 * 🔴 ESTÁGIO 5: DEDUPLICAÇÃO & ORDENAÇÃO (aplicada em Comunicacao.jsx)
 *    - Agrupar por contato (mostrar thread mais recente)
 *    - Ordenar: 1º Não lidas, 2º Data mais recente
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { usuarioCorresponde, contatoFidelizadoAoUsuario } from './userMatcher';

const normalizar = (v) => (v ? String(v).trim().toLowerCase() : '');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS DE PERMISSÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verifica se o usuário tem permissão para a integração WhatsApp
 * CORREÇÃO: Threads sem integracaoId são BLOQUEADAS apenas se houver restrições
 */
export const temPermissaoIntegracao = (usuario, integracaoId) => {
  if (usuario?.role === 'admin') return true;
  
  // Primeiro checa whatsapp_permissions (estrutura atual)
  const whatsappPerms = usuario?.whatsapp_permissions || [];
  if (whatsappPerms.length > 0) {
    // ✅ Thread sem integração = liberar (não bloquear)
    if (!integracaoId) return true;
    const perm = whatsappPerms.find(p => p.integration_id === integracaoId);
    const temPermissao = perm?.can_view === true;
    
    // 🔍 DEBUG: Log quando bloquear por falta de permissão
    if (!temPermissao) {
      console.log(`[VISIBILIDADE] ❌ Bloqueado por integração: User ${usuario.email} não tem can_view para ${integracaoId}`);
    }
    
    return temPermissao;
  }
  
  // Fallback: integracoes_visiveis em permissoes_visualizacao
  const perms = usuario?.permissoes_visualizacao || {};
  const visiveis = perms.integracoes_visiveis;
  
  // ✅ FIX: Sem restrições configuradas = acesso liberado
  if (!visiveis || visiveis.length === 0) return true;
  if (!integracaoId) return true; // Thread sem integração = visível
  
  const temPermissao = visiveis.map(normalizar).includes(normalizar(integracaoId));
  
  // 🔍 DEBUG: Log quando bloquear
  if (!temPermissao) {
    console.log(`[VISIBILIDADE] ❌ Bloqueado por integração: ${integracaoId} não está em integracoes_visiveis`);
  }
  
  return temPermissao;
};

/**
 * Verifica se o usuário tem permissão para a conexão/número específico
 * CORREÇÃO: Threads sem conexaoId são BLOQUEADAS apenas se houver restrições
 */
export const threadConexaoVisivel = (usuario, conexaoId) => {
  if (usuario?.role === 'admin') return true;
  
  const perms = usuario?.permissoes_visualizacao || {};
  const visiveis = perms.conexoes_visiveis;
  
  // ✅ FIX: Sem restrições configuradas = acesso liberado
  if (!visiveis || visiveis.length === 0) return true;
  if (!conexaoId) return true; // Thread sem conexão = visível
  
  return visiveis.map(normalizar).includes(normalizar(conexaoId));
};

/**
 * Verifica se o setor da thread está visível para o usuário
 * CORREÇÃO: Threads sem setor são BLOQUEADAS apenas se houver restrições
 */
// ════════════════════════════════════════════════════════════════════════════
// 🎯 SETOR: Suporta URA (sector_id) e ETIQUETAS (tags do contato)
// ════════════════════════════════════════════════════════════════════════════

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
 */
export const threadSetorVisivel = (usuario, thread) => {
  if (usuario?.role === 'admin') return true;
  
  const perms = usuario?.permissoes_visualizacao || {};
  const setoresUser = perms.setores_visiveis;
  
  // ✅ CORREÇÃO CRÍTICA: Sem configuração = BLOQUEADO (requer explícito)
  if (!setoresUser || setoresUser.length === 0) {
    console.log(`[VISIBILIDADE] ⚠️ Usuário ${usuario?.email} sem setores configurados - bloqueando por segurança`);
    return false;
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
 * Verifica se a thread está atribuída ao usuário (ESTRITO)
 */
export const isAtribuidoAoUsuario = (usuario, thread) => {
  if (!usuario || !thread) return false;
  return (
    usuarioCorresponde(usuario, thread.assigned_user_id) ||
    usuarioCorresponde(usuario, thread.assigned_user_name) ||
    usuarioCorresponde(usuario, thread.assigned_user_email)
  );
};

/**
 * Verifica se o contato está fidelizado ao usuário
 */
export const isFidelizadoAoUsuario = (usuario, contato) => {
  if (!contato) return false;
  return contatoFidelizadoAoUsuario(contato, usuario);
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

  // ✅ REGRA ESPECIAL: Gerentes/Supervisores veem threads sem resposta há 30+ minutos
  const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuario.attendant_role);
  if (isGerente && thread.last_inbound_at) {
    const tempoSemResposta = Date.now() - new Date(thread.last_inbound_at).getTime();
    const minutos30 = 30 * 60 * 1000;
    
    // Se passou 30min sem resposta de atendente, gerente pode ver
    if (tempoSemResposta > minutos30) {
      const ultimaMsgFoiDoContato = thread.last_message_sender === 'contact';
      if (ultimaMsgFoiDoContato) {
        console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - Gerente vê (30min sem resposta)`);
        return true;
      }
    }
  }

  // ✅ THREADS EXTERNAS - lógica existente
  const contato = thread.contato;
  const atribuido = isAtribuidoAoUsuario(usuario, thread);
  const fidelizado = isFidelizadoAoUsuario(usuario, contato);
  const naoAtribuida = isNaoAtribuida(thread);

  // 0) Admin / "ver todas"
  if (isAdminOrAll) {
    return true;
  }

  // ✅ 1) ATRIBUÍDA AO USUÁRIO = SEMPRE VÊ (ignora restrições de integração/conexão)
  if (atribuido) {
    console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - ATRIBUÍDA ao usuário ${usuario.email}`);
    return true;
  }

  // ✅ 2) FIDELIZAÇÃO: Gerentes/Supervisores SEMPRE veem, outros apenas se fidelizados ao usuário
  if (contato?.is_cliente_fidelizado) {
    // Gerentes/Supervisores podem ver TODOS os contatos fidelizados
    if (isGerente) {
      console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - Gerente vê contato fidelizado`);
      return true;
    }
    
    // Outros usuários só veem se fidelizados a eles
    if (fidelizado) {
      console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - FIDELIZADA ao usuário ${usuario.email}`);
      return true;
    } else {
      console.log(`[VISIBILIDADE] ❌ Thread ${thread.id?.substring(0, 8)} bloqueada - Contato fidelizado a outro atendente`);
      return false;
    }
  }

  // ✅ 3) Verificar permissões de integração/conexão/setor APENAS para não-atribuídas
  const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id);
  const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
  const setorOk = threadSetorVisivel(usuario, thread); // ✅ Passa thread inteira (URA + tags)

  if (!integracaoOk || !conexaoOk || !setorOk) {
    console.log(`[VISIBILIDADE] ❌ Thread ${thread.id?.substring(0, 8)} bloqueada - Integração: ${integracaoOk}, Conexão: ${conexaoOk}, Setor: ${setorOk}`);
    return false;
  }

  // 4) Não atribuída (S/atend.) - SEMPRE VISÍVEL PARA TODOS OS USUÁRIOS
  if (naoAtribuida) {
    console.log(`[VISIBILIDADE] ✅ Thread ${thread.id?.substring(0, 8)} - NÃO ATRIBUÍDA (S/atend.) - visível para todos`);
    return true;
  }

  console.log(`[VISIBILIDADE] ❌ Thread ${thread.id?.substring(0, 8)} bloqueada - Atribuída a outro ou sem match`);
  return false;
};

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

  // ✅ PRIORIDADE MÁXIMA: Se está atribuída ao usuário, SEMPRE VÊ (ignora todas as restrições)
  if (atribuido) {
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🟢 ESTÁGIO 1: BARREIRA DE SEGURANÇA (apenas para não-atribuídas)
  // ═══════════════════════════════════════════════════════════════════════
  
  const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id);
  if (!integracaoOk) return false;

  const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
  if (!conexaoOk) return false;

  const setorOk = threadSetorVisivel(usuario, thread.sector_id || thread.setor);
  if (!setorOk) return false;

  // ═══════════════════════════════════════════════════════════════════════
  // 🔵 ESTÁGIO 2: FILTRO DE ESCOPO (Abas de Navegação)
  // ═══════════════════════════════════════════════════════════════════════
  
  const fidelizado = isFidelizadoAoUsuario(usuario, contato);
  const naoAtribuida = isNaoAtribuida(thread);

  // A. Aba "Minhas Conversas" (scope = 'my')
  if (filtros.scope === 'my') {
    // Atribuição já foi checada no topo (priority check)
    
    // Fidelização (Dono do Cliente) - e não atribuída a outro
    if (fidelizado && !thread.assigned_user_id) return true;
    
    // Contato fidelizado ao usuário (mesmo que thread não atribuída)
    if (fidelizado) {
      const atribuidaAOutro = thread.assigned_user_id;
      if (!atribuidaAOutro) return true;
    }
    
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

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICAR MOTIVO DE BLOQUEIO DE UMA THREAD
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Retorna o motivo pelo qual o usuário não pode acessar a thread
 * @returns {Object} { bloqueado: boolean, motivo: string, atendenteResponsavel: string|null }
 */
export const verificarBloqueioThread = (usuario, thread, contato = null) => {
  if (!usuario || !thread) {
    return { bloqueado: true, motivo: 'dados_invalidos', atendenteResponsavel: null };
  }

  const perms = usuario.permissoes_visualizacao || {};
  const isAdmin = usuario.role === 'admin';
  const isAdminOrAll = isAdmin || !!perms.pode_ver_todas_conversas;

  // ✅ THREADS INTERNAS - visibilidade baseada em participação apenas
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    const isParticipant = thread.participants?.includes(usuario.id);
    if (isParticipant || isAdminOrAll) {
      return { bloqueado: false, motivo: null, atendenteResponsavel: null };
    }
    return { bloqueado: true, motivo: 'nao_participante', atendenteResponsavel: null };
  }

  // Admin pode tudo (apenas threads externas a partir daqui)
  if (isAdminOrAll) {
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // 1. Verificar permissão de integração
  if (!temPermissaoIntegracao(usuario, thread.whatsapp_integration_id)) {
    return { bloqueado: true, motivo: 'sem_permissao_integracao', atendenteResponsavel: null };
  }

  // 2. Verificar permissão de conexão
  if (!threadConexaoVisivel(usuario, thread.conexao_id)) {
    return { bloqueado: true, motivo: 'sem_permissao_conexao', atendenteResponsavel: null };
  }

  // 3. Verificar permissão de setor
  if (!threadSetorVisivel(usuario, thread.sector_id || thread.setor)) {
    return { bloqueado: true, motivo: 'outro_setor', atendenteResponsavel: null };
  }

  // 4. Verificar se está atribuída ao usuário
  if (isAtribuidoAoUsuario(usuario, thread)) {
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // 5. Verificar se contato está fidelizado ao usuário
  if (contato && isFidelizadoAoUsuario(usuario, contato)) {
    // Fidelizado ao usuário, mas verificar se não está atribuída a outro
    if (!thread.assigned_user_id) {
      return { bloqueado: false, motivo: null, atendenteResponsavel: null };
    }
  }

  // 6. Se não está atribuída (S/atend.) - TODOS podem ver
  if (isNaoAtribuida(thread)) {
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // 7. Está atribuída a outro - BLOQUEADO
  if (thread.assigned_user_id) {
    return { 
      bloqueado: true, 
      motivo: 'atribuida_outro', 
      atendenteResponsavel: thread.assigned_user_name || thread.assigned_user_email || 'outro atendente'
    };
  }

  // 8. Contato fidelizado a outro
  if (contato) {
    const camposFidelizacao = [
      'atendente_fidelizado_vendas',
      'atendente_fidelizado_assistencia', 
      'atendente_fidelizado_financeiro',
      'atendente_fidelizado_fornecedor'
    ];
    
    for (const campo of camposFidelizacao) {
      if (contato[campo] && !usuarioCorresponde(usuario, contato[campo])) {
        return { 
          bloqueado: true, 
          motivo: 'fidelizada_outro', 
          atendenteResponsavel: contato[campo]
        };
      }
    }
  }

  return { bloqueado: false, motivo: null, atendenteResponsavel: null };
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICAR SE PODE INTERAGIR (enviar mensagem) NA THREAD
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Verifica se o usuário pode enviar mensagens nesta thread
 * Regras:
 * - Admin: sempre pode
 * - Atribuída ao usuário: pode
 * - Fidelizada ao usuário: pode
 * - Não atribuída (S/atend.): pode (e auto-atribui ao responder)
 * - Atribuída/fidelizada a outro: NÃO pode
 */
export const podeInteragirNaThread = (usuario, thread, contato = null) => {
  const resultado = verificarBloqueioThread(usuario, thread, contato);
  return !resultado.bloqueado;
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