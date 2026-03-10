import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// WATCHDOG - v2.0 - Monitoramento em 3 camadas
// Tipo A: assigned=null + state=null/INIT → Ativa pré-atendimento
// Tipo B: assigned=null + state=WAITING_* → Já tratado pelo preAtendimento (skip)
// Tipo C: assigned=preenchido + idle 48h → Cria WorkQueueItem para Jarvis
// ============================================================================

const IDLE_THRESHOLD_HOURS = 48;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - IDLE_THRESHOLD_HOURS);
    const thresholdISO = thresholdDate.toISOString();

    console.log('[WATCHDOG v2] Iniciando varredura | Threshold 48h:', thresholdISO);

    // Buscar todas as threads externas abertas
    const allThreads = await base44.asServiceRole.entities.MessageThread.filter({
      thread_type: 'contact_external',
      status: 'aberta'
    }, '-last_message_at', 1000);

    console.log('[WATCHDOG v2] Total threads externas abertas:', allThreads.length);

    const results = {
      tipoA_ativados: 0,
      tipoB_skipped: 0,
      tipoC_alertados: 0,
      errors: []
    };

    for (const thread of allThreads) {
      try {
        const hasAssigned = !!thread.assigned_user_id;
        const state = thread.pre_atendimento_state;
        const isWaiting = state && state.startsWith('WAITING_');
        const isCompleted = state === 'COMPLETED' || state === 'TIMEOUT' || state === 'CANCELLED';

        // ── TIPO A: sem atendente + sem URA ativa ──────────────────────────
        if (!hasAssigned && !isWaiting && !isCompleted) {
          // Ativa o pré-atendimento para que o próximo inbound dispare o menu
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            pre_atendimento_state: 'INIT',
            pre_atendimento_ativo: true,
            pre_atendimento_timeout_at: null
          });
          console.log('[WATCHDOG v2] Tipo A ativado:', thread.id, '| Último msg:', thread.last_message_at);
          results.tipoA_ativados++;
          continue;
        }

        // ── TIPO B: sem atendente + URA em andamento ──────────────────────
        if (!hasAssigned && isWaiting) {
          // Deixa o preAtendimentoHandler trabalhar — não interfere
          results.tipoB_skipped++;
          continue;
        }

        // ── TIPO C: tem atendente + idle 48h ──────────────────────────────
        if (hasAssigned && thread.last_message_at) {
          const lastMsg = new Date(thread.last_message_at);
          if (lastMsg >= thresholdDate) {
            // Ativo recentemente — skip
            continue;
          }

          // Delay para evitar rate limit nas queries de WorkQueueItem
          await new Promise(r => setTimeout(r, 200));

          // Verificar se já existe item na fila
          const existingItems = await base44.asServiceRole.entities.WorkQueueItem.filter({
            contact_id: thread.contact_id,
            status: { $in: ['open', 'in_progress'] }
          }, '-created_date', 1);

          if (existingItems.length > 0) {
            const item = existingItems[0];
            if (item.thread_id !== thread.id) {
              await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
                reason: 'idle_48h',
                thread_id: thread.id,
                severity: 'high'
              });
            }
            continue;
          }

          await base44.asServiceRole.entities.WorkQueueItem.create({
            contact_id: thread.contact_id,
            thread_id: thread.id,
            tipo: 'idle_reativacao',
            reason: 'idle_48h',
            severity: 'high',
            owner_sector_id: thread.sector_id || 'geral',
            owner_user_id: thread.assigned_user_id,
            status: 'open'
          });

          console.log('[WATCHDOG v2] Tipo C alertado:', thread.id);
          results.tipoC_alertados++;
        }

      } catch (error) {
        console.error('[WATCHDOG v2] Erro thread:', thread.id, error.message);
        results.errors.push({ thread_id: thread.id, error: error.message });
      }
    }

    console.log('[WATCHDOG v2] Concluído:', results);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: results,
      threshold_48h: thresholdISO
    });

  } catch (error) {
    console.error('[WATCHDOG v2] Erro geral:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});