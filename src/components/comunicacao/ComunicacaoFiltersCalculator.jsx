import React from 'react';
import * as permissionsService from '../lib/permissionsService';

/**
 * Componente que encapsula toda a lógica de cálculo de filtros
 * Reduz linhas do Comunicacao.jsx separando os useMemo
 */
export function useComunicacaoFilters({
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
  calcularScoreBusca,
  filterScope,
  duplicataEncontrada
}) {
  // Função de busca melhorada para termos compostos
  const matchBuscaGoogleCallback = React.useCallback((item, termo) => {
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

  // Calcular score de relevância para ordenação de busca
  const calcularScoreBuscaCallback = React.useCallback((contato, termo) => {
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

  // PRÉ-INDEXAÇÃO: Mapa de contatos
  const contatosMap = React.useMemo(() => {
    return new Map(contatos.map((c) => [c.id, c]));
  }, [contatos]);

  // ✅ PATCH 3: Segurar "unassigned" até ter dados mínimos
  const hasBaseData = !!usuario && Array.isArray(threads) && threads.length >= 0;
  const effectiveScope = !hasBaseData && filterScope === 'unassigned' ? 'all' : filterScope;

  // ✅ PRÉ-CÁLCULO: Threads não-atribuídas
  const threadsNaoAtribuidasVisiveis = React.useMemo(() => {
    if (effectiveScope !== 'unassigned' || !usuario || !userPermissions) return new Set();

    const setIds = new Set();

    threads.forEach((thread) => {
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') return;

      const contato = contatosMap.get(thread.contact_id);

      if (permissionsService.isNaoAtribuida(thread) && permissionsService.canUserSeeThreadBase(userPermissions, thread, contato)) {
        setIds.add(thread.id);
      }
    });
    return setIds;
  }, [threads, contatosMap, usuario, effectiveScope, userPermissions]);

  return {
    matchBuscaGoogle: matchBuscaGoogleCallback,
    calcularScoreBusca: calcularScoreBuscaCallback,
    contatosMap,
    effectiveScope,
    threadsNaoAtribuidasVisiveis
  };
}