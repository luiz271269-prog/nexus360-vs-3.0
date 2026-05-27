// ============================================================================
// WORKER: REPROCESSAR WEBHOOK WAL
// ============================================================================
// Lê WebhookInboundWAL com status=pending e next_attempt_at <= now.
// Reenvia para endpoint HTTP do webhook (simula provedor externo) com payload bruto.
// Idempotente via whatsapp_message_id (o próprio webhook deduplica).
// Backoff exponencial: 2^tentativas minutos.
// Admin-only.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VERSION = 'v1.1.0-http-replay';
const BATCH_LIMIT = 50;
const MAX_DEFAULT = 5;
const APP_BASE_URL = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions';

function getWebhookUrl(provider) {
  const fn = provider === 'w_api' ? 'webhookWapi' : 'webhookFinalZapi';
  return `${APP_BASE_URL}/${fn}`;
}

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

      // Reenviar para endpoint HTTP do webhook correspondente (simula chamada real do provedor)
      // — evita o 403 que ocorre via base44.asServiceRole.functions.invoke() em contexto admin.
      const webhookUrl = getWebhookUrl(wal.provider);
      const novasTentativas = (wal.tentativas || 0) + 1;
      const maxT = wal.max_tentativas || MAX_DEFAULT;

      try {
        // 🔑 SEM Authorization: simula o provedor externo (Z-API/W-API) chamando o endpoint público.
        // Com header de admin herdado, o SDK responde 403 dentro do webhook em contexto serverless.
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wal.payload_bruto || {})
        });

        let retData = null;
        try {
          retData = await resp.json();
        } catch {
          retData = null;
        }

        const sucesso = resp.ok && (retData?.success !== false);

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
              erro_ultimo: `max_tentativas_excedidas | http_${resp.status} | última: ${JSON.stringify(retData).substring(0, 200)}`
            });
            resultados.failed++;
          } else {
            await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
              status: 'pending',
              next_attempt_at: nextAttemptDate(novasTentativas),
              erro_ultimo: `retry_pending | http_${resp.status} | ${JSON.stringify(retData).substring(0, 200)}`
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