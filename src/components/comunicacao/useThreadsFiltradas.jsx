/**
 * ═══════════════════════════════════════════════════════════════════════
 * useThreadsFiltradas — Hook extraído de pages/Comunicacao.jsx
 * ═══════════════════════════════════════════════════════════════════════
 * Responsável por toda a lógica de filtragem, deduplicação e ordenação
 * de threads para exibição no ChatSidebar.
 * 
 * Extração necessária pois Comunicacao.jsx atingiu 2662 linhas (limite 2000)
 * ═══════════════════════════════════════════════════════════════════════
 */
import React, { useMemo, useCallback } from 'react';
import * as permissionsService from '../lib/permissionsService';
import { podeVerThreadInterna } from '../lib/internalThreadsService';
import { normalizarTelefone } from '../lib/phoneUtils';
import { getUserDisplayName } from '../lib/userHelpers';
import { contatoFidelizadoAoUsuario } from '../lib/userMatcher';

/**
 * Hook principal: retorna listaRecentes, listaBusca, threadsParaExibir
 */
export function useThreadsFiltradas({
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
  filterScope,
  duplicataEncontrada,
  threadsNaoAtribuidasVisiveis,
  contatosBuscados = [],
}) {

  // ── Helpers ──────────────────────────────────────────────────────────

  const matchBuscaGoogle = React.useCallback((item, termo) => {
    if (!termo || termo.trim().length < 2) return false;
    const normalizarTexto = (t) => {
      if (!t) return '';
      return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };
    const termoNorm = normalizarTexto(termo);
    const termoNumeros = String(termo).replace(/\D/g, '');
    const camposTexto = [
      item.nome, item.empresa, item.cargo, item.email, item.observacoes,
      item.vendedor_responsavel, item.razao_social, item.nome_fantasia,
      item.contato_principal_nome, item.segmento,
      ...(Array.isArray(item.tags) ? item.tags : [])
    ].filter(Boolean);
    const camposNumero = [item.telefone, item.cnpj].filter(Boolean);
    const textoCompleto = camposTexto.map((c) => normalizarTexto(String(c))).join(' ');
    const numerosCompletos = camposNumero.map((c) => String(c).replace(/\D/g, '')).join(' ');
    const matchTexto = textoCompleto.includes(termoNorm);
    const matchNumero = termoNumeros.length >= 3 && numerosCompletos.includes(termoNumeros);
    const palavrasTermo = termoNorm.split(' ').filter(Boolean);
    const todasPalavrasEncontradas = palavrasTermo.every((p) => textoCompleto.includes(p));
    return matchTexto || matchNumero || todasPalavrasEncontradas;
  }, []);

  const calcularScoreBusca = React.useCallback((contato, termo) => {
    if (!contato || !termo) return 0;
    const normalizarTexto = (t) => {
      if (!t) return '';
      return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };
    const termoNorm = normalizarTexto(termo);
    const nome = normalizarTexto(contato.nome || '');
    const empresa = normalizarTexto(contato.empresa || '');
    let score = 0;
    if (nome === termoNorm) score += 100;
    else if (nome.startsWith(termoNorm)) score += 50;
    else if (nome.includes(termoNorm)) score += 20;
    if (empresa === termoNorm) score += 40;
    else if (empresa.includes(termoNorm)) score += 15;
    const outrosCampos = normalizarTexto((contato.cargo || '') + (contato.observacoes || ''));
    if (outrosCampos.includes(termoNorm)) score += 5;
    return score;
  }, []);

  const contatosMap = React.useMemo(() =>
    new Map(contatos.map((c) => [c.id, c])),
  [contatos]);

  const isAdmin = usuario?.role === 'admin';
  const temBuscaPorTexto = !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;

  const effectiveScope = React.useMemo(() => {
    const hasBaseData = !!usuario && Array.isArray(threads);
    return !hasBaseData && filterScope === 'unassigned' ? 'all' : filterScope;
  }, [usuario, threads, filterScope]);

  // ── Filtro Principal (idêntico ao Comunicacao.jsx) ───────────────────

  const threadsFiltradas = React.useMemo(() => {
    if (!usuario || !userPermissions) return [];

    const categoriasSet = selectedCategoria !== 'all'
      ? new Set(mensagensComCategoria.map((m) => m.thread_id))
      : null;

    const isFilterUnassigned = effectiveScope === 'unassigned';
    const threadMaisRecentePorContacto = new Map();

    // Pré-filtro service_* + deduplicação
    threads.forEach((thread) => {
      if (!thread) return;

      // ✅ sector_group nunca aparece na lista principal de atendimentos externos
      if (thread.thread_type === 'sector_group') return;

      // ✅ FILTRO service_*: threads internas 1:1 com conta de serviço são invisíveis
      if (thread.thread_type === 'team_internal') {
        if (thread.participants?.some(p => typeof p === 'string' && p.startsWith('service_'))) return;
        threadMaisRecentePorContacto.set(`internal-${thread.id}`, thread);
        return;
      }

      if (temBuscaPorTexto) {
        threadMaisRecentePorContacto.set(`search-all-${thread.id}`, thread);
        return;
      }

      const contactId = thread.contact_id;
      if (!contactId) {
        if (isAdmin) threadMaisRecentePorContacto.set(`orphan-${thread.id}`, thread);
        return;
      }

      const existente = threadMaisRecentePorContacto.get(contactId);
      if (!existente) {
        threadMaisRecentePorContacto.set(contactId, thread);
      } else {
        const uid = usuario?.id;
        // ✅ PRIORIDADE: thread atribuída ao usuário atual SEMPRE vence, mesmo se mais antiga
        const existenteAtribuida = existente.assigned_user_id === uid;
        const atualAtribuida = thread.assigned_user_id === uid;
        if (!existenteAtribuida && atualAtribuida) {
          // Thread atual é atribuída ao usuário e a existente não é → substituir
          threadMaisRecentePorContacto.set(contactId, thread);
        } else if (existenteAtribuida && !atualAtribuida) {
          // Existente já é atribuída ao usuário → manter
        } else {
          // Ambas ou nenhuma: usar a mais recente
          const tsExistente = new Date(existente.last_message_at || existente.updated_date || 0).getTime();
          const tsAtual = new Date(thread.last_message_at || thread.updated_date || 0).getTime();
          if (tsAtual > tsExistente) threadMaisRecentePorContacto.set(contactId, thread);
        }
      }
    });

    const threadsUnicas = Array.from(threadMaisRecentePorContacto.values());
    const contatosComThreadExistente = new Set(threadsUnicas.map((t) => t.contact_id).filter(Boolean));
    const threadsComContatoIds = new Set();

    const filtros = {
      atendenteId: selectedAttendantId,
      integracaoId: selectedIntegrationId,
      scope: filterScope
    };

    const threadsFiltrados = threadsUnicas.filter((thread) => {
      // ── sector_group: nunca exibir na lista de atendimentos ──
      if (thread.thread_type === 'sector_group') return false;

      // ── THREADS INTERNAS 1:1 ──
      if (thread.thread_type === 'team_internal') {
        return podeVerThreadInterna(thread, usuario);
      }

      const contato = contatosMap.get(thread.contact_id);

      if (!contato && thread.contact_id && !isFilterUnassigned) {
        // fail-safe: mantém thread sem contato hidratado
      } else if (!contato && !thread.contact_id && !isFilterUnassigned) {
        return false;
      }

      if (thread.contact_id) threadsComContatoIds.add(thread.contact_id);

      // Modo busca: sem VISIBILITY_MATRIX
      if (temBuscaPorTexto) {
        if (!contato || !matchBuscaGoogle(contato, debouncedSearchTerm)) return false;
        if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) return false;
        if (selectedTagContato && selectedTagContato !== 'all') {
          if (!(contato.tags || []).includes(selectedTagContato)) return false;
        }
        return true;
      }

      // Filtro não adicionadas
      if (filterScope === 'nao_adicionado') {
        return !thread.contact_id;
      }

      // Filtros específicos
      if (selectedIntegrationId && selectedIntegrationId !== 'all') {
        const integrationIds = thread.origin_integration_ids?.length > 0
          ? thread.origin_integration_ids
          : [thread.whatsapp_integration_id];
        if (!integrationIds.includes(selectedIntegrationId)) return false;
      }

      if (selectedAttendantId && selectedAttendantId !== 'all') {
        if (thread.assigned_user_id !== selectedAttendantId) return false;
      }

      if (categoriasSet && !(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
        if (!categoriasSet.has(thread.id)) return false;
      }

      if (selectedTipoContato && selectedTipoContato !== 'all' && contato) {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          if (contato.tipo_contato !== selectedTipoContato) return false;
        }
      }

      if (selectedTagContato && selectedTagContato !== 'all' && contato) {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          if (!(contato.tags || []).includes(selectedTagContato)) return false;
        }
      }

      if (isFilterUnassigned) {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          if (!threadsNaoAtribuidasVisiveis.has(thread.id)) return false;
        }
      } else {
        const podeVerBase = permissionsService.canUserSeeThreadBase(userPermissions, thread, contato);
        if (!podeVerBase) return false;

        if (filtros.scope && filtros.scope !== 'all') {
          const escopoConfig = { id: filtros.scope, regra: filtros.scope === 'my' ? 'atribuido_ou_fidelizado' : 'sem_assigned_user_id' };
          const threadsComEscopo = permissionsService.aplicarFiltroEscopo([thread], escopoConfig, userPermissions);
          if (threadsComEscopo.length === 0) return false;
        }
      }

      return true;
    });

    // ── PARTE 2: COM BUSCA — contatos sem thread e clientes sem contato ──
    if (temBuscaPorTexto) {
      const telefonesJaAcionados = new Set();
      const todosCont = [...contatos, ...contatosBuscados];
      const contatosUnicos = new Map(todosCont.map((c) => [c.id, c]));

      Array.from(contatosUnicos.values()).forEach((contato) => {
        if (contato.telefone && !temBuscaPorTexto) {
          const telNorm = normalizarTelefone(contato.telefone);
          if (telNorm && telefonesJaAcionados.has(telNorm)) return;
          if (telNorm) telefonesJaAcionados.add(telNorm);
        }

        if (!isAdmin) {
          if (contatosComThreadExistente.has(contato.id)) return;
          if (threadsComContatoIds.has(contato.id)) return;
          if (contato.bloqueado) return;
        } else {
          if (!temBuscaPorTexto && contatosComThreadExistente.has(contato.id)) return;
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
    threads, contatos, clientes, atendentes, usuario, userPermissions,
    selectedAttendantId, selectedIntegrationId, selectedCategoria,
    selectedTipoContato, selectedTagContato, debouncedSearchTerm,
    mensagensComCategoria, matchBuscaGoogle, filterScope, duplicataEncontrada,
    effectiveScope, threadsNaoAtribuidasVisiveis, contatosBuscados, contatosMap
  ]);

  // ── Lista Recentes (modo normal sem busca) ───────────────────────────

  const listaRecentes = React.useMemo(() => {
    const contatosMapLocal = new Map(contatos.map((c) => [c.id, c]));
    const usuariosMap = new Map(atendentes.map((a) => [a.id, a]));

    const enriched = threadsFiltradas.map((thread) => {
      const usuarioAtribuido = usuariosMap.get(thread.assigned_user_id);
      const contatoObj = thread.contato || contatosMapLocal.get(thread.contact_id);
      const meta = contatoObj?._meta || {};

      return {
        ...thread,
        contato: contatoObj,
        atendente_atribuido: usuarioAtribuido,
        assigned_user_display_name: usuarioAtribuido ? getUserDisplayName(usuarioAtribuido.id, atendentes) : null,
        uiMeta: {
          temDadosBasicos: meta.tem_dados_basicos ?? false,
          scoreCompletude: meta.score_completude ?? 0
        }
      };
    });

    const gerarChaveUnica = (contato) => {
      if (!contato) return null;
      const tel = normalizarTelefone(contato.telefone || '') || '';
      const nome = (contato.nome || '').trim().toLowerCase();
      const empresa = (contato.empresa || '').trim().toLowerCase();
      const cargo = (contato.cargo || '').trim().toLowerCase();
      return `${tel}|${nome}|${empresa}|${cargo}`;
    };

    const threadsPorChaveUnica = new Map();
    enriched.forEach((thread) => {
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        threadsPorChaveUnica.set(`internal-${thread.id}`, thread);
        return;
      }
      const chave = gerarChaveUnica(thread.contato);
      if (!chave) {
        threadsPorChaveUnica.set(`orphan-${thread.id}`, thread);
        return;
      }
      const existente = threadsPorChaveUnica.get(chave);
      if (!existente) {
        threadsPorChaveUnica.set(chave, thread);
      } else {
        const tsExistente = new Date(existente.last_message_at || 0).getTime();
        const tsAtual = new Date(thread.last_message_at || 0).getTime();
        if (tsAtual > tsExistente) threadsPorChaveUnica.set(chave, thread);
      }
    });

    return Array.from(threadsPorChaveUnica.values()).sort((a, b) => {
      const getPrioridade = (item) => {
        if (item.is_cliente_only) return 3;
        if (item.is_contact_only) return 2;
        return 1;
      };
      const prioA = getPrioridade(a);
      const prioB = getPrioridade(b);
      if (prioA !== prioB) return prioA - prioB;
      return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
    });
  }, [threadsFiltradas, contatos, atendentes]);

  // ── Lista Busca (modo busca ativo) ───────────────────────────────────

  const listaBusca = React.useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) return [];

    const contatosMapLocal = new Map([...contatos, ...contatosBuscados].map(c => [c.id, c]));
    const usuariosMap = new Map(atendentes.map((a) => [a.id, a]));
    const resultadosBusca = [];
    const idsJaProcessados = new Set();

    contatosMapLocal.forEach((contato, contactId) => {
      if (idsJaProcessados.has(contactId)) return;
      if (contato.bloqueado) return;
      if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return;
      if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) return;
      if (selectedTagContato && selectedTagContato !== 'all') {
        if (!(contato.tags || []).includes(selectedTagContato)) return;
      }

      const threadsDoContato = threads.filter(t => t.contact_id === contactId);
      const meta = contato._meta || {};
      let itemFinal;

      if (threadsDoContato.length > 0) {
        const threadMaisRecente = threadsDoContato.sort((a, b) => {
          const tsA = new Date(a.last_message_at || a.updated_date || 0).getTime();
          const tsB = new Date(b.last_message_at || b.updated_date || 0).getTime();
          return tsB - tsA;
        })[0];
        const usuarioAtribuido = usuariosMap.get(threadMaisRecente.assigned_user_id);
        itemFinal = {
          ...threadMaisRecente,
          contato,
          atendente_atribuido: usuarioAtribuido,
          assigned_user_display_name: usuarioAtribuido ? getUserDisplayName(usuarioAtribuido.id, atendentes) : null,
          _searchScore: calcularScoreBusca(contato, debouncedSearchTerm),
          _threadsConsolidadas: threadsDoContato.length,
          uiMeta: { temDadosBasicos: meta.tem_dados_basicos ?? false, scoreCompletude: meta.score_completude ?? 0 }
        };
      } else {
        itemFinal = {
          id: `contato-sem-thread-${contactId}`,
          contact_id: contactId,
          is_contact_only: true,
          contato,
          last_message_at: contato.ultima_interacao || contato.created_date,
          last_message_content: null,
          unread_count: 0,
          status: 'sem_conversa',
          _searchScore: calcularScoreBusca(contato, debouncedSearchTerm),
          uiMeta: { temDadosBasicos: meta.tem_dados_basicos ?? false, scoreCompletude: meta.score_completude ?? 0 }
        };
      }

      resultadosBusca.push(itemFinal);
      idsJaProcessados.add(contactId);
    });

    return resultadosBusca.sort((a, b) => {
      const scoreRelevanciaA = a._searchScore ?? 0;
      const scoreRelevanciaB = b._searchScore ?? 0;
      const scoreCompletudeA = a.uiMeta?.scoreCompletude ?? 0;
      const scoreCompletudeB = b.uiMeta?.scoreCompletude ?? 0;
      const tsA = new Date(a.last_message_at || 0).getTime();
      const tsB = new Date(b.last_message_at || 0).getTime();
      const scoreFinalA = (scoreRelevanciaA * 0.6) + (scoreCompletudeA * 0.3) + (tsA / 1e12 * 0.1);
      const scoreFinalB = (scoreRelevanciaB * 0.6) + (scoreCompletudeB * 0.3) + (tsB / 1e12 * 0.1);
      return scoreFinalB - scoreFinalA;
    });
  }, [contatos, contatosBuscados, threads, atendentes, debouncedSearchTerm, selectedTipoContato, selectedTagContato, matchBuscaGoogle, calcularScoreBusca]);

  // ── Resultado final ──────────────────────────────────────────────────
  const temBuscaAtiva = debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
  const threadsParaExibir = temBuscaAtiva ? listaBusca : listaRecentes;

  return {
    threadsFiltradas,
    listaRecentes,
    listaBusca,
    threadsParaExibir,
    temBuscaAtiva,
    matchBuscaGoogle,
    calcularScoreBusca,
    contatosMap,
  };
}