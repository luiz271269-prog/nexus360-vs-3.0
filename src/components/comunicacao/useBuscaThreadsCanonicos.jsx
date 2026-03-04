import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getUserDisplayName } from '../lib/userHelpers';

/**
 * Hook para busca de threads canônicas + contatos em modo busca
 * PARTE 1: Busca threads canônicas no BD
 * PARTE 2: Adiciona contatos sem thread
 */
export function useBuscaThreadsCanonicos(
  debouncedSearchTerm,
  contatos,
  contatosBuscados,
  atendentes,
  selectedTipoContato,
  selectedTagContato,
  matchBuscaGoogle,
  calcularScoreBusca
) {
  // ✅ Buscar threads canônicas no BD com searchTerm
  const { data: threadsCanonicosBusca = [] } = useQuery({
    queryKey: ['threads-busca', debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) return [];

      try {
        const response = await base44.functions.invoke('buscarThreadsLivre', {
          status: 'aberta',
          searchTerm: debouncedSearchTerm,
          limit: 500,
          incluirInternas: false
        });

        if (response?.data?.success) {
          return response.data.threads || [];
        }

        console.warn('[BUSCA] ⚠️ Fallback para busca com RLS');
        return await base44.entities.MessageThread.filter(
          { is_canonical: true, status: { $ne: 'merged' } },
          '-last_message_at',
          500
        );
      } catch (error) {
        console.error('[BUSCA] ❌ Erro ao buscar threads:', error);
        return [];
      }
    },
    enabled: !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2,
    staleTime: 30000,
    retry: 1
  });

  // ✅ Processar threads + contatos
  const listaBusca = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) return [];

    const contatosMap = new Map([...contatos, ...contatosBuscados].map(c => [c.id, c]));
    const usuariosMap = new Map(atendentes.map((a) => [a.id, a]));
    const resultadosBusca = [];
    const idsJaProcessados = new Set();

    // PARTE 1: Threads canônicas do BD
    threadsCanonicosBusca.forEach((thread) => {
      const contato = contatosMap.get(thread.contact_id);
      if (!contato) return;

      const usuarioAtribuido = usuariosMap.get(thread.assigned_user_id);
      const meta = contato._meta || {};

      resultadosBusca.push({
        ...thread,
        contato,
        atendente_atribuido: usuarioAtribuido,
        assigned_user_display_name: usuarioAtribuido ? getUserDisplayName(usuarioAtribuido.id, atendentes) : null,
        _searchScore: calcularScoreBusca(contato, debouncedSearchTerm),
        uiMeta: {
          temDadosBasicos: meta.tem_dados_basicos ?? false,
          scoreCompletude: meta.score_completude ?? 0
        }
      });

      idsJaProcessados.add(thread.contact_id);
    });

    // PARTE 2: Contatos sem thread
    contatosMap.forEach((contato, contactId) => {
      if (idsJaProcessados.has(contactId)) return;
      if (contato.bloqueado) return;
      if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return;

      if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) {
        return;
      }

      if (selectedTagContato && selectedTagContato !== 'all') {
        const tags = contato.tags || [];
        if (!tags.includes(selectedTagContato)) {
          return;
        }
      }

      const meta = contato._meta || {};
      resultadosBusca.push({
        id: `contato-sem-thread-${contactId}`,
        contact_id: contactId,
        is_contact_only: true,
        contato,
        last_message_at: contato.ultima_interacao || contato.created_date,
        last_message_content: null,
        unread_count: 0,
        status: 'sem_conversa',
        _searchScore: calcularScoreBusca(contato, debouncedSearchTerm),
        uiMeta: {
          temDadosBasicos: meta.tem_dados_basicos ?? false,
          scoreCompletude: meta.score_completude ?? 0
        }
      });

      idsJaProcessados.add(contactId);
    });

    // Ordenar: Relevância (60%) + Completude (30%) + Recência (10%)
    return resultadosBusca.sort((a, b) => {
      const scoreCompletudeA = a.uiMeta?.scoreCompletude ?? 0;
      const scoreCompletudeB = b.uiMeta?.scoreCompletude ?? 0;
      const scoreRelevanciaA = a._searchScore ?? 0;
      const scoreRelevanciaB = b._searchScore ?? 0;
      
      const tsA = new Date(a.last_message_at || 0).getTime();
      const tsB = new Date(b.last_message_at || 0).getTime();
      const scoreRecenciaA = tsA / 1e12;
      const scoreRecenciaB = tsB / 1e12;
      
      const scoreFinalA = (scoreRelevanciaA * 0.6) + (scoreCompletudeA * 0.3) + (scoreRecenciaA * 0.1);
      const scoreFinalB = (scoreRelevanciaB * 0.6) + (scoreCompletudeB * 0.3) + (scoreRecenciaB * 0.1);
      
      return scoreFinalB - scoreFinalA;
    });
  }, [threadsCanonicosBusca, contatos, contatosBuscados, atendentes, debouncedSearchTerm, selectedTipoContato, selectedTagContato, matchBuscaGoogle, calcularScoreBusca]);

  return listaBusca;
}