import React, { useMemo } from 'react';

/**
 * Hook SEPARADO para "Busca de contatos no banco"
 * ✅ Consome APENAS contatosBuscados (dados do backend)
 * ✅ PULA VISIBILITY_MATRIX / escopo / dedup por thread
 * ✅ Aplica APENAS filtros funcionais (tipo/tag) + ordenação (score + recência)
 * 
 * Retorna array de contatos formatados como "threads sintéticas" para UI compatível
 */
export function useBuscaContatosBancoPura(
  debouncedSearchTerm,
  contatosBuscados,
  selectedTipoContato,
  selectedTagContato,
  calcularScoreBusca
) {
  return useMemo(() => {
    // ✅ Sem busca ativa = sem resultados
    if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) {
      return [];
    }

    if (!contatosBuscados || contatosBuscados.length === 0) {
      return [];
    }

    // ✅ Filtrar por tipo + tag (SÓ ISSO, sem VISIBILITY_MATRIX)
    const filtrados = contatosBuscados.filter((contato) => {
      // Filtro de tipo
      if (selectedTipoContato && selectedTipoContato !== 'all') {
        if (contato.tipo_contato !== selectedTipoContato) {
          return false;
        }
      }

      // Filtro de tag
      if (selectedTagContato && selectedTagContato !== 'all') {
        const tags = contato.tags || [];
        if (!tags.includes(selectedTagContato)) {
          return false;
        }
      }

      return true;
    });

    // ✅ Mapear para formato "thread sintética" (compatível com UI)
    const resultado = filtrados.map((contato) => {
      const score = calcularScoreBusca ? calcularScoreBusca(contato, debouncedSearchTerm) : 0;
      
      return {
        id: `busca-banco-${contato.id}`,
        contact_id: contato.id,
        is_contact_only: true,
        last_message_at: contato.ultima_interacao || contato.created_date,
        last_message_content: null,
        unread_count: 0,
        status: 'sem_conversa',
        contato,
        _searchScore: score
      };
    });

    // ✅ Ordenar por score (relevância) + recência
    return resultado.sort((a, b) => {
      const scoreA = a._searchScore ?? 0;
      const scoreB = b._searchScore ?? 0;

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Score maior primeiro
      }

      // Se mesmo score, ordenar por recência
      const dateA = new Date(a.last_message_at || 0).getTime();
      const dateB = new Date(b.last_message_at || 0).getTime();
      return dateB - dateA;
    });
  }, [debouncedSearchTerm, contatosBuscados, selectedTipoContato, selectedTagContato, calcularScoreBusca]);
}