/**
 * ✅ UTILS: Filtros de Threads Internas
 * Remove threads com contas de serviço (service_*)
 */

export const filtrarThreadsInternasValidas = (threads = []) => {
  return threads.filter(thread => {
    // ✅ FILTRO CRÍTICO: Excluir threads com participants que começam com "service_"
    if (thread.participants?.some(p => typeof p === 'string' && p.startsWith('service_'))) {
      console.log(`[FILTRO] 🚫 Excluindo thread com conta de serviço:`, thread.id);
      return false;
    }
    return true;
  });
};