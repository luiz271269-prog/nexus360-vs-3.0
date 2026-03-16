import React from 'react';

export function useListaRecentes({
  threadsFiltradas,
  contatos,
  atendentes,
  normalizarTelefone,
  getUserDisplayName
}) {
  return React.useMemo(() => {
    if (!threadsFiltradas || threadsFiltradas.length === 0) {
      return [];
    }

    // Retornar threads filtradas ordenadas por data
    return threadsFiltradas.sort((a, b) => {
      const dateA = new Date(a.last_message_at || a.created_date || 0);
      const dateB = new Date(b.last_message_at || b.created_date || 0);
      return dateB - dateA;
    });
  }, [threadsFiltradas]);
}