import React from 'react';
import * as permissionsService from '../lib/permissionsService';
import { aplicarFiltroEscopo } from '../comunicacao/threadFiltering';
import { normalizarTelefone } from '../lib/phoneUtils';

/**
 * Hook para filtragem de threads com otimização de dependências
 * Reduz de 21 dependências para ~6
 * 
 * @param {Array} threads - Threads para filtrar
 * @param {Array} contatos - Contatos hidratados
 * @param {Array} clientes - Clientes
 * @param {Array} atendentes - Lista de atendentes
 * @param {Object} usuario - Usuário atual
 * @param {Object} userPermissions - Permissões do usuário
 * @param {Object} filtros - { scope, atendenteId, integracaoId, tipoContato, tagContato, categoriaSelecionada }
 * @param {String} debouncedSearchTerm - Termo de busca debounced
 * @param {Array} mensagensComCategoria - Mensagens filtradas por categoria
 * @param {Array} contatosBuscados - Contatos encontrados na busca
 * @param {Function} matchBuscaGoogle - Função para match de busca
 * @param {Function} calcularScoreBusca - Função para calcular score
 * @param {Boolean} DEBUG_VIS - Flag de debug
 * @returns {Array} Threads filtradas
 */
export function useFiltragemThreads(
  threads,
  contatos,
  clientes,
  atendentes,
  usuario,
  userPermissions,
  filtros,
  debouncedSearchTerm,
  mensagensComCategoria,
  contatosBuscados,
  matchBuscaGoogle,
  calcularScoreBusca,
  DEBUG_VIS = false
) {
  const contatosMap = React.useMemo(() => {
    return new Map(contatos.map((c) => [c.id, c]));
  }, [contatos]);

  const temBuscaPorTexto = !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
  const threadsAProcessar = threads;
  const isAdmin = usuario?.role === 'admin';

  const threadsFiltrados = React.useMemo(() => {
    if (!usuario || !userPermissions) return [];

    const categoriasSet = filtros.categoriaSelecionada && filtros.categoriaSelecionada !== 'all' 
      ? new Set(mensagensComCategoria.map((m) => m.thread_id)) 
      : null;

    const threadsComContatoIds = new Set();
    const threadMaisRecentePorContacto = new Map();

    threadsAProcessar.forEach((thread) => {
      // ✅ Usuários internos: NUNCA deduplicam
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        threadMaisRecentePorContacto.set(`internal-${thread.id}`, thread);
        return;
      }

      // COM BUSCA: Mostrar TODAS
      if (temBuscaPorTexto) {
        threadMaisRecentePorContacto.set(`search-all-${thread.id}`, thread);
        return;
      }

      // SEM BUSCA: Deduplicar por contact_id
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

    const modoBusca = temBuscaPorTexto;
    const filtrosObj = {
      atendenteId: filtros.atendenteId,
      integracaoId: filtros.integracaoId,
      scope: filtros.scope
    };

    const threadsFiltrados = threadsUnicas.filter((thread) => {
      // ✅ USUÁRIOS INTERNOS
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        const podeVerInterno = thread.participants?.includes(usuario?.id) || usuario?.role === 'admin';
        return podeVerInterno;
      }

      const contato = contatosMap.get(thread.contact_id);

      if (!contato && thread.contact_id && filtros.scope !== 'unassigned') {
        // Fail-safe: deixa passar enquanto carregando
        return true;
      } else if (!contato && !thread.contact_id && filtros.scope !== 'unassigned') {
        return false;
      }

      const threadComContato = { ...thread, contato };

      // ✅ MODO BUSCA: relaxar filtros
      if (modoBusca) {
        if (!contato || !matchBuscaGoogle(contato, debouncedSearchTerm)) {
          return false;
        }

        if (filtros.tipoContato && filtros.tipoContato !== 'all' && contato.tipo_contato !== filtros.tipoContato) {
          return false;
        }

        if (filtros.tagContato && filtros.tagContato !== 'all') {
          const tags = contato.tags || [];
          if (!tags.includes(filtros.tagContato)) {
            return false;
          }
        }

        return true;
      }

      // ✅ MODO NORMAL: aplicar regras estritas

      // Filtro de INTEGRAÇÃO
      if (filtros.integracaoId && filtros.integracaoId !== 'all') {
        const integrationIds = thread.origin_integration_ids?.length > 0 
          ? thread.origin_integration_ids 
          : [thread.whatsapp_integration_id];
        if (!integrationIds.includes(filtros.integracaoId)) {
          return false;
        }
      }

      // Filtro de ATENDENTE
      if (filtros.atendenteId && filtros.atendenteId !== 'all') {
        if (thread.assigned_user_id !== filtros.atendenteId) {
          return false;
        }
      }

      // Filtro de CATEGORIA
      if (categoriasSet && !(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
        if (!categoriasSet.has(thread.id)) {
          return false;
        }
      }

      // Filtro de TIPO DE CONTATO
      if (filtros.tipoContato && filtros.tipoContato !== 'all' && contato) {
        if (contato.tipo_contato !== filtros.tipoContato) {
          return false;
        }
      }

      // Filtro de TAG
      if (filtros.tagContato && filtros.tagContato !== 'all' && contato) {
        const tags = contato.tags || [];
        if (!tags.includes(filtros.tagContato)) {
          return false;
        }
      }

      // ✅ APLICAR VISIBILIDADE BASE
      const podeVerBase = permissionsService.canUserSeeThreadBase(userPermissions, thread, contato);
      if (!podeVerBase) {
        return false;
      }

      // ✅ APLICAR FILTRO ESCOPO
      const passouEscopo = aplicarFiltroEscopo(thread, usuario, filtrosObj, userPermissions, DEBUG_VIS);
      if (!passouEscopo) {
        return false;
      }

      if (thread.contact_id) {
        threadsComContatoIds.add(thread.contact_id);
      }

      return true;
    });

    // ✅ PARTE 2: Adicionar contatos sem thread + clientes sem contato (modo busca)
    if (temBuscaPorTexto) {
      const telefonesJaAcionados = new Set();
      const todosCont = [...contatos, ...contatosBuscados];
      const contatosUnicos = new Map(todosCont.map((c) => [c.id, c]));

      Array.from(contatosUnicos.values()).forEach((contato) => {
        if (contato.telefone && !temBuscaPorTexto) {
          const telNorm = normalizarTelefone(contato.telefone);
          if (telNorm && telefonesJaAcionados.has(telNorm)) {
            return;
          }
          if (telNorm) {
            telefonesJaAcionados.add(telNorm);
          }
        }

        if (!isAdmin) {
          if (threadsComContatoIds.has(contato.id)) return;
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
          status: 'sem_conversa'
        });
      });

      // Clientes sem contato
      clientes.forEach((cliente) => {
        if (!matchBuscaGoogle(cliente, debouncedSearchTerm)) return;

        const telefoneCliente = (cliente.telefone || '').replace(/\D/g, '');
        if (telefoneCliente) {
          const jaTemContato = contatos.some((c) => {
            const tel = (c.telefone || '').replace(/\D/g, '');
            return tel && tel === telefoneCliente;
          });
          if (jaTemContato) return;
        }

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
    filtros,
    debouncedSearchTerm,
    mensagensComCategoria,
    contatosBuscados,
    matchBuscaGoogle,
    contatosMap
  ]);

  return threadsFiltrados;
}