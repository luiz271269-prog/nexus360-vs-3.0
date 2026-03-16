import React from 'react';

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
  contatosBuscados
}) {
  return React.useMemo(() => {
    if (!threads || threads.length === 0) {
      return [];
    }

    return threads.filter(thread => {
      // Aplicar filtros básicos
      if (selectedAttendantId && thread.assigned_user_id !== selectedAttendantId) {
        return false;
      }

      if (selectedIntegrationId && selectedIntegrationId !== 'all' && thread.whatsapp_integration_id !== selectedIntegrationId) {
        return false;
      }

      if (selectedCategoria && selectedCategoria !== 'all' && !thread.categorias?.includes(selectedCategoria)) {
        return false;
      }

      return true;
    });
  }, [threads, selectedAttendantId, selectedIntegrationId, selectedCategoria, contatosMap]);
}