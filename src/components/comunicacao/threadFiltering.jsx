// Lógica de filtragem de threads extraída
import * as permissionsService from "../lib/permissionsService";

export function aplicarFiltroEscopo(thread, usuario, filtros, userPermissions, DEBUG_VIS = false) {
  if (!filtros.scope || filtros.scope === 'all') {
    return true; // Sem filtro de escopo
  }
  if (usuario?.role === 'admin') {
    return true;
  }

  // ✅ NOVO: Verificar participação em participants[] (Opção A)
  const participaComoParticipante = thread.participants?.includes(usuario?.id);
  
  if (filtros.scope === 'my' && participaComoParticipante) {
    if (DEBUG_VIS) {
      console.log('[FILTER] ✅ Thread passou: usuário está em participants[]');
    }
    return true;
  }

  // ✅ Também verificar se é o assigned_user (mesmo sem estar em participants[])
  if (filtros.scope === 'my' && thread.assigned_user_id === usuario?.id) {
    if (DEBUG_VIS) {
      console.log('[FILTER] ✅ Thread passou: usuário é o assigned_user_id');
    }
    return true;
  }

  // ✅ Verificar delegacao: se assigned_user_id é alguem que delegou para mim
  if (filtros.scope === 'my') {
    const delegadores = userPermissions?.delegadoresPorMim || [];
    if (delegadores.length > 0 && thread.assigned_user_id && delegadores.includes(thread.assigned_user_id)) {
      if (DEBUG_VIS) console.log('[FILTER] ✅ Thread passou: delegacao ativa do usuario', thread.assigned_user_id);
      return true;
    }
  }

  // ✅ Verificar histórico (atendentes_historico, shared_with_users)
  if (filtros.scope === 'my') {
    const uid = usuario?.id;
    const estaNoHistorico =
      thread.shared_with_users?.includes(uid) ||
      thread.atendentes_historico?.includes(uid);
    if (estaNoHistorico) {
      if (DEBUG_VIS) console.log('[FILTER] ✅ Thread passou: usuário está no histórico');
      return true;
    }
  }

  // Aplicar filtro tradicional de escopo
  const escopoConfig = {
    id: filtros.scope,
    regra: filtros.scope === 'my' ? 'atribuido_ou_fidelizado' : 'sem_assigned_user_id'
  };

  const threadsComEscopo = permissionsService.aplicarFiltroEscopo(
    [thread],
    escopoConfig,
    userPermissions
  );

  return threadsComEscopo.length > 0;
}

