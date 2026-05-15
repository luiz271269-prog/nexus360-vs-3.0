/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 FONTE ÚNICA DE VERDADE — "Thread realmente não atribuída" (FRONTEND)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Espelho local da skill backend `skillNaoAtribuidas`.
 * Mesmas regras — uso no frontend para cálculo instantâneo sem chamar o backend.
 *
 * NÃO conta como "não atribuída":
 *   • Threads internas (team_internal, sector_group)
 *   • Threads sem contact_id
 *   • Threads com assigned_user_* preenchido
 *   • Threads sem last_inbound_at (outbound puro)
 *   • Contato FIDELIZADO (atendente_fidelizado_* ou vendedor_responsavel)
 *   • Thread já atendida há <3 dias (último atendente = dono implícito)
 *   • Thread já atendida e cliente NÃO voltou (encerrada)
 *
 * CONTA como "não atribuída":
 *   • CASO A: nunca foi atendida
 *   • CASO B: cliente voltou após atendimento + >3 dias OU sem histórico
 */

const JANELA_DONO_IMPLICITO_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias

/**
 * Verifica se o contato vinculado é fidelizado a algum atendente.
 */
export function contatoEhFidelizado(contato) {
  if (!contato) return false;
  return Boolean(
    contato.atendente_fidelizado_vendas ||
    contato.atendente_fidelizado_assistencia ||
    contato.atendente_fidelizado_financeiro ||
    contato.atendente_fidelizado_fornecedor ||
    contato.vendedor_responsavel ||
    contato.is_cliente_fidelizado === true
  );
}

/**
 * Regra completa. Aceita opcional `contato` para checar fidelização.
 * Sem contato → assume não fidelizado (degrada gracefully).
 */
export function isThreadRealmenteNaoAtribuida(thread, contato = null) {
  if (!thread) return false;

  // Threads internas nunca entram
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    return false;
  }

  // Sem contato vinculado
  if (!thread.contact_id) return false;

  // Com atendente atribuído → não é "não atribuída"
  if (thread.assigned_user_id || thread.assigned_user_name || thread.assigned_user_email) {
    return false;
  }

  // Contato fidelizado → tem dono implícito
  if (contatoEhFidelizado(contato)) return false;

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

  // CASO B: cliente voltou depois do último atendimento humano
  if (lastHumanMs > 0 && lastInboundMs > lastHumanMs) {
    const tempoDesdeUltimoHumano = Date.now() - lastHumanMs;
    // <3d + já teve atendente → último atendente é dono implícito
    if (jaTeveAtendente && tempoDesdeUltimoHumano < JANELA_DONO_IMPLICITO_MS) {
      return false;
    }
    return true;
  }

  // CASO C: já atendida, cliente não voltou → encerrada
  return false;
}