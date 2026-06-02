import { base44 } from '@/api/base44Client';
import { listarThreadsInternasUsuario } from '@/functions/listarThreadsInternasUsuario';

/**
 * Carrega apenas threads internas (team_internal e sector_group).
 * Usa função backend (asServiceRole) para respeitar `participants`,
 * já que a RLS de MessageThread ignora esse campo e bloquearia
 * mensagens internas para usuários não-admin.
 */
export async function carregarThreadsInternas() {
  try {
    const resp = await listarThreadsInternasUsuario({});
    return resp?.data?.threads || [];
  } catch (error) {
    console.error('[internalThreadsService] Erro ao carregar threads internas:', error);
    return [];
  }
}

/**
 * Carrega apenas threads externas canônicas (não-merged)
 */
export async function carregarThreadsExternasCanonicas() {
  try {
    return await base44.entities.MessageThread.filter(
      { is_canonical: true, status: { $ne: 'merged' } },
      '-last_message_at',
      500
    );
  } catch (error) {
    console.error('[internalThreadsService] Erro ao carregar threads externas:', error);
    return [];
  }
}

/**
 * Carrega TODAS as threads: externas canônicas + internas
 * Fonte única para o resto da lógica
 */
export async function carregarTodasThreads() {
  const [threadsExternas, threadsInternas] = await Promise.all([
    carregarThreadsExternasCanonicas(),
    carregarThreadsInternas()
  ]);

  console.log('[internalThreadsService] 📊 Externas canônicas:', threadsExternas.length, '| Internas:', threadsInternas.length, '| Total:', threadsExternas.length + threadsInternas.length);
  
  return [...threadsExternas, ...threadsInternas];
}

/**
 * Determina se usuário pode ver uma thread interna
 * Retorna null se não é thread interna (deixa para lógica externa)
 * Retorna boolean se é thread interna
 */
export function podeVerThreadInterna(thread, usuario) {
  // Não é thread interna? Deixa para lógica externa
  if (thread.thread_type !== 'team_internal' && thread.thread_type !== 'sector_group') {
    return null;
  }

  // ✅ Regra simples de internos: participante OU admin
  const isParticipant = thread.participants?.includes(usuario?.id);
  const isAdmin = usuario?.role === 'admin';

  return Boolean(isParticipant || isAdmin);
}