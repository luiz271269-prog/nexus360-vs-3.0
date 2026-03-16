// Lógica de filtragem de threads extraída
import * as permissionsService from "../lib/permissionsService";

export function aplicarFiltroEscopo(thread, usuario, filtros, userPermissions, DEBUG_VIS = false) {
  if (!filtros.scope || filtros.scope === 'all') {
    return true; // Sem filtro de escopo
  }

  // ✅ NOVO: Verificar participação em participants[] (Opção A)
  const participaComoParticipante = thread.participants?.includes(usuario?.id);
  
  if (filtros.scope === 'my' && participaComoParticipante) {
    if (DEBUG_VIS) {
      console.log('[FILTER] ✅ Thread passou: usuário está em participants[]');
    }
    return true;
  }

  // Aplicar filtro tradicional de escopo
  const escopoConfig = {
    id: filtros.scope,
    regra: filtros.scope === 'my' ? 'atribuido_ou_fidelizado' : 'sem_assigned_user_id'
  };

  const threadsComEscopo = permissionsService.aplicarFiltroEscopo(
    [thread],
    escopoConfig,
    userPermissions
  );

  return threadsComEscopo.length > 0;
}