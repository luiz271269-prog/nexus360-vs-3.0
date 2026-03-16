import React from 'react';

/**
 * Hook para computar a lista de busca (threads + contatos)
 * Retorna array vazio se sem termo de busca >= 2 caracteres
 * Ordenação: 60% relevância + 30% completude + 10% recência
 */
export function useListaBusca({
  contatos = [],
  contatosBuscados = [],
  threads = [],
  atendentes = [],
  debouncedSearchTerm = '',
  selectedTipoContato = 'all',
  selectedTagContato = 'all',
  matchBuscaGoogle = () => false,
  calcularScoreBusca = () => 0,
  getUserDisplayName = (id) => id
}) {
  return React.useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) return [];

    const contatosMap = new Map([...contatos, ...contatosBuscados].map(c => [c.id, c]));
    const usuariosMap = new Map(atendentes.map((a) => [a.id, a]));
    const resultadosBusca = [];
    const idsJaProcessados = new Set();

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

      const threadsDoContato = threads.filter(t => t.contact_id === contactId);
      let itemFinal;

      if (threadsDoContato.length > 0) {
        const threadMaisRecente = threadsDoContato.sort((a, b) => {
          const tsA = new Date(a.last_message_at || a.updated_date || 0).getTime();
          const tsB = new Date(b.last_message_at || b.updated_date || 0).getTime();
          return tsB - tsA;
        })[0];

        const usuarioAtribuido = usuariosMap.get(threadMaisRecente.assigned_user_id);
        const meta = contato._meta || {};

        itemFinal = {
          ...threadMaisRecente,
          contato,
          atendente_atribuido: usuarioAtribuido,
          assigned_user_display_name: usuarioAtribuido ? getUserDisplayName(usuarioAtribuido.id, atendentes) : null,
          _searchScore: calcularScoreBusca(contato, debouncedSearchTerm),
          _threadsConsolidadas: threadsDoContato.length,
          uiMeta: {
            temDadosBasicos: meta.tem_dados_basicos ?? false,
            scoreCompletude: meta.score_completude ?? 0
          }
        };
      } else {
        const meta = contato._meta || {};
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
          uiMeta: {
            temDadosBasicos: meta.tem_dados_basicos ?? false,
            scoreCompletude: meta.score_completude ?? 0
          }
        };
      }

      resultadosBusca.push(itemFinal);
      idsJaProcessados.add(contactId);
    });

    // ✅ ORDENAÇÃO CRM: Relevância (60%) + Completude (30%) + Recência (10%)
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
  }, [contatos, contatosBuscados, threads, atendentes, debouncedSearchTerm, selectedTipoContato, selectedTagContato, matchBuscaGoogle, calcularScoreBusca]);
}