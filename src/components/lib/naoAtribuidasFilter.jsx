/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 FONTE ÚNICA DE VERDADE — "Thread realmente não atribuída"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Usado por: ContadorNaoAtribuidas, ContatosNaoAtribuidosKanban,
 * Comunicacao.jsx (scope unassigned), e qualquer outra tela.
 *
 * Regra de negócio (análise forense — elimina ~70% falsos positivos):
 *
 * NÃO conta como "não atribuída":
 *   - Threads internas (team_internal, sector_group)
 *   - Threads sem contact_id
 *   - Threads com assigned_user_id / assigned_user_name / assigned_user_email
 *   - Threads sem last_inbound_at (outbound puro: massa/promoção)
 *   - Threads já atendidas e cliente NÃO voltou depois (conversa encerrada)
 *
 * CONTA como "não atribuída":
 *   - CASO A: nunca foi atendida (sem histórico nem last_human_message_at)
 *   - CASO B: já foi atendida, mas cliente voltou DEPOIS do último atendimento
 */
export function isThreadRealmenteNaoAtribuida(thread) {
  if (!thread) return false;

  // Threads internas nunca entram
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    return false;
  }

  // Threads sem contato vinculado não fazem sentido
  if (!thread.contact_id) return false;

  // Com atendente atribuído → não é "não atribuída"
  if (thread.assigned_user_id || thread.assigned_user_name || thread.assigned_user_email) {
    return false;
  }

  // Sem inbound real → ignorar (outbound puro)
  if (!thread.last_inbound_at) return false;

  const lastInboundMs = new Date(thread.last_inbound_at).getTime();
  const lastHumanMs = thread.last_human_message_at
    ? new Date(thread.last_human_message_at).getTime()
    : 0;
  const jaTeveAtendente = Array.isArray(thread.atendentes_historico)
    && thread.atendentes_historico.length > 0;

  // CASO A: nunca foi atendida → mostrar
  if (!jaTeveAtendente && !lastHumanMs) return true;

  // CASO B: cliente voltou depois do último atendimento humano → mostrar
  if (lastHumanMs > 0 && lastInboundMs > lastHumanMs) return true;

  // CASO C: já atendida, cliente não voltou → encerrada
  return false;
}