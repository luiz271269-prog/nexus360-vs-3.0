import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ============================================================================
// CRON — PROMOÇÕES BATCH 36h (v6.2 — delega ao motor único)
// ============================================================================
// Executa diariamente. Busca threads com 36h+ de inatividade e inbound nos
// últimos 7 dias (lista quente Meta). Delega ao motor único enviarPromocao.
//
// ARQUITETURA (Fase 2 conclusão): chama enviarPromocao DIRETO (sem passar
// pelo skillPromocoes.sugerir_ou_enviar). O gestor existe para o pré-atendimento
// e chamadores ad-hoc que precisam mapear contexto → trigger. Crons já têm
// tudo definido — passar pelo gestor só agrega latência e risco de 429.
// ============================================================================

const VERSION = 'v6.2-MOTOR-UNICO-DIRETO';
const BATCH_LIMIT = 15;          // max envios por ciclo (1h = 15 envios × 1.5s + overhead)
const MAX_RUNTIME_MS = 45_000;   // abort antes do timeout de 60s da plataforma

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

    // Carregar apenas integrações com token ativo (evita 403 em massa)
    const integracoesAtivas = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
    const integIdsAtivos = new Set(integracoesAtivas.map(i => i.id));
    if (!integIdsAtivos.size) {
      return Response.json({ success: true, sent: 0, reason: 'no_active_integrations' });
    }

    const trintaSeisHorasAtras = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
    const seteDiasAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const threadsRaw = await base44.asServiceRole.entities.MessageThread.filter({
      last_message_at: { $lte: trintaSeisHorasAtras },
      last_inbound_at: { $gte: seteDiasAtras },
      thread_type: 'contact_external'
    }, '-last_message_at', 200);

    // Filtrar threads com integração ativa (evita 403 em massa por token inválido)
    const threads = threadsRaw.filter(t => !t.whatsapp_integration_id || integIdsAtivos.has(t.whatsapp_integration_id));

    console.log(`[PROMO-BATCH] ${threads.length} threads elegíveis (${threadsRaw.length - threads.length} descartadas — integração inativa)`);
    if (!threads.length) return Response.json({ success: true, sent: 0, reason: 'no_eligible_threads' });

    let sent = 0, skipped = 0, errors = 0;
    const reasons = {};
    const startTime = Date.now();

    for (const thread of threads) {
      if (sent >= BATCH_LIMIT) break;
      // Abort se estiver próximo do timeout da plataforma
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.warn('[PROMO-BATCH] ⏱️ Tempo máximo atingido — abortando ciclo. Próximo cron retoma.');
        reasons['timeout_abort'] = 1;
        break;
      }

      // Guard: pular threads sem contact_id (contatos deletados causam 404 → exceção)
      if (!thread.contact_id) {
        skipped++;
        reasons['no_contact_id'] = (reasons['no_contact_id'] || 0) + 1;
        continue;
      }

      try {
        const resp = await base44.asServiceRole.functions.invoke('enviarPromocao', {
          contact_id: thread.contact_id,
          thread_id: thread.id,
          integration_id: thread.whatsapp_integration_id,
          trigger: 'batch_36h',
          initiated_by: 'cron:runPromotionBatchTick'
        });

        // ABORTAR ciclo se motor sinalizou rate limit (SDK Base44 sob pressão)
        if (resp?.data?.status === 'rate_limited' || resp?.status === 429) {
          console.warn('[PROMO-BATCH] ⏸️ Rate limit — abortando ciclo. Próximo cron retoma.');
          reasons['rate_limited_abort'] = (reasons['rate_limited_abort'] || 0) + 1;
          break;
        }

        if (resp?.data?.success) {
          sent++;
        } else if (resp?.data?.status === 'bloqueada') {
          skipped++;
          reasons[resp.data.reason || 'unknown'] = (reasons[resp.data.reason || 'unknown'] || 0) + 1;
        } else {
          errors++;
          reasons['error'] = (reasons['error'] || 0) + 1;
        }

        // Delay 3s entre invocações — evita rate limit 403 do SDK Base44 em function-to-function
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        const is429 = e?.status === 429 || /rate limit|429/i.test(e?.message || '');
        const is403 = e?.status === 403 || /403/i.test(e?.message || '');
        if (is429 || is403) {
          console.warn(`[PROMO-BATCH] ⏸️ ${is403 ? '403' : '429'} capturado — abortando ciclo. Próximo cron retoma.`);
          reasons[is403 ? 'rate_limit_403_abort' : 'rate_limited_exception'] = (reasons['rate_limit_403_abort'] || 0) + 1;
          break;
        }
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