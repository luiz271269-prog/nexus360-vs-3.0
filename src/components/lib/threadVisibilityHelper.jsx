// Helper para verificar visibilidade de threads considerando participação
export function checkThreadVisibilityWithParticipation(thread, usuario, filterScope) {
  // ✅ NOVO: Verificar se usuário está em participants[]
  const participouDaThread = Array.isArray(thread.participants) && thread.participants.includes(usuario.id);
  
  // Para filtro "my", incluir threads onde o usuário participou
  if (filterScope === 'my' && participouDaThread) {
    return {
      visible: true,
      reason: 'Usuário está em participants[]'
    };
  }

  return {
    visible: false,
    reason: 'Não está em participants[]'
  };
}