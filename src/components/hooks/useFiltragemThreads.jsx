import React from 'react';
import * as permissionsService from '../lib/permissionsService';
import { podeVerThreadInterna } from '../lib/internalThreadsService';

export function useFiltragemThreads({
  threads,
  contatos,
  clientes,
  atendentes,
  usuario,
  userPermissions,
  selectedAttendantId,
  selectedIntegrationId,
  selectedCategoria,
  selectedTipoContato,
  selectedTagContato,
  debouncedSearchTerm,
  mensagensComCategoria,
  matchBuscaGoogle,
  filterScope,
  duplicataEncontrada,
  effectiveScope,
  threadsNaoAtribuidasVisiveis,
  contatosMap,
  contatosBuscados,
}) {
  return React.useMemo(() => {
    if (!threads) return [];

    const contatosMap_local = contatosMap || new Map(contatos.map((c) => [c.id, c]));
    const isFilterUnassigned = effectiveScope === 'unassigned';
    const isAdmin = usuario?.role === 'admin';
    const temBuscaPorTexto = debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
    const modoBusca = temBuscaPorTexto;

    // Criar Set de categorias
    const categoriasSet = React.useMemo(() => {
      if (!selectedCategoria || selectedCategoria === 'all') return null;
      const set = new Set();
      mensagensComCategoria.forEach((m) => {
        if (m.thread_id) set.add(m.thread_id);
      });
      return set;
    }, [selectedCategoria, mensagensComCategoria]);

    // PARTE 1: Filtrar threads existentes
    const threadsFiltrados = threads.filter((thread) => {
      // ✅ USUÁRIOS INTERNOS - SAGRADOS: Mostrar se usuário participa
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        return podeVerThreadInterna(thread, usuario);
      }

      // ⬇️ Daqui pra baixo: SOMENTE threads EXTERNAS
      const contato = contatosMap_local.get(thread.contact_id);

      if (!contato && thread.contact_id && !isFilterUnassigned) {
        return true; // Fail-Safe
      } else if (!contato && !thread.contact_id && !isFilterUnassigned) {
        return false; // Thread órfã
      }

      // MODO BUSCA: Sem VISIBILITY_MATRIX
      if (modoBusca) {
        if (!contato || !matchBuscaGoogle(contato, debouncedSearchTerm)) {
          return false;
        }

        if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) {
          return false;
        }

        if (selectedTagContato && selectedTagContato !== 'all') {
          const tags = contato.tags || [];
          if (!tags.includes(selectedTagContato)) {
            return false;
          }
        }

        return true;
      }

      // MODO NORMAL: Aplicar regras estritas

      // Filtro "Não Adicionadas"
      if (filterScope === 'nao_adicionado') {
        if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
          return false;
        }
        if (thread.contact_id) {
          return false;
        }
        return true;
      }

      // Filtros sempre aplicados
      if (selectedIntegrationId && selectedIntegrationId !== 'all') {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          const integrationIds = thread.origin_integration_ids?.length > 0
            ? thread.origin_integration_ids
            : [thread.whatsapp_integration_id];

          if (!integrationIds.includes(selectedIntegrationId)) {
            return false;
          }
        }
      }

      if (selectedAttendantId && selectedAttendantId !== 'all') {
        if (thread.assigned_user_id !== selectedAttendantId) {
          return false;
        }
      }

      if (categoriasSet && !(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
        if (!categoriasSet.has(thread.id)) {
          return false;
        }
      }

      if (selectedTipoContato && selectedTipoContato !== 'all' && contato) {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          if (contato.tipo_contato !== selectedTipoContato) {
            return false;
          }
        }
      }

      if (selectedTagContato && selectedTagContato !== 'all' && contato) {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          const tags = contato.tags || [];
          if (!tags.includes(selectedTagContato)) {
            return false;
          }
        }
      }

      // Escopo
      if (isFilterUnassigned) {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          if (!threadsNaoAtribuidasVisiveis.has(thread.id)) {
            return false;
          }
        }
      } else {
        const podeVerBase = permissionsService.canUserSeeThreadBase(userPermissions, thread, contato);
        if (!podeVerBase) {
          return false;
        }
      }

      return true;
    });

    // PARTE 2: COM BUSCA - Adicionar contatos sem thread e clientes sem contato
    if (temBuscaPorTexto) {
      const todosCont = [...contatos, ...contatosBuscados];
      const contatosUnicos = new Map(todosCont.map((c) => [c.id, c]));

      Array.from(contatosUnicos.values()).forEach((contato) => {
        if (!isAdmin) {
          if (contato.bloqueado) return;
        }

        if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return;

        threadsFiltrados.push({
          id: `contato-sem-thread-${contato.id}`,
          contact_id: contato.id,
          is_contact_only: true,
          last_message_at: contato.ultima_interacao || contato.created_date,
          last_message_content: null,
          unread_count: 0,
          status: 'sem_conversa',
        });
      });

      // Clientes sem contato
      clientes.forEach((cliente) => {
        if (!matchBuscaGoogle(cliente, debouncedSearchTerm)) return;

        threadsFiltrados.push({
          id: `cliente-sem-contato-${cliente.id}`,
          cliente_id: cliente.id,
          is_cliente_only: true,
          last_message_at: cliente.ultimo_contato || cliente.created_date,
          last_message_content: null,
          unread_count: 0,
          status: 'sem_conversa',
          contato: {
            id: `cli-${cliente.id}`,
            nome: cliente.razao_social || cliente.nome_fantasia || cliente.contato_principal_nome,
            empresa: cliente.nome_fantasia || cliente.razao_social,
            telefone: cliente.telefone,
            email: cliente.email,
            cargo: cliente.contato_principal_cargo,
            tipo_contato: 'cliente',
            tags: [],
            is_from_cliente: true
          }
        });
      });
    }

    return threadsFiltrados;
  }, [
    threads,
    contatos,
    clientes,
    usuario,
    userPermissions,
    selectedAttendantId,
    selectedIntegrationId,
    selectedCategoria,
    selectedTipoContato,
    selectedTagContato,
    debouncedSearchTerm,
    mensagensComCategoria,
    filterScope,
    effectiveScope,
    threadsNaoAtribuidasVisiveis,
    contatosMap,
    contatosBuscados,
    matchBuscaGoogle,
  ]);
}