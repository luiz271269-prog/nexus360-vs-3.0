/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 REGRAS DE VISIBILIDADE DE THREADS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * REGRAS PRINCIPAIS:
 * 1. Conversas atribuídas ao usuário → VISÍVEL
 * 2. Conversas de contatos fidelizados (se não atribuídas a outro) → VISÍVEL
 * 3. Conversas NÃO ATRIBUÍDAS → SEMPRE VISÍVEIS PARA TODOS
 * 4. Filtro de atendente NÃO afeta conversas não atribuídas
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { usuarioCorresponde, contatoFidelizadoAoUsuario } from './userMatcher';

const normalizar = (v) => (v ? String(v).trim().toLowerCase() : '');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS DE PERMISSÃO
// ═══════════════════════════════════════════════════════════════════════════════

export const temPermissaoIntegracao = (usuario, integracaoId) => {
  if (usuario?.role === 'admin') return true;
  const perms = usuario?.permissoes_visualizacao || {};
  if (!integracaoId || !perms.integracoes_visiveis || perms.integracoes_visiveis.length === 0) return true;
  return perms.integracoes_visiveis.map(normalizar).includes(normalizar(integracaoId));
};

export const threadConexaoVisivel = (usuario, conexaoId) => {
  if (usuario?.role === 'admin') return true;
  const perms = usuario?.permissoes_visualizacao || {};
  if (!conexaoId || !perms.conexoes_visiveis || perms.conexoes_visiveis.length === 0) return true;
  return perms.conexoes_visiveis.map(normalizar).includes(normalizar(conexaoId));
};

export const threadSetorVisivel = (usuario, setorThread) => {
  if (usuario?.role === 'admin') return true;
  const perms = usuario?.permissoes_visualizacao || {};
  if (!setorThread || !perms.setores_visiveis || perms.setores_visiveis.length === 0) return true;
  return perms.setores_visiveis.map(normalizar).includes(normalizar(setorThread));
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS DE RELAÇÃO THREAD X USUÁRIO
// ═══════════════════════════════════════════════════════════════════════════════

export const isAtribuidoAoUsuario = (usuario, thread) => {
  if (!usuario || !thread) return false;
  return (
    usuarioCorresponde(usuario, thread.assigned_user_id) ||
    usuarioCorresponde(usuario, thread.assigned_user_name) ||
    usuarioCorresponde(usuario, thread.assigned_user_email)
  );
};

export const isFidelizadoAoUsuario = (usuario, contato) => {
  if (!contato) return false;
  return contatoFidelizadoAoUsuario(contato, usuario);
};

export const isNaoAtribuida = (thread) => {
  return !thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email;
};

// ═══════════════════════════════════════════════════════════════════════════════
// REGRA BASE: "MINHA CAIXA"
// ═══════════════════════════════════════════════════════════════════════════════
export const canUserSeeThreadBase = (usuario, thread) => {
  if (!usuario || !thread) return false;

  const perms = usuario.permissoes_visualizacao || {};
  const isAdminOrAll = usuario.role === 'admin' || !!perms.pode_ver_todas_conversas;

  const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id);
  const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
  const setorOk = threadSetorVisivel(usuario, thread.sector_id || thread.setor);

  if (!integracaoOk || !conexaoOk || !setorOk) return false;
  if (isAdminOrAll) return true;

  const contato = thread.contato;
  const atribuidaAoUsuario = isAtribuidoAoUsuario(usuario, thread);
  const fidelizado = isFidelizadoAoUsuario(usuario, contato);
  const naoAtribuida = isNaoAtribuida(thread);

  if (atribuidaAoUsuario) return true;
  if (fidelizado && !(thread.assigned_user_id && !atribuidaAoUsuario)) return true;
  if (naoAtribuida) return true;

  return false;
};

// ═══════════════════════════════════════════════════════════════════════════════
// REGRA COM FILTROS
// ═══════════════════════════════════════════════════════════════════════════════
export const canUserSeeThreadWithFilters = (usuario, thread, filtros = {}) => {
  if (!usuario || !thread) return false;

  const perms = usuario.permissoes_visualizacao || {};
  const isAdminOrAll = usuario.role === 'admin' || !!perms.pode_ver_todas_conversas;
  const naoAtribuida = isNaoAtribuida(thread);

  const integracaoOk = temPermissaoIntegracao(usuario, thread.whatsapp_integration_id);
  const conexaoOk = threadConexaoVisivel(usuario, thread.conexao_id);
  const setorOk = threadSetorVisivel(usuario, thread.sector_id || thread.setor);

  if (!integracaoOk || !conexaoOk || !setorOk) return false;

  // Threads NÃO ATRIBUÍDAS sempre passam (exceto filtros de integração/conexão)
  if (naoAtribuida) {
    if (filtros.integracaoId && filtros.integracaoId !== 'all' && normalizar(filtros.integracaoId) !== normalizar(thread.whatsapp_integration_id)) return false;
    if (filtros.conexaoId && filtros.conexaoId !== 'all' && normalizar(filtros.conexaoId) !== normalizar(thread.conexao_id)) return false;
    return true;
  }

  // Aplicar filtros de integração e conexão
  if (filtros.integracaoId && filtros.integracaoId !== 'all' && normalizar(filtros.integracaoId) !== normalizar(thread.whatsapp_integration_id)) return false;
  if (filtros.conexaoId && filtros.conexaoId !== 'all' && normalizar(filtros.conexaoId) !== normalizar(thread.conexao_id)) return false;

  // Filtro por atendente específico
  if (filtros.atendenteId && filtros.atendenteId !== 'all') {
    const alvoIdNorm = normalizar(filtros.atendenteId);
    const podeVerAtendente = isAdminOrAll || (perms.atendentes_visiveis || []).map(normalizar).includes(alvoIdNorm) || normalizar(usuario.id) === alvoIdNorm;
    if (!podeVerAtendente) return false;
    if (normalizar(thread.assigned_user_id) !== alvoIdNorm) return false;
  }

  return canUserSeeThreadBase(usuario, thread);
};

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRAR LISTA DE ATENDENTES
// ═══════════════════════════════════════════════════════════════════════════════
export const filtrarAtendentesVisiveis = (usuario, todosAtendentes) => {
  if (!usuario || !todosAtendentes?.length) return [];
  const isAdmin = usuario.role === 'admin';
  const podeVerTodas = usuario.permissoes_visualizacao?.pode_ver_todas_conversas === true;
  const atendentesVisiveis = usuario.permissoes_visualizacao?.atendentes_visiveis || [];

  if (isAdmin || podeVerTodas) return todosAtendentes;
  if (atendentesVisiveis.length === 0) return [];
  return todosAtendentes.filter(att => atendentesVisiveis.map(normalizar).includes(normalizar(att.id)));
};

export default {
  temPermissaoIntegracao,
  threadConexaoVisivel,
  threadSetorVisivel,
  isAtribuidoAoUsuario,
  isFidelizadoAoUsuario,
  isNaoAtribuida,
  canUserSeeThreadBase,
  canUserSeeThreadWithFilters,
  filtrarAtendentesVisiveis
};