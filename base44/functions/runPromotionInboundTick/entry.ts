import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ============================================================================
// CRON — PROMOÇÕES INBOUND 6h (v6.0 — via gestor único)
// ============================================================================
// Executa a cada 30 min. Busca threads com inbound 6-48h atrás. Para cada
// thread, chama skillPromocoes.sugerir_ou_enviar(trigger=inbound_6h).
//
// ARQUITETURA (F2-Sprint 4): este cron é dumb worker — só seleciona público.
// Toda decisão (bloqueios, cooldown, seleção de promoção, envio, auditoria)
// vive no motor enviarPromocao. O gestor skillPromocoes é o portão único.
// ============================================================================

const VERSION = 'v6.1-TIMEOUT-GUARD';
const BATCH_LIMIT = 12;           // 12 × ~4s = 48s, dentro do timeout de 60s da plataforma
const MAX_RUNTIME_MS = 50_000;   // abort gracioso antes do 504 (mesmo padrão do batch v7.0)

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
    console.log(`[PROMO-INBOUND ${VERSION}] Iniciando...`);

    const cfg = await carregarBroadcastConfig(base44);
    if (!estaNoHorarioComercial(cfg)) {
      return Response.json({ success: true, sent: 0, reason: 'fora_horario_comercial' });
    }

    // Verificar se há promoções 6h ativas antes de buscar threads
    const promos6h = await base44.asServiceRole.entities.Promotion.filter({ ativo: true, stage: '6h' });
    if (!promos6h?.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_active_6h_promos' });
    }

    const seisHorasAtras = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const quarentaOitoHorasAtras = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      last_inbound_at: { $gte: quarentaOitoHorasAtras, $lte: seisHorasAtras },
      status: 'aberta'
    }, '-last_inbound_at', 200);

    if (!threads.length) return Response.json({ success: true, sent: 0, reason: 'no_threads' });

    let sent = 0, skipped = 0, errors = 0;
    const reasons = {};
    const startTime = Date.now();

    for (const thread of threads) {
      if (sent >= BATCH_LIMIT) break;
      // Abort gracioso antes do timeout de 60s da plataforma. Próximo cron (30min) retoma threads pendentes.
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.warn('[PROMO-INBOUND] ⏱️ Tempo máximo atingido — abortando ciclo. Próximo cron retoma.');
        reasons['timeout_abort'] = (reasons['timeout_abort'] || 0) + 1;
        break;
      }

      // Já enviou promoção inbound depois da última msg do cliente?
      const lastInbound = thread.last_inbound_at ? new Date(thread.last_inbound_at) : null;
      const lastPromoInbound = thread.thread_last_promo_inbound_at ? new Date(thread.thread_last_promo_inbound_at) : null;
      if (lastPromoInbound && lastInbound && lastPromoInbound >= lastInbound) {
        skipped++;
        reasons['already_sent_after_inbound'] = (reasons['already_sent_after_inbound'] || 0) + 1;
        continue;
      }

      try {
        const resp = await base44.asServiceRole.functions.invoke('skillPromocoes', {
          action: 'sugerir_ou_enviar',
          origem: 'cron_inbound',
          contact_id: thread.contact_id,
          thread_id: thread.id,
          integration_id: thread.whatsapp_integration_id,
          trigger: 'inbound_6h',
          initiated_by: 'cron:runPromotionInboundTick'
        });

        // ABORTAR ciclo se gestor sinalizou rate limit
        if (resp?.data?.rate_limited || resp?.data?.status === 'rate_limited' || resp?.status === 429) {
          console.warn('[PROMO-INBOUND] ⏸️ Rate limit — abortando ciclo. Próximo cron retoma.');
          reasons['rate_limited_abort'] = (reasons['rate_limited_abort'] || 0) + 1;
          break;
        }

        if (resp?.data?.sent) {
          sent++;
        } else if (resp?.data?.status === 'bloqueada') {
          skipped++;
          const motivo = resp.data.motivo || 'unknown';
          reasons[motivo] = (reasons[motivo] || 0) + 1;
        } else {
          errors++;
          reasons['error'] = (reasons['error'] || 0) + 1;
        }

        // Delay 2000ms entre envios — protege SDK Base44 da cadeia invoke encadeada
        // (skillPromocoes → enviarPromocao → enviarWhatsApp). Aumentado de 1500 → 2000.
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        const is429 = e?.status === 429 || /rate limit|429/i.test(e?.message || '');
        if (is429) {
          console.warn('[PROMO-INBOUND] ⏸️ 429 capturado em exceção — abortando ciclo.');
          reasons['rate_limited_exception'] = (reasons['rate_limited_exception'] || 0) + 1;
          break;
        }
        errors++;
        reasons['exception'] = (reasons['exception'] || 0) + 1;
        console.error('[PROMO-INBOUND] ❌', e.message);
      }
    }

    console.log('[PROMO-INBOUND] Concluído:', { sent, skipped, errors, reasons });
    return Response.json({ success: true, sent, skipped, errors, reasons, timestamp: now.toISOString() });

  } catch (e) {
    console.error('[PROMO-INBOUND] ERRO GERAL:', e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});