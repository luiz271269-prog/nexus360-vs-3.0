import { createClient } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// WATCHDOG v3.1 - Monitoramento PROATIVO de threads sem resposta humana
// ============================================================================
// Tipo A: sem atendente + state=INIT/null + idle >30min → DISPARA preAtendimento
// Tipo B: sem atendente + URA em andamento (WAITING_*) → skip
// Tipo C: tem atendente + idle >4h + humano dormindo → DISPARA preAtendimento
// Tipo D: tem atendente + idle >48h → WorkQueueItem para Jarvis
// 
// ✅ FIX: Timeout de CPU 40s, batch 50 threads, parallelismo, sem delays, contexto agendado
// ============================================================================

const IDLE_THRESHOLD_A_MINUTES = 30;
const IDLE_THRESHOLD_C_HOURS = 4;
const IDLE_THRESHOLD_D_HOURS = 48;
const MAX_CICLO_MS = 40_000; // 40s máximo para não estourar 90s timeout
const MAX_THREADS_BATCH = 50; // Reduzido de 200 para 50

function humanoAtivo(thread, horasStale = 2) {
  if (!thread.last_human_message_at) return false;
  const hoursGap = (Date.now() - new Date(thread.last_human_message_at).getTime()) / (1000 * 60 * 60);
  return hoursGap < horasStale;
}

function isWithinBusinessHours() {
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dia = brasilia.getUTCDay();
  const minutos = brasilia.getUTCHours() * 60 + brasilia.getUTCMinutes();
  if (dia === 0) return false;
  if (dia >= 1 && dia <= 5) return minutos >= 480 && minutos < 1080;
  if (dia === 6) return minutos >= 480 && minutos < 720;
  return false;
}

