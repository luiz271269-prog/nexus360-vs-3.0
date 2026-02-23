/**
 * Seleciona a integração WhatsApp padrão para um usuário ao criar novo contato.
 * 
 * Critérios (em ordem de prioridade):
 * 1. Respeita can_view + can_send das permissões whatsapp_permissions
 * 2. Prioriza instância cujo setor_principal ou setores_atendidos bate com o setor do usuário
 * 3. Fallback: primeira conectada com permissão
 * 
 * Corrige bug: quando whatsapp_permissions está vazio mas integracoesVisiveis populado,
 * o find anterior retornava false para !perm — agora libera corretamente.
 */
export function selecionarIntegracaoPadrao(integracoes, usuario) {
  if (!integracoes?.length || !usuario) return null;

  const setorUsuario = usuario.attendant_sector || 'geral';
  const whatsappPerms = usuario.whatsapp_permissions || [];
  const isAdmin = usuario.role === 'admin';

  const integracoesFiltradas = integracoes.filter((i) => {
    if (i.status !== 'conectado') return false;
    if (isAdmin) return true;

    // Sem restrições configuradas = libera (compatibilidade com fallback integracoesVisiveis)
    if (whatsappPerms.length === 0) return true;

    const perm = whatsappPerms.find((p) => p.integration_id === i.id);

    // ✅ FIX: Se não há perm específica, libera (array integracoes já foi filtrado por can_view)
    if (!perm) return true;

    return perm.can_view === true && perm.can_send === true;
  });

  if (!integracoesFiltradas.length) return null;

  // ✅ Priorizar pelo setor do usuário
  return integracoesFiltradas.sort((a, b) => {
    const aMatch = a.setor_principal === setorUsuario || a.setores_atendidos?.includes(setorUsuario);
    const bMatch = b.setor_principal === setorUsuario || b.setores_atendidos?.includes(setorUsuario);
    return (bMatch ? 1 : 0) - (aMatch ? 1 : 0);
  })[0] || null;
}