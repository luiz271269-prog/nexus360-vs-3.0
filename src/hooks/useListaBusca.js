import React from 'react';

export function useListaBusca({
  contatos,
  contatosBuscados,
  threads,
  atendentes,
  debouncedSearchTerm,
  selectedTipoContato,
  selectedTagContato,
  matchBuscaGoogle,
  calcularScoreBusca,
  getUserDisplayName
}) {
  return React.useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) {
      return [];
    }

    // Retornar contatos buscados como resultado
    return contatosBuscados.map(contato => ({
      id: contato.id,
      nome: contato.nome,
      telefone: contato.telefone,
      empresa: contato.empresa,
      type: 'contato'
    }));
  }, [debouncedSearchTerm, contatosBuscados]);
}