Deno.serve(async (req) => {
  const tsInicio = Date.now();
  
  try {
    // ✅ FIX: Em contexto agendado, req vem vazio
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (e) {
      console.log('[WATCHDOG v3] Contexto agendado detectado, usando createClient()');
      base44 = createClient();
    }

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

    // ✅ FIX: Buscar apenas batch pequeno, sorted por last_message_at (idle threads primeiro)
    const allThreads = await base44.asServiceRole.entities.MessageThread.filter({
      thread_type: 'contact_external',
      status: 'aberta',
      contact_id: { $ne: null }
    }, '-last_message_at', MAX_THREADS_BATCH);

    console.log(`[WATCHDOG v3] 📊 ${allThreads.length} threads externas abertas (limite ${MAX_THREADS_BATCH})`);

    const results = {
      tipoA_ura_disparada: 0,
      tipoB_skipped: 0,
      tipoC_reativada: 0,
      tipoD_alertados: 0,
      errors: []
    };

    // ✅ FIX: Loop com timeout guard e paralelismo
    for (const thread of allThreads) {
      // Guard: não ultrapassar tempo máximo
      if (Date.now() - tsInicio > MAX_CICLO_MS) {
        console.warn(`[WATCHDOG v3] ⏱️ Timeout de ${MAX_CICLO_MS}ms atingido — abortando loop`);
        break;
      }

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
        if (!hasAssigned && !dentrodoHorario) {
          if (thread.routing_stage !== 'WAITING_BUSINESS_HOURS') {
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
              routing_stage: 'WAITING_BUSINESS_HOURS'
            }).catch(() => {});
          }
          results.tipoB_skipped++;
          continue;
        }

        if (!hasAssigned) {
          const refDate = lastInboundAt || lastMsgAt;
          if (!refDate || refDate > thresholdA) {
            continue;
          }

          // ✅ FIX: Buscar Contact + Integration em paralelo
          const [contact, integracoes] = await Promise.all([
            base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null),
            thread.whatsapp_integration_id
              ? Promise.resolve([{ id: thread.whatsapp_integration_id }])
              : base44.asServiceRole.entities.WhatsAppIntegration.filter(
                  { status: 'conectado' }, '-created_date', 1
                ).catch(() => [])
          ]);

          if (!contact) continue;

          const integrationId = integracoes?.[0]?.id;
          if (!integrationId) {
            console.warn(`[WATCHDOG v3] ⚠️ Sem integração para thread ${thread.id}`);
            continue;
          }

          console.log(`[WATCHDOG v3] 🎯 Tipo A: disparando preAtendimento para ${contact.nome}`);

          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            pre_atendimento_state: 'INIT',
            pre_atendimento_ativo: true,
            pre_atendimento_timeout_at: null
          });

          // Fire-and-forget: não aguardar resposta
          base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
            thread_id: thread.id,
            contact_id: thread.contact_id,
            whatsapp_integration_id: integrationId,
            user_input: { type: 'proactive', content: '' }
          }).catch(e => console.warn(`[WATCHDOG v3] preAtendimento async falhou: ${e.message}`));

          results.tipoA_ura_disparada++;
          continue;
        }

        // ── TIPO C: tem atendente + humano dormindo >4h → reativar URA ──────
        if (!dentrodoHorario) continue;

        if (hasAssigned && !humanoAtivo(thread, IDLE_THRESHOLD_C_HOURS)) {
          if (lastInboundAt && lastInboundAt < thresholdC) {
            if (!isCompleted) {
              // ✅ FIX: Buscar Contact + Integration em paralelo
              const [contact, integracoes] = await Promise.all([
                base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null),
                thread.whatsapp_integration_id
                  ? Promise.resolve([{ id: thread.whatsapp_integration_id }])
                  : base44.asServiceRole.entities.WhatsAppIntegration.filter(
                      { status: 'conectado' }, '-created_date', 1
                    ).catch(() => [])
              ]);

              if (!contact) continue;

              const integrationId = integracoes?.[0]?.id;
              if (!integrationId) continue;

              console.log(`[WATCHDOG v3] 🔄 Tipo C: reativando URA (${IDLE_THRESHOLD_C_HOURS}h inativo) para ${contact.nome}`);

              await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                pre_atendimento_state: 'INIT',
                pre_atendimento_ativo: true,
                pre_atendimento_timeout_at: null,
                assigned_user_id: null,
                sector_id: null
              });

              // Fire-and-forget
              base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
                thread_id: thread.id,
                contact_id: thread.contact_id,
                whatsapp_integration_id: integrationId,
                user_input: { type: 'proactive', content: '' }
              }).catch(e => console.warn(`[WATCHDOG v3] preAtendimento async falhou: ${e.message}`));

              results.tipoC_reativada++;
              continue;
            }
          }
        }

        // ── TIPO D: tem atendente + idle >48h → WorkQueueItem ────────────────
        if (hasAssigned && lastMsgAt && lastMsgAt < thresholdD) {
          const existingItems = await base44.asServiceRole.entities.WorkQueueItem.filter({
            contact_id: thread.contact_id,
            status: { $in: ['open', 'in_progress'] }
          }, '-created_date', 1).catch(() => []);

          if (existingItems.length > 0) {
            const item = existingItems[0];
            if (item.thread_id !== thread.id) {
              await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
                reason: 'idle_48h',
                thread_id: thread.id,
                severity: 'high'
              }).catch(() => {});
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
          }).catch(e => console.warn(`[WATCHDOG v3] WorkQueueItem falhou: ${e.message}`));

          console.log(`[WATCHDOG v3] 📋 Tipo D: WorkQueueItem criado`);
          results.tipoD_alertados++;
        }

      } catch (error) {
        console.error(`[WATCHDOG v3] ❌ Erro thread ${thread.id}:`, error.message);
        results.errors.push({ thread_id: thread.id, error: error.message });
      }
    }

    const duracao = Date.now() - tsInicio;
    console.log(`[WATCHDOG v3] ✅ Concluído em ${duracao}ms:`, results);

    return Response.json({
      success: true,
      timestamp: agora.toISOString(),
      summary: results,
      duration_ms: duracao
    });

  } catch (error) {
    console.error('[WATCHDOG v3] ❌ Erro geral:', error.message);
    return Response.json(
      { success: false, error: error.message, duration_ms: Date.now() - tsInicio },
      { status: 500 }
    );
  }
});