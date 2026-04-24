import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ============================================================================
// CRON — PROMOÇÕES BATCH 36h (v6.0 — delega ao motor único)
// ============================================================================
// Executa diariamente. Busca threads com 36h+ de inatividade e inbound nos
// últimos 7 dias (lista quente Meta). Delega ao motor único enviarPromocao.
// ============================================================================

const VERSION = 'v6.0-MOTOR-UNICO';
const BATCH_LIMIT = 50;

async function carregarBroadcastConfig(base44) {
  const defaults = { horario_inicio: 8, horario_fim: 20, enviar_fim_semana: false };
  try {
    const lista = await base44.asServiceRole.entities.BroadcastConfig.filter({ nome_config: 'default', ativo: true });
    if (lista.length > 0) return { ...defaults, ...lista[0] };
  } catch (_) {}
  return defaults;
}

function estaNoHorarioComercial(cfg) {
  const brt = new Date(Date.now() - 3 * 3600000);
  const hora = brt.getUTCHours();
  const dow = brt.getUTCDay();
  if (!cfg.enviar_fim_semana && (dow === 0 || dow === 6)) return false;
  return hora >= cfg.horario_inicio && hora < cfg.horario_fim;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();

  try {
    console.log(`[PROMO-BATCH ${VERSION}] Iniciando...`);

    const cfg = await carregarBroadcastConfig(base44);
    if (!estaNoHorarioComercial(cfg)) {
      return Response.json({ success: true, sent: 0, reason: 'fora_horario_comercial' });
    }

    // Verificar se há promoções 36h/massblast ativas
    const promosBatch = await base44.asServiceRole.entities.Promotion.filter({ ativo: true });
    const validBatch = (promosBatch || []).filter(p => ['36h', 'massblast', '24h', '12h'].includes(p.stage));
    if (!validBatch.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_active_batch_promos' });
    }

    const trintaSeisHorasAtras = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
    const seteDiasAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      last_message_at: { $lte: trintaSeisHorasAtras },
      last_inbound_at: { $gte: seteDiasAtras },
      thread_type: 'contact_external'
    }, '-last_message_at', 200);

    console.log(`[PROMO-BATCH] ${threads.length} threads elegíveis`);
    if (!threads.length) return Response.json({ success: true, sent: 0, reason: 'no_eligible_threads' });

    let sent = 0, skipped = 0, errors = 0;
    const reasons = {};

    for (const thread of threads) {
      if (sent >= BATCH_LIMIT) break;

      try {
        const resp = await base44.asServiceRole.functions.invoke('enviarPromocao', {
          contact_id: thread.contact_id,
          thread_id: thread.id,
          integration_id: thread.whatsapp_integration_id,
          trigger: 'batch_36h',
          initiated_by: 'cron:runPromotionBatchTick'
        });

        if (resp?.data?.success) {
          sent++;
        } else if (resp?.data?.status === 'bloqueada') {
          skipped++;
          reasons[resp.data.reason || 'unknown'] = (reasons[resp.data.reason || 'unknown'] || 0) + 1;
        } else {
          errors++;
          reasons['error'] = (reasons['error'] || 0) + 1;
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        errors++;
        reasons['exception'] = (reasons['exception'] || 0) + 1;
        console.error('[PROMO-BATCH] ❌', e.message);
      }
    }

    console.log('[PROMO-BATCH] Concluído:', { sent, skipped, errors, reasons });
    return Response.json({ success: true, sent, skipped, errors, reasons, timestamp: now.toISOString() });

  } catch (e) {
    console.error('[PROMO-BATCH] ERRO GERAL:', e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});