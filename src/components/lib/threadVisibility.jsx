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
 */
export const temPermissaoIntegracao = (usuario, integracaoId) => {
  if (!integracaoId) return true;
  if (usuario?.role === 'admin') return true;
  
  // Primeiro checa whatsapp_permissions (estrutura atual)
  const whatsappPerms = usuario?.whatsapp_permissions || [];
  if (whatsappPerms.length > 0) {
    const perm = whatsappPerms.find(p => p.integration_id === integracaoId);
    return perm?.can_view === true;
  }
  
  // Fallback: integracoes_visiveis em permissoes_visualizacao
  const perms = usuario?.permissoes_visualizacao || {};
  const visiveis = perms.integracoes_visiveis;
  if (!visiveis || !visiveis.length) return true; // Sem restrição
  return visiveis.map(normalizar).includes(normalizar(integracaoId));
};

/**
 * Verifica se o usuário tem permissão para a conexão/número específico
 * NOVO: Diferencia 2076/2078/2079/2800
 */
export const threadConexaoVisivel = (usuario, conexaoId) => {
  if (!conexaoId) return true; // Enquanto não migrar, passa
  if (usuario?.role === 'admin') return true;
  
  const perms = usuario?.permissoes_visualizacao || {};
  const visiveis = perms.conexoes_visiveis;
  if (!visiveis || !visiveis.length) return true; // Sem restrição
  return visiveis.map(normalizar).includes(normalizar(conexaoId));
};

/**
 * Verifica se o setor da thread está visível para o usuário
 */
export const threadSetorVisivel = (usuario, setorThread) => {
  if (!setorThread) return true;
  if (usuario?.role === 'admin') return true;
  
  const perms = usuario?.permissoes_visualizacao || {};
  const visiveis = perms.setores_visiveis;
  if (!visiveis || !visiveis.length) return true; // Sem restrição
  return visiveis.map(normalizar).includes(normalizar(setorThread));
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
 */
export const isNaoAtribuida = (thread) => {
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

  // Verificar permissões de integração/conexão/setor
  const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id);
  const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
  const setorOk = threadSetorVisivel(usuario, thread.sector_id || thread.setor);

  if (!integracaoOk || !conexaoOk || !setorOk) return false;

  const contato = thread.contato;
  const atribuido = isAtribuidoAoUsuario(usuario, thread);
  const fidelizado = isFidelizadoAoUsuario(usuario, contato);
  const naoAtribuida = isNaoAtribuida(thread);

  // 0) Admin / "ver todas"
  if (isAdminOrAll) {
    return true;
  }

  // 1) Atribuída ao usuário
  if (atribuido) {
    return true;
  }

  // 2) Fidelizado ao usuário (e não atribuído a outro)
  if (fidelizado) {
    const atribuidaAOutro = thread.assigned_user_id && !atribuido;
    if (!atribuidaAOutro) {
      return true;
    }
  }

  // 3) Não atribuída (S/atend.) - SEMPRE VISÍVEL PARA TODOS OS USUÁRIOS
  // Todos podem ver conversas não atribuídas para poder atendê-las
  if (naoAtribuida) {
    return true;
  }

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
 * @param {string} filtros.scope - 'my' | 'unassigned' | 'all'
 */
export const canUserSeeThreadWithFilters = (usuario, thread, filtros = {}) => {
  if (!usuario || !thread) return false;

  const perms = usuario.permissoes_visualizacao || {};
  const isAdmin = usuario.role === 'admin';
  const isAdminOrAll = isAdmin || !!perms.pode_ver_todas_conversas;

  // ═══════════════════════════════════════════════════════════════════════
  // 🟢 ESTÁGIO 1: BARREIRA DE SEGURANÇA
  // Antes de tudo, verificar se o usuário TEM PERMISSÃO para ver esta thread
  // ═══════════════════════════════════════════════════════════════════════
  
  // 1.1 Filtro de Integração (user.whatsapp_permissions ou permissoes_visualizacao.integracoes_visiveis)
  const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id);
  if (!integracaoOk) return false;

  // 1.2 Filtro de Conexão/Número (user.permissoes_visualizacao.conexoes_visiveis)
  const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
  if (!conexaoOk) return false;

  // 1.3 Filtro de Setor (user.permissoes_visualizacao.setores_visiveis)
  const setorOk = threadSetorVisivel(usuario, thread.sector_id || thread.setor);
  if (!setorOk) return false;

  // ═══════════════════════════════════════════════════════════════════════
  // 🔵 ESTÁGIO 2: FILTRO DE ESCOPO (Abas de Navegação)
  // Aplicar UMA das regras dependendo da aba selecionada
  // ═══════════════════════════════════════════════════════════════════════
  
  const contato = thread.contato;
  const atribuido = isAtribuidoAoUsuario(usuario, thread);
  const fidelizado = isFidelizadoAoUsuario(usuario, contato);
  const naoAtribuida = isNaoAtribuida(thread);

  // A. Aba "Minhas Conversas" (scope = 'my')
  if (filtros.scope === 'my') {
    // Passa se atender PELO MENOS UM critério:
    // 1. Atribuição Direta
    if (atribuido) return true;
    
    // 2. Fidelização (Dono do Cliente) - e não atribuída a outro
    if (fidelizado && !thread.assigned_user_id) return true;
    
    // 3. Contato fidelizado ao usuário (mesmo que thread não atribuída)
    if (fidelizado) {
      const atribuidaAOutro = thread.assigned_user_id && !atribuido;
      if (!atribuidaAOutro) return true;
    }
    
    // Não passou em nenhum critério
    return false;
  }

  // B. Aba "Não Atribuídas" (scope = 'unassigned')
  // NOTA: A lógica de contexto (mostrar todas threads do contato) é feita em Comunicacao.jsx
  if (filtros.scope === 'unassigned') {
    // Thread órfã = sem assigned_user_id e sem assigned_user_email
    return naoAtribuida && (isAdminOrAll || perms.pode_ver_nao_atribuidas !== false);
  }

  // C. Aba "Todas" (scope = 'all') - Admin/Gerentes veem tudo que passou no Estágio 1
  // Para usuários comuns, usar regra base (atribuído + fidelizado + não atribuídas)
  if (filtros.scope === 'all') {
    if (isAdminOrAll) return true;
    return canUserSeeThreadBase(usuario, thread);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🟠 ESTÁGIO 3: FILTROS DE ATRIBUTOS (Refinamento)
  // Aplicar TODOS os filtros selecionados (Lógica AND)
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
  filtrarAtendentesVisiveis
};