export function calcularThreadsFiltradas({ threads, contatos, clientes, atendentes, usuario, userPermissions, selectedAttendantId, selectedIntegrationId, selectedCategoria, selectedTipoContato, selectedTagContato, debouncedSearchTerm, mensagensComCategoria, matchBuscaGoogle, filterScope, duplicataEncontrada, effectiveScope, threadsNaoAtribuidasVisiveis, contatosMap, contatosBuscados, DEBUG_VIS = false }) {
  if (!usuario || !userPermissions) return [];
  const categoriasSet = selectedCategoria !== 'all' ? new Set((mensagensComCategoria || []).map((m) => m.thread_id)) : null;
  const temBuscaPorTexto = !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
  const threadsComContatoIds = new Set();
  const isAdmin = usuario?.role === 'admin';
  const isFilterUnassigned = effectiveScope === 'unassigned';
  const threadMaisRecentePorContacto = new Map();
  threads.forEach((thread) => {
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') { threadMaisRecentePorContacto.set('internal-' + thread.id, thread); return; }
    if (temBuscaPorTexto) { threadMaisRecentePorContacto.set('search-all-' + thread.id, thread); return; }
    const contactId = thread.contact_id;
    if (!contactId) { if (isAdmin) threadMaisRecentePorContacto.set('orphan-' + thread.id, thread); return; }
    const existente = threadMaisRecentePorContacto.get(contactId);
    if (!existente) { threadMaisRecentePorContacto.set(contactId, thread); } else {
      const tsE = new Date(existente.last_message_at || 0).getTime();
      const tsA = new Date(thread.last_message_at || 0).getTime();
      if (tsA > tsE) threadMaisRecentePorContacto.set(contactId, thread);
    }
  });
  const threadsUnicas = Array.from(threadMaisRecentePorContacto.values());
  const contatosComThreadExistente = new Set(threadsUnicas.map((t) => t.contact_id).filter(Boolean));
  const filtros = { atendenteId: selectedAttendantId, integracaoId: selectedIntegrationId, scope: filterScope };
  const threadsFiltrados = threadsUnicas.filter((thread) => {
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      if (isAdmin) return true; // Admin vê todas as threads internas
      const parts = thread.participants || [];
      return parts.includes(usuario.id);
    }
    const contato = contatosMap.get(thread.contact_id);
    if (thread.contact_id) threadsComContatoIds.add(thread.contact_id);
    if (temBuscaPorTexto) {
      if (!contato || !matchBuscaGoogle(contato, debouncedSearchTerm)) return false;
      if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) return false;
      if (selectedTagContato && selectedTagContato !== 'all') { const tags = contato.tags || []; if (!tags.includes(selectedTagContato)) return false; }
      return true;
    }
    if (filterScope === 'nao_adicionado') { if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') return false; if (thread.contact_id) return false; return true; }
    if (selectedIntegrationId && selectedIntegrationId !== 'all') {
      const integIds = thread.origin_integration_ids?.length > 0 ? thread.origin_integration_ids : [thread.whatsapp_integration_id];
      if (!integIds.includes(selectedIntegrationId)) return false;
    }
    if (selectedAttendantId && selectedAttendantId !== 'all' && thread.assigned_user_id !== selectedAttendantId) return false;
    if (categoriasSet && !categoriasSet.has(thread.id)) return false;
    if (selectedTipoContato && selectedTipoContato !== 'all' && contato && contato.tipo_contato !== selectedTipoContato) return false;
    if (selectedTagContato && selectedTagContato !== 'all' && contato) { const tags = contato.tags || []; if (!tags.includes(selectedTagContato)) return false; }
    if (isFilterUnassigned) { if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) { if (!threadsNaoAtribuidasVisiveis.has(thread.id)) return false; } return true; }
    if (isAdmin) return true;
    const podeVerBase = permissionsService.canUserSeeThreadBase(userPermissions, thread, contato);
    if (!podeVerBase) return false;
    const passouEscopo = aplicarFiltroEscopo(thread, usuario, filtros, userPermissions, DEBUG_VIS);
    if (!passouEscopo) return false;
    return true;
  });
  if (temBuscaPorTexto) {
    const todosCont = [...(contatos || []), ...(contatosBuscados || [])];
    const contatosUnicos = new Map(todosCont.map((c) => [c.id, c]));
    contatosUnicos.forEach((contato, contactId) => {
      if (contatosComThreadExistente.has(contactId)) return;
      if (threadsComContatoIds.has(contactId)) return;
      if (contato.bloqueado) return;
      if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return;
      threadsFiltrados.push({ id: 'contato-sem-thread-' + contactId, contact_id: contactId, is_contact_only: true, last_message_at: contato.ultima_interacao || contato.created_date, last_message_content: null, unread_count: 0, status: 'sem_conversa' });
    });
    (clientes || []).forEach((cliente) => {
      if (!matchBuscaGoogle(cliente, debouncedSearchTerm)) return;
      const telCliente = (cliente.telefone || '').replace(/\D/g, '');
      if (telCliente) { const jaTemContato = (contatos || []).some((c) => { const tel = (c.telefone || '').replace(/\D/g, ''); return tel && tel === telCliente; }); if (jaTemContato) return; }
      threadsFiltrados.push({ id: 'cliente-sem-contato-' + cliente.id, cliente_id: cliente.id, is_cliente_only: true, last_message_at: cliente.ultimo_contato || cliente.created_date, last_message_content: null, unread_count: 0, status: 'sem_conversa' });
    });
  }
  return threadsFiltrados;
}

