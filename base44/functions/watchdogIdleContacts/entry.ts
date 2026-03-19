import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// WATCHDOG v3.0 - Monitoramento PROATIVO de threads sem resposta humana
// ============================================================================
// Tipo A: sem atendente + state=INIT/null + idle >30min → DISPARA preAtendimento
// Tipo B: sem atendente + URA em andamento (WAITING_*) → skip
// Tipo C: tem atendente + idle >4h + humano dormindo → DISPARA preAtendimento
// Tipo D: tem atendente + idle >48h → WorkQueueItem para Jarvis
// ============================================================================

const IDLE_THRESHOLD_A_MINUTES = 30;   // 30min sem resposta → ativa URA
const IDLE_THRESHOLD_C_HOURS = 4;      // 4h com atendente dormindo → reativa URA
const IDLE_THRESHOLD_D_HOURS = 48;     // 48h → cria WorkQueueItem

function humanoAtivo(thread, horasStale = 2) {
  if (!thread.last_human_message_at) return false;
  const hoursGap = (Date.now() - new Date(thread.last_human_message_at).getTime()) / (1000 * 60 * 60);
  return hoursGap < horasStale;
}

// Guard: só dispara URA dentro do horário comercial (Brasília = UTC-3)
function isWithinBusinessHours() {
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dia = brasilia.getUTCDay(); // 0=dom, 6=sab
  const minutos = brasilia.getUTCHours() * 60 + brasilia.getUTCMinutes();
  if (dia === 0) return false;                                    // Domingo: fechado
  if (dia >= 1 && dia <= 5) return minutos >= 480 && minutos < 1080; // Seg-Sex: 08h-18h
  if (dia === 6) return minutos >= 480 && minutos < 720;          // Sáb: 08h-12h
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const agora = new Date();
    const thresholdA = new Date(agora.getTime() - IDLE_THRESHOLD_A_MINUTES * 60 * 1000);
    const thresholdC = new Date(agora.getTime() - IDLE_THRESHOLD_C_HOURS * 60 * 60 * 1000);
    const thresholdD = new Date(agora.getTime() - IDLE_THRESHOLD_D_HOURS * 60 * 60 * 1000);

    // ── GUARD DE HORÁRIO COMERCIAL ─────────────────────────────────────────
    // Tipo A e C disparam preAtendimento (enviam mensagem ao cliente).
    // Fora do expediente, só processa Tipo D (WorkQueueItem interno, sem msg ao cliente).
    const dentrodoHorario = isWithinBusinessHours();
    console.log(`[WATCHDOG v3] 🕐 Horário comercial: ${dentrodoHorario ? 'SIM ✅' : 'NÃO 🌙'}`);
    console.log(`[WATCHDOG v3] 🚀 Iniciando | A=>${IDLE_THRESHOLD_A_MINUTES}min | C=>${IDLE_THRESHOLD_C_HOURS}h | D=>${IDLE_THRESHOLD_D_HOURS}h`);

    // Buscar threads externas abertas com contato válido
    const allThreads = await base44.asServiceRole.entities.MessageThread.filter({
      thread_type: 'contact_external',
      status: 'aberta',
      contact_id: { $ne: null }
    }, '-last_message_at', 200);

    console.log(`[WATCHDOG v3] 📊 ${allThreads.length} threads externas abertas`);

    const results = {
      tipoA_ura_disparada: 0,
      tipoB_skipped: 0,
      tipoC_reativada: 0,
      tipoD_alertados: 0,
      errors: []
    };

    for (const thread of allThreads) {
      try {
        const hasAssigned = !!thread.assigned_user_id;
        const state = thread.pre_atendimento_state;
        const isWaiting = state && state.startsWith('WAITING_');
        const isCompleted = ['COMPLETED', 'TIMEOUT', 'CANCELLED'].includes(state);
        const lastMsgAt = thread.last_message_at ? new Date(thread.last_message_at) : null;
        const lastInboundAt = thread.last_inbound_at ? new Date(thread.last_inbound_at) : null;

        // ── TIPO B: URA em andamento → não interferir ─────────────────────
        if (isWaiting) {
          results.tipoB_skipped++;
          continue;
        }

        // ── TIPO A: sem atendente, idle >30min → disparar URA proativamente ─
        if (!hasAssigned) {
          // Verificar se última mensagem inbound está há mais de 30min
          const refDate = lastInboundAt || lastMsgAt;
          if (!refDate || refDate > thresholdA) {
            // Muito recente, ainda esperando
            continue;
          }

          // Já passou 30min sem resposta → disparar pré-atendimento
          const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
          if (!contact) continue;

          // Resolver integração
          let integrationId = thread.whatsapp_integration_id;
          if (!integrationId) {
            const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
              { status: 'conectado' }, '-created_date', 1
            );
            if (integracoes.length > 0) integrationId = integracoes[0].id;
          }

          if (!integrationId) {
            console.warn(`[WATCHDOG v3] ⚠️ Sem integração para thread ${thread.id}`);
            continue;
          }

          console.log(`[WATCHDOG v3] 🎯 Tipo A: disparando preAtendimento para ${contact.nome} (${thread.id})`);

          // Resetar estado antes de disparar
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            pre_atendimento_state: 'INIT',
            pre_atendimento_ativo: true,
            pre_atendimento_timeout_at: null
          });

          // Disparar pré-atendimento proativamente (sem aguardar inbound)
          await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
            thread_id: thread.id,
            contact_id: thread.contact_id,
            whatsapp_integration_id: integrationId,
            user_input: { type: 'proactive', content: '' }
          });

          results.tipoA_ura_disparada++;
          // Delay para não sobrecarregar
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        // ── TIPO C: tem atendente + humano dormindo >4h → reativar URA ──────
        if (hasAssigned && !humanoAtivo(thread, IDLE_THRESHOLD_C_HOURS)) {
          if (lastInboundAt && lastInboundAt < thresholdC) {
            // Só reativar se não foi completado recentemente
            if (!isCompleted) {
              const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
              if (!contact) continue;

              let integrationId = thread.whatsapp_integration_id;
              if (!integrationId) {
                const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
                  { status: 'conectado' }, '-created_date', 1
                );
                if (integracoes.length > 0) integrationId = integracoes[0].id;
              }

              if (!integrationId) continue;

              console.log(`[WATCHDOG v3] 🔄 Tipo C: reativando URA (atendente inativo ${IDLE_THRESHOLD_C_HOURS}h) para ${contact.nome}`);

              // Resetar assigned e estado para forçar novo ciclo de pré-atendimento
              await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                pre_atendimento_state: 'INIT',
                pre_atendimento_ativo: true,
                pre_atendimento_timeout_at: null,
                assigned_user_id: null,
                sector_id: null
              });

              await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
                thread_id: thread.id,
                contact_id: thread.contact_id,
                whatsapp_integration_id: integrationId,
                user_input: { type: 'proactive', content: '' }
              });

              results.tipoC_reativada++;
              await new Promise(r => setTimeout(r, 500));
              continue;
            }
          }
        }

        // ── TIPO D: tem atendente + idle >48h → WorkQueueItem ────────────────
        if (hasAssigned && lastMsgAt && lastMsgAt < thresholdD) {
          await new Promise(r => setTimeout(r, 200));

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

          console.log(`[WATCHDOG v3] 📋 Tipo D: WorkQueueItem criado para thread ${thread.id}`);
          results.tipoD_alertados++;
        }

      } catch (error) {
        console.error(`[WATCHDOG v3] ❌ Erro thread ${thread.id}:`, error.message);
        results.errors.push({ thread_id: thread.id, error: error.message });
      }
    }

    console.log('[WATCHDOG v3] ✅ Concluído:', results);

    return Response.json({
      success: true,
      timestamp: agora.toISOString(),
      summary: results
    });

  } catch (error) {
    console.error('[WATCHDOG v3] ❌ Erro geral:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});