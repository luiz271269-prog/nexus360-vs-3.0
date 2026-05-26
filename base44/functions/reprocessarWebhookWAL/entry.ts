// ============================================================================
// WORKER: REPROCESSAR WEBHOOK WAL
// ============================================================================
// Lê WebhookInboundWAL com status=pending e next_attempt_at <= now.
// Re-invoca webhookFinalZapi (ou webhookWapi) com o payload bruto.
// Idempotente via whatsapp_message_id (o próprio webhook deduplica).
// Backoff exponencial: 2^tentativas minutos.
// Admin-only.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VERSION = 'v1.0.0';
const BATCH_LIMIT = 50;
const MAX_DEFAULT = 5;

function nextAttemptDate(tentativas) {
  // backoff 2^n minutos: 1min, 2min, 4min, 8min, 16min, 32min...
  const minutos = Math.min(Math.pow(2, tentativas), 60);
  return new Date(Date.now() + minutos * 60_000).toISOString();
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ success: false, error: 'forbidden_admin_only' }, { status: 403 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(body.limit || BATCH_LIMIT, 100);
    const dryRun = body.dry_run === true;

    const agora = new Date().toISOString();

    // Buscar WALs elegíveis: pending + next_attempt_at <= agora (ou null)
    const pendingTodos = await base44.asServiceRole.entities.WebhookInboundWAL.filter(
      { status: 'pending' },
      'created_date',
      limit * 2 // pega o dobro porque pode filtrar próximo passo
    );

    const elegiveis = pendingTodos.filter(w => !w.next_attempt_at || w.next_attempt_at <= agora).slice(0, limit);

    console.log(`[WAL-WORKER ${VERSION}] 📊 pending=${pendingTodos.length} elegíveis=${elegiveis.length} dry_run=${dryRun}`);

    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        pending_total: pendingTodos.length,
        elegiveis: elegiveis.length,
        amostra: elegiveis.slice(0, 5).map(w => ({
          id: w.id,
          provider: w.provider,
          message_id: w.message_id,
          tentativas: w.tentativas,
          evento_tipo: w.evento_tipo
        }))
      });
    }

    const resultados = { total: elegiveis.length, processed: 0, failed: 0, retry: 0, skipped: 0 };

    for (const wal of elegiveis) {
      // Marcar como processing (otimista — se concorrente pegar, dedup do webhook protege)
      try {
        await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
          status: 'processing',
          last_attempt_at: agora,
          tentativas: (wal.tentativas || 0) + 1
        });
      } catch (e) {
        console.warn(`[WAL-WORKER] update→processing falhou para ${wal.id}: ${e.message}`);
        resultados.skipped++;
        continue;
      }

      // Idempotência: se já existe Message com este whatsapp_message_id, marcar como processed
      if (wal.message_id) {
        try {
          const existente = await base44.asServiceRole.entities.Message.filter(
            { whatsapp_message_id: wal.message_id }, '-created_date', 1
          );
          if (existente?.length > 0) {
            await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
              status: 'processed',
              processed_message_id: existente[0].id,
              erro_ultimo: 'recovered_by_dedup_check'
            });
            resultados.processed++;
            continue;
          }
        } catch (e) {
          console.warn(`[WAL-WORKER] dedup check falhou para ${wal.message_id}: ${e.message}`);
        }
      }

      // Re-invocar o webhook correspondente
      const funcAlvo = wal.provider === 'w_api' ? 'webhookWapi' : 'webhookFinalZapi';
      const novasTentativas = (wal.tentativas || 0) + 1;
      const maxT = wal.max_tentativas || MAX_DEFAULT;

      try {
        const ret = await base44.asServiceRole.functions.invoke(funcAlvo, wal.payload_bruto);
        const sucesso = ret?.status === 200 || (ret?.data?.success === true && !ret?.data?.error);

        if (sucesso) {
          let novoMessageId = null;
          if (wal.message_id) {
            try {
              const m = await base44.asServiceRole.entities.Message.filter(
                { whatsapp_message_id: wal.message_id }, '-created_date', 1
              );
              if (m?.length > 0) novoMessageId = m[0].id;
            } catch { /* não-bloqueante */ }
          }
          await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
            status: 'processed',
            processed_message_id: novoMessageId,
            erro_ultimo: null
          });
          resultados.processed++;
        } else {
          // Re-tentar ou falhar definitivamente
          if (novasTentativas >= maxT) {
            await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
              status: 'failed',
              erro_ultimo: `max_tentativas_excedidas | última: ${JSON.stringify(ret?.data || ret).substring(0, 200)}`
            });
            resultados.failed++;
          } else {
            await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
              status: 'pending',
              next_attempt_at: nextAttemptDate(novasTentativas),
              erro_ultimo: `retry_pending | ${JSON.stringify(ret?.data || ret).substring(0, 200)}`
            });
            resultados.retry++;
          }
        }
      } catch (err) {
        if (novasTentativas >= maxT) {
          await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
            status: 'failed',
            erro_ultimo: `exception_max | ${err.message?.substring(0, 200)}`
          });
          resultados.failed++;
        } else {
          await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
            status: 'pending',
            next_attempt_at: nextAttemptDate(novasTentativas),
            erro_ultimo: `exception | ${err.message?.substring(0, 200)}`
          });
          resultados.retry++;
        }
      }
    }

    console.log(`[WAL-WORKER ${VERSION}] ✅ resultados=${JSON.stringify(resultados)}`);

    return Response.json({ success: true, version: VERSION, resultados });

  } catch (error) {
    console.error('[WAL-WORKER] ❌ erro crítico:', error?.message);
    return Response.json({ success: false, error: error?.message }, { status: 500 });
  }
});