export function calcularListaRecentes({ threadsFiltradas, contatos, atendentes, getUserDisplayName }) {
  const contatosMapLocal = new Map((contatos || []).map((c) => [c.id, c]));
  const usuariosMap = new Map((atendentes || []).map((a) => [a.id, a]));
  const enriched = (threadsFiltradas || []).map((thread) => {
    const usuarioAtribuido = usuariosMap.get(thread.assigned_user_id);
    const contatoObj = thread.contato || contatosMapLocal.get(thread.contact_id);
    const meta = contatoObj?._meta || {};
    return { ...thread, contato: contatoObj, atendente_atribuido: usuarioAtribuido, assigned_user_display_name: usuarioAtribuido ? (getUserDisplayName ? getUserDisplayName(usuarioAtribuido.id, atendentes) : usuarioAtribuido.full_name) : null, uiMeta: { temDadosBasicos: meta.tem_dados_basicos ?? false, scoreCompletude: meta.score_completude ?? 0 } };
  });
  const gerarChave = (contato) => {
    if (!contato) return null;
    const tel = (contato.telefone || '').replace(/\D/g, '');
    const nome = (contato.nome || '').trim().toLowerCase();
    const empresa = (contato.empresa || '').trim().toLowerCase();
    return tel + '|' + nome + '|' + empresa;
  };
  const dedupMap = new Map();
  enriched.forEach((thread) => {
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') { dedupMap.set('internal-' + thread.id, thread); return; }
    const chave = gerarChave(thread.contato);
    if (!chave) { dedupMap.set('orphan-' + thread.id, thread); return; }
    const existente = dedupMap.get(chave);
    if (!existente) { dedupMap.set(chave, thread); } else {
      const tsE = new Date(existente.last_message_at || 0).getTime();
      const tsA = new Date(thread.last_message_at || 0).getTime();
      if (tsA > tsE) dedupMap.set(chave, thread);
    }
  });
  return Array.from(dedupMap.values()).sort((a, b) => {
    const prio = (i) => i.is_cliente_only ? 3 : i.is_contact_only ? 2 : 1;
    if (prio(a) !== prio(b)) return prio(a) - prio(b);
    return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
  });
}

export function calcularListaBusca({ contatos, contatosBuscados, threads, atendentes, debouncedSearchTerm, selectedTipoContato, selectedTagContato, matchBuscaGoogle, calcularScoreBusca, getUserDisplayName }) {
  if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) return [];
  const contatosMapLocal = new Map([...(contatos || []), ...(contatosBuscados || [])].map((c) => [c.id, c]));
  const usuariosMap = new Map((atendentes || []).map((a) => [a.id, a]));
  const resultados = [];
  const processados = new Set();
  contatosMapLocal.forEach((contato, contactId) => {
    if (processados.has(contactId)) return;
    if (contato.bloqueado) return;
    if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return;
    if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) return;
    if (selectedTagContato && selectedTagContato !== 'all') { const tags = contato.tags || []; if (!tags.includes(selectedTagContato)) return; }
    const threadsDoContato = (threads || []).filter((t) => t.contact_id === contactId);
    const meta = contato._meta || {};
    let item;
    if (threadsDoContato.length > 0) {
      const threadRecente = threadsDoContato.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0))[0];
      const ua = usuariosMap.get(threadRecente.assigned_user_id);
      item = { ...threadRecente, contato, atendente_atribuido: ua, assigned_user_display_name: ua ? (getUserDisplayName ? getUserDisplayName(ua.id, atendentes) : ua.full_name) : null, _searchScore: calcularScoreBusca ? calcularScoreBusca(contato, debouncedSearchTerm) : 0, uiMeta: { temDadosBasicos: meta.tem_dados_basicos ?? false, scoreCompletude: meta.score_completude ?? 0 } };
    } else {
      item = { id: 'contato-sem-thread-' + contactId, contact_id: contactId, is_contact_only: true, contato, last_message_at: contato.ultima_interacao || contato.created_date, last_message_content: null, unread_count: 0, status: 'sem_conversa', _searchScore: calcularScoreBusca ? calcularScoreBusca(contato, debouncedSearchTerm) : 0, uiMeta: { temDadosBasicos: meta.tem_dados_basicos ?? false, scoreCompletude: meta.score_completude ?? 0 } };
    }
    resultados.push(item);
    processados.add(contactId);
  });
  return resultados.sort((a, b) => {
    const sA = (a._searchScore || 0) * 0.6 + (a.uiMeta?.scoreCompletude || 0) * 0.3 + (new Date(a.last_message_at || 0).getTime() / 1e12) * 0.1;
    const sB = (b._searchScore || 0) * 0.6 + (b.uiMeta?.scoreCompletude || 0) * 0.3 + (new Date(b.last_message_at || 0).getTime() / 1e12) * 0.1;
    return sB - sA;
  });
}