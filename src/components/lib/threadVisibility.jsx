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
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { 
  normalizarParaComparacao, 
  usuarioCorresponde, 
  contatoFidelizadoAoUsuario 
} from './userMatcher';

/**
 * Verifica se a thread está atribuída ao usuário
 */
export const isAtribuidoAoUsuario = (usuario, thread) => {
  if (!usuario || !thread) return false;
  
  return (
    usuarioCorresponde(usuario, thread.assigned_user_id) ||
    usuarioCorresponde(usuario, thread.assigned_user_name)
  );
};

/**
 * Verifica se a thread está em um setor visível para o usuário
 */
export const threadSetorVisivel = (usuario, thread) => {
  if (!thread.sector_id) return true; // Sem setor = passa
  
  const setoresVisiveis = usuario?.permissoes_visualizacao?.setores_visiveis || [];
  if (setoresVisiveis.length === 0) return true; // Sem restrição = passa
  
  return setoresVisiveis
    .map(s => normalizarParaComparacao(s))
    .includes(normalizarParaComparacao(thread.sector_id));
};

/**
 * Verifica se o usuário tem permissão para a integração WhatsApp da thread
 */
export const temPermissaoIntegracao = (usuario, thread) => {
  if (!thread.whatsapp_integration_id) return true;
  if (usuario?.role === 'admin') return true;
  
  const whatsappPerms = usuario?.whatsapp_permissions || [];
  if (whatsappPerms.length === 0) return true; // Sem restrição
  
  const perm = whatsappPerms.find(p => p.integration_id === thread.whatsapp_integration_id);
  return perm?.can_view === true;
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REGRA BASE: O que o usuário vê SEM filtro de atendente
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ✅ Conversas atribuídas ao próprio usuário
 * ✅ Conversas de clientes/contatos fidelizados (se não atribuídas a outro)
 * ✅ Conversas não atribuídas (S/atend.) - se pode_ver_nao_atribuidas = true
 * ❌ Conversas atribuídas a outro atendente
 * ❌ Conversas fidelizadas a outro atendente
 */
export const canUserSeeThreadBase = (usuario, thread, contato) => {
  if (!usuario || !thread) return false;
  
  const perms = usuario.permissoes_visualizacao || {};
  const isAdmin = usuario.role === 'admin';
  const podeVerTodas = perms.pode_ver_todas_conversas === true;
  const podeVerNaoAtribuidas = perms.pode_ver_nao_atribuidas !== false; // default true
  
  // Verificar permissão de integração WhatsApp primeiro
  if (!temPermissaoIntegracao(usuario, thread)) {
    return false;
  }
  
  // Verificar setor visível
  const setorVisivel = threadSetorVisivel(usuario, thread);
  
  // 0) Admin ou pode_ver_todas_conversas
  if (isAdmin || podeVerTodas) {
    return setorVisivel;
  }
  
  const isAtribuido = isAtribuidoAoUsuario(usuario, thread);
  const isFidelizado = contato && contatoFidelizadoAoUsuario(contato, usuario);
  const isNaoAtribuida = !thread.assigned_user_id && !thread.assigned_user_name;
  
  // 1) Conversa atribuída ao usuário
  if (isAtribuido) {
    return setorVisivel;
  }
  
  // 2) Contato fidelizado ao usuário (e NÃO atribuído a outro)
  if (isFidelizado) {
    const atribuidaAOutro = thread.assigned_user_id && !isAtribuido;
    if (!atribuidaAOutro && setorVisivel) {
      return true;
    }
  }
  
  // 3) Conversas não atribuídas (S/atend.) - se permitido
  if (isNaoAtribuida && podeVerNaoAtribuidas && setorVisivel) {
    return true;
  }
  
  // 4) Qualquer outra situação: não vê
  return false;
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REGRA COM FILTRO: Ver conversas de outro atendente
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Só funciona se:
 * - Usuário é admin/supervisor OU
 * - Atendente alvo está em permissoes_visualizacao.atendentes_visiveis
 */
export const canUserSeeThreadComFiltro = (usuario, thread, contato, filtros = {}) => {
  if (!usuario || !thread) return false;
  
  const { atendenteId, scope } = filtros;
  
  // Sem filtro de atendente específico → regra base
  if (!atendenteId || atendenteId === usuario.id || atendenteId === 'all') {
    // Mas pode ter filtro de escopo
    if (scope === 'my') {
      // Só minhas conversas
      return isAtribuidoAoUsuario(usuario, thread) && temPermissaoIntegracao(usuario, thread);
    }
    if (scope === 'unassigned') {
      // Só não atribuídas
      const isNaoAtribuida = !thread.assigned_user_id && !thread.assigned_user_name;
      return isNaoAtribuida && canUserSeeThreadBase(usuario, thread, contato);
    }
    // scope === 'all' ou undefined
    return canUserSeeThreadBase(usuario, thread, contato);
  }
  
  // Filtro por atendente específico
  const perms = usuario.permissoes_visualizacao || {};
  const isAdmin = usuario.role === 'admin';
  const podeVerTodas = perms.pode_ver_todas_conversas === true;
  const atendentesVisiveis = perms.atendentes_visiveis || [];
  
  // Verificar se tem permissão para ver esse atendente
  const permitido = isAdmin || podeVerTodas || atendentesVisiveis.includes(atendenteId);
  
  if (!permitido) {
    return false;
  }
  
  // Verificar permissão de integração
  if (!temPermissaoIntegracao(usuario, thread)) {
    return false;
  }
  
  // Mostrar conversas atribuídas ao atendente alvo
  const atribuidaAoAlvo = 
    normalizarParaComparacao(thread.assigned_user_id) === normalizarParaComparacao(atendenteId) ||
    normalizarParaComparacao(thread.assigned_user_name) === normalizarParaComparacao(atendenteId);
  
  if (!atribuidaAoAlvo) return false;
  
  // Respeitar setor visível do usuário atual
  return threadSetorVisivel(usuario, thread);
};

/**
 * Filtra lista de atendentes baseado nas permissões do usuário
 * Usado no filtro "Por Atendente" do SearchAndFilter
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
  return todosAtendentes.filter(att => atendentesVisiveis.includes(att.id));
};

export default {
  isAtribuidoAoUsuario,
  threadSetorVisivel,
  temPermissaoIntegracao,
  canUserSeeThreadBase,
  canUserSeeThreadComFiltro,
  filtrarAtendentesVisiveis
};