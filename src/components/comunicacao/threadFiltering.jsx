// Lógica de filtragem de threads extraída
import * as permissionsService from "../lib/permissionsService";

export function aplicarFiltroEscopo(opcoes) {
  const {
    threads = [],
    usuario,
    userPermissions,
    filterScope = 'all',
    selectedAttendantId,
    selectedIntegrationId,
    selectedTipoContato,
    selectedTagContato,
    selectedCategoria,
    contatosMap,
    DEBUG_VIS = false
  } = opcoes || {};

  if (!Array.isArray(threads)) return [];
  if (!filterScope || filterScope === 'all') return threads;
  if (!usuario || !userPermissions) return [];

  // Filtrar por escopo
  return threads.filter(thread => {
    // Internos sempre passam (gerenciados por participação)
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      if (thread.participants?.includes(usuario.id)) return true;
      return false;
    }

    // Externos: aplicar permissões
    const contato = contatosMap?.get(thread.contact_id);
    const podeVer = permissionsService.canUserSeeThreadBase(userPermissions, thread, contato);
    if (!podeVer) return false;

    // Filtro por atendente
    if (selectedAttendantId && selectedAttendantId !== 'all') {
      if (thread.assigned_user_id !== selectedAttendantId) return false;
    }

    // Filtro por integração
    if (selectedIntegrationId && selectedIntegrationId !== 'all') {
      if (thread.whatsapp_integration_id !== selectedIntegrationId) return false;
    }

    // Filtro por categoria
    if (selectedCategoria && selectedCategoria !== 'all') {
      if (!Array.isArray(thread.categorias) || !thread.categorias.includes(selectedCategoria)) return false;
    }

    return true;
  }).sort((a, b) => {
    const aTime = new Date(a.last_message_at || 0).getTime();
    const bTime = new Date(b.last_message_at || 0).getTime();
    return bTime - aTime;
  });
}