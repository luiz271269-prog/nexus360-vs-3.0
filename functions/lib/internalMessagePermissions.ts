/**
 * Determina se usuário pode enviar mensagens nesta thread interna
 * Regra única: participante OU admin
 */
export function podeEnviarMensagemInterna(thread, user) {
  // Validar que é thread interna
  if (thread.thread_type !== 'team_internal' && thread.thread_type !== 'sector_group') {
    return false;
  }

  // ✅ Participante ou admin
  const isParticipant = thread.participants?.includes(user.id);
  const isAdmin = user.role === 'admin';

  return isParticipant || isAdmin;
}