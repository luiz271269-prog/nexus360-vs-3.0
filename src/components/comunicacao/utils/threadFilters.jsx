/**
 * ✅ FILTROS DE THREADS - Lógica extraída para módulo separado
 * Aplicação das regras de visibilidade Nexus360
 */

import * as permissionsService from "../../lib/permissionsService";
import { podeVerThreadInterna } from "../../lib/internalThreadsService";

const DEBUG_VIS = false;

/**
 * Filtrar threads aplicando regras de visibilidade
 */
export function filtrarThreadsComVisibilidade({
  threads,
  contatosMap,
  usuario,
  userPermissions,
  effectiveScope,
  threadsNaoAtribuidasVisiveis,
  selectedAttendantId,
  selectedIntegrationId,
  selectedCategoria,
  selectedTipoContato,
  selectedTagContato,
  debouncedSearchTerm,
  categoriasSet,
  matchBuscaGoogle,
  isAdmin,
  atendentes
}) {
  if (!usuario || !userPermissions) return [];

  const temBuscaPorTexto = !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
  const threadsComContatoIds = new Set();
  const isFilterUnassigned = effectiveScope === 'unassigned';
  
  // 🆕 DEDUPLICAÇÃO CONDICIONAL: 
  // - COM BUSCA: NÃO deduplicar (mostrar TODAS as threads do mesmo contato)
  // - SEM BUSCA: Deduplicar normalmente (1 thread por contato)
  const threadMaisRecentePorContacto = new Map();

  threads.forEach((thread) => {
    // ✅ Usuários internos: NUNCA deduplicam (USUARIOS ≠ CONTATOS)
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      threadMaisRecentePorContacto.set(`internal-${thread.id}`, thread);
      return;
    }

    // 🆕 COM BUSCA ATIVA: Mostrar TODAS as threads (sem deduplicar)
    if (temBuscaPorTexto) {
      threadMaisRecentePorContacto.set(`search-all-${thread.id}`, thread);
      return;
    }

    // ✅ SEM BUSCA: Deduplicar por contact_id (comportamento normal)
    const contactId = thread.contact_id;
    if (!contactId) {
      if (isAdmin) {
        threadMaisRecentePorContacto.set(`orphan-${thread.id}`, thread);
      }
      return;
    }

    const existente = threadMaisRecentePorContacto.get(contactId);
    if (!existente) {
      threadMaisRecentePorContacto.set(contactId, thread);
    } else {
      const tsExistente = new Date(existente.last_message_at || existente.updated_date || existente.created_date || 0).getTime();
      const tsAtual = new Date(thread.last_message_at || thread.updated_date || thread.created_date || 0).getTime();

      if (tsAtual > tsExistente) {
        threadMaisRecentePorContacto.set(contactId, thread);
      }
    }
  });

  const threadsUnicas = Array.from(threadMaisRecentePorContacto.values());

  // Filtrar threads aplicando regras
  const threadsFiltrados = threadsUnicas.filter((thread) => {
    // ═══════════════════════════════════════════════════════════════════════════
    // ✅ USUÁRIOS INTERNOS - SAGRADOS: Mostrar se usuário participa
    // ═════════════════════════════════════════════════════════════════════════════
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      const visInterna = podeVerThreadInterna(thread, usuario);
      if (DEBUG_VIS) {
        console.log(`[FILTRO] Thread interna ${thread.id}: ${visInterna ? '✅ VISÍVEL' : '❌ BLOQUEADA'}`);
      }
      return visInterna;
    }

    // ⬇️ Daqui pra baixo: SOMENTE threads EXTERNAS (contact_external)
    const contato = contatosMap.get(thread.contact_id);

    if (!contato && thread.contact_id && !isFilterUnassigned) {
      // Fail-Safe: Thread aguardando hidratação
      return true;
    } else if (!contato && !thread.contact_id && !isFilterUnassigned) {
      // Thread órfã sem contact_id
      return false;
    }

    if (thread.contact_id) {
      threadsComContatoIds.add(thread.contact_id);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO BUSCA: Sem VISIBILITY_MATRIX — mostrar tudo que o banco retornou
    // ═══════════════════════════════════════════════════════════════════════
    if (temBuscaPorTexto) {
      if (!contato || !matchBuscaGoogle(contato, debouncedSearchTerm)) return false;
      if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) return false;
      if (selectedTagContato && selectedTagContato !== 'all') {
        const tags = contato.tags || [];
        if (!tags.includes(selectedTagContato)) return false;
      }
      return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO NORMAL (sem busca): Aplicar regras estritas de visibilidade
    // ═══════════════════════════════════════════════════════════════════════

    // ✅ CRÍTICO: Filtros SEMPRE aplicados
    if (selectedIntegrationId && selectedIntegrationId !== 'all') {
      const integrationIds = thread.origin_integration_ids?.length > 0 
        ? thread.origin_integration_ids 
        : [thread.whatsapp_integration_id];

      if (!integrationIds.includes(selectedIntegrationId)) return false;
    }

    if (selectedAttendantId && selectedAttendantId !== 'all') {
      if (thread.assigned_user_id !== selectedAttendantId) return false;
    }

    if (categoriasSet) {
      if (!categoriasSet.has(thread.id)) return false;
    }

    if (selectedTipoContato && selectedTipoContato !== 'all' && contato) {
      if (contato.tipo_contato !== selectedTipoContato) return false;
    }

    if (selectedTagContato && selectedTagContato !== 'all' && contato) {
      const tags = contato.tags || [];
      if (!tags.includes(selectedTagContato)) return false;
    }

    // ✅ Filtro "Não Adicionadas" (contact_id === NULL)
    if (effectiveScope === 'nao_adicionado') {
      if (!thread.contact_id) return true;
      return false;
    }

    if (isFilterUnassigned) {
      if (!threadsNaoAtribuidasVisiveis.has(thread.id)) return false;
    } else {
      const podeVerBase = permissionsService.canUserSeeThreadBase(userPermissions, thread, contato);
      if (!podeVerBase) return false;

      // Aplicar filtro de escopo
      if (effectiveScope && effectiveScope !== 'all') {
        const escopoConfig = { 
          id: effectiveScope, 
          regra: effectiveScope === 'my' ? 'atribuido_ou_fidelizado' : 'sem_assigned_user_id' 
        };
        const threadsComEscopo = permissionsService.aplicarFiltroEscopo([thread], escopoConfig, userPermissions);
        if (threadsComEscopo.length === 0) return false;
      }
    }

    return true;
  });

  return { threadsFiltrados, threadsComContatoIds };
}