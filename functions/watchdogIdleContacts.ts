import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// WATCHDOG v2.0 - Rede de Segurança para Contatos no Limbo
// ============================================================================
// Lógica em 2 camadas (conforme diagrama):
// 1. PASSIVA: seta INIT em threads sem atendimento → URA aciona na próxima msg
// 2. ATIVA: se msg < 2h → chama preAtendimentoHandler diretamente (proativo)
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const threshold24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const threshold2h  = new Date(now.getTime() -  2 * 60 * 60 * 1000).toISOString();

    console.log('[WATCHDOG v2] Iniciando varredura | Now:', now.toISOString());

    // Buscar threads no limbo: sem atendente, sem URA ativa, com msg recente (24h)
    const allThreads = await base44.asServiceRole.entities.MessageThread.filter({
      thread_type: 'contact_external',
      status: 'aberta',
      assigned_user_id: null
    }, '-last_inbound_at', 200);

    // Filtrar: sem URA ativa OU state null, e com inbound nas últimas 24h
    const limboThreads = allThreads.filter(t => {
      if (!t.last_inbound_at) return false;
      if (t.last_inbound_at < threshold24h) return false;
      // Limbo = sem atendimento ativo
      const semURA = !t.pre_atendimento_ativo || !t.pre_atendimento_state;
      return semURA;
    });

    console.log(`[WATCHDOG v2] Threads no limbo: ${limboThreads.length}`);

    const results = { total: limboThreads.length, resetadas: 0, proativas: 0, erros: [] };

    for (const thread of limboThreads) {
      try {
        // CAMADA 1: Garantir que a URA vai disparar na próxima mensagem
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'INIT',
          pre_atendimento_ativo: true,
          pre_atendimento_timeout_at: null
        });
        results.resetadas++;

        // CAMADA 2: Se msg recente (< 2h) → acionar preAtendimentoHandler agora
        if (thread.last_inbound_at >= threshold2h) {
          console.log(`[WATCHDOG v2] ATIVO: chamando preAtendimentoHandler para thread ${thread.id}`);
          
          await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
            thread_id: thread.id,
            contact_id: thread.contact_id,
            integration_id: thread.whatsapp_integration_id,
            mensagem: '__watchdog_trigger__',
            force_init: true
          });
          results.proativas++;
        }

      } catch (err) {
        console.error(`[WATCHDOG v2] Erro thread ${thread.id}:`, err.message);
        results.erros.push({ thread_id: thread.id, error: err.message });
      }
    }

    console.log('[WATCHDOG v2] Concluído:', results);

    return Response.json({ success: true, results });

  } catch (error) {
    console.error('[WATCHDOG v2] Erro geral:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});