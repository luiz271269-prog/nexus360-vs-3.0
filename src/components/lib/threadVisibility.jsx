/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 REGRAS DE VISIBILIDADE DE THREADS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza toda a lógica de quem pode ver qual conversa.
 * 
 * REGRAS:
 * 1. Lista padrão = só o que é do usuário (atribuído + fidelizado + S/atend se permitido)
 * 2. Ver conversas de outros = SOMENTE via filtro, respeitando permissões
 * 3. Busca = liberada para achar qualquer contato/cliente e iniciar conversa nova
 * 
 * DIMENSÕES DE PERMISSÃO:
 * - Integração (Z-API, W-API)
 * - Conexão/Número (2076, 2078, 2079, 2800)
 * - Setor (VENDAS, COMPRAS, FINANCEIRO, MARKETING)
 * - Atendentes visíveis (para filtro)
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
    usuarioCorresponde(usuario, thread.assigned_user_name)
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
  return !thread.assigned_user_id && !thread.assigned_user_name;
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
 * ✅ Conversas não atribuídas onde o usuário JÁ CONVERSOU anteriormente
 * ✅ Conversas não atribuídas (S/atend.) - se pode_ver_nao_atribuidas = true
 * ❌ Conversas atribuídas a outro atendente
 * ❌ Conversas fidelizadas a outro atendente
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
  const podeVerNaoAtribuidas = perms.pode_ver_nao_atribuidas !== false; // default true
  const jaConversou = usuarioJaConversouComContato(usuario, thread, mensagensThread);

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

  // 3) Não atribuída MAS o usuário já conversou com este contato → PRIORIDADE
  if (naoAtribuida && jaConversou) {
    return true;
  }

  // 4) Não atribuída (S/atend.) – se permitido ver não atribuídas
  if (naoAtribuida && podeVerNaoAtribuidas) {
    return true;
  }

  return false;
};

// ═══════════════════════════════════════════════════════════════════════════════
// REGRA COM FILTROS: Ver conversas de outros atendentes
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Aplica filtros da tela (atendente, conexão, integração, escopo)
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

  // Verificar permissões básicas de integração/conexão/setor
  const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id);
  const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
  const setorOk = threadSetorVisivel(usuario, thread.sector_id || thread.setor);

  if (!integracaoOk || !conexaoOk || !setorOk) return false;

  // Filtro por integração selecionada
  if (filtros.integracaoId && filtros.integracaoId !== 'all') {
    if (normalizar(filtros.integracaoId) !== normalizar(thread.whatsapp_integration_id)) {
      return false;
    }
  }

  // Filtro por conexão selecionada
  if (filtros.conexaoId && filtros.conexaoId !== 'all') {
    if (normalizar(filtros.conexaoId) !== normalizar(thread.conexao_id)) {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTRO POR ATENDENTE ESPECÍFICO
  // ═══════════════════════════════════════════════════════════════════════
  if (filtros.atendenteId && filtros.atendenteId !== 'all' && filtros.atendenteId !== usuario.id) {
    const alvoIdNorm = normalizar(filtros.atendenteId);

    // Verificar se pode ver esse atendente
    const atendentesVisiveis = perms.atendentes_visiveis || [];
    const podeVerAtendente = isAdminOrAll || atendentesVisiveis.map(normalizar).includes(alvoIdNorm);

    if (!podeVerAtendente) {
      return false;
    }

    // Mostrar apenas conversas atribuídas ao atendente alvo
    const atribuidaAoAlvo = normalizar(thread.assigned_user_id) === alvoIdNorm;
    return atribuidaAoAlvo;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTRO POR ESCOPO (my, unassigned, all)
  // ═══════════════════════════════════════════════════════════════════════
  if (filtros.scope === 'my') {
    // Apenas minhas conversas
    return isAtribuidoAoUsuario(usuario, thread);
  }

  if (filtros.scope === 'unassigned') {
    // Apenas não atribuídas
    return isNaoAtribuida(thread) && (isAdminOrAll || perms.pode_ver_nao_atribuidas !== false);
  }

  // scope === 'all' ou sem scope → usar regra base
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