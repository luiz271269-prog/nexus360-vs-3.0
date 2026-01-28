import { base44 } from '@/api/base44Client';

/**
 * Carrega apenas threads internas (team_internal e sector_group)
 */
export async function carregarThreadsInternas() {
  try {
    return await base44.entities.MessageThread.filter(
      { thread_type: { $in: ['team_internal', 'sector_group'] } },
      '-last_message_at',
      100
    );
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