// ============================================================================
// WORKER: REPROCESSAR WEBHOOK WAL
// ============================================================================
// Lê WebhookInboundWAL com status=pending e next_attempt_at <= now.
// Reenvia para endpoint HTTP do webhook (simula provedor externo) com payload bruto.
// Idempotente via whatsapp_message_id (o próprio webhook deduplica).
// Backoff exponencial: 2^tentativas minutos.
// Admin-only.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const VERSION = 'v1.5.0';
// 🔧 Vazão vs tempo de execução: 15 itens/execução estourava o limite de tempo
// (runs de 127s–303s → 502 no meio do lote, itens presos em 'processing' e
// 'tentativas' inflando sem drenar). 3 é o maior lote que cabe com folga.
const BATCH_LIMIT = 3;
// Medição real: cada item custa ~16s (o fetch reprocessa o webhook inteiro —
// contato, thread, mensagem, mídia). A checagem de orçamento ocorre ENTRE itens,
// então o orçamento precisa deixar folga de um item inteiro: com 20s, o worker
// nunca entra num item novo depois dos 20s e encerra por volta dos 36s.
const TIME_BUDGET_MS = 20_000;
const ORFAO_TIMEOUT_MS = 15 * 60_000;
const MAX_DEFAULT = 5;
const APP_BASE_URL = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions';

function resolveWebhookBaseUrl(body) {
  const fromBody = String(body?.webhook_base_url || '').trim();
  if (fromBody) return fromBody.replace(/\/$/, '');
  return APP_BASE_URL;
}

// Provider desconhecido NÃO cai mais em ZAPI por omissão: retorna null e o item
// é marcado 'failed' com motivo explícito, em vez de replay no endpoint errado.
function getWebhookUrl(provider, webhookBaseUrl) {
  const p = String(provider || '').toLowerCase();
  if (p === 'w_api' || p === 'w_api_integrator') return `${webhookBaseUrl}/webhookWapi`;
  if (p === 'z_api') return `${webhookBaseUrl}/webhookFinalZapi`;
  return null;
}

// Timestamps do Base44 chegam sem 'Z'. Date.parse os interpretaria como horário
// LOCAL do runtime, deslocando comparações de backoff/órfão em horas.
function parseBase44Date(value) {
  if (!value) return NaN;
  const s = String(value);
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);
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
    // Cron/automação roda sem usuário; chamada manual exige admin (mesmo padrão do recuperarMidiaWapiPendente).
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ success: false, error: 'forbidden_admin_only' }, { status: 403 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    // Limite seguro: valores negativos/NaN faziam slice(0, -1) pegar quase todos
    // os elegíveis e estourar o timeout. Sempre entre 1 e BATCH_LIMIT.
    const rawLimit = Number.parseInt(String(body.limit ?? BATCH_LIMIT), 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : BATCH_LIMIT, 1), BATCH_LIMIT);
    const dryRun = body.dry_run === true;
    // Override de destino do replay é privilégio de admin: caller anônimo não pode
    // redirecionar payloads brutos para endpoint externo.
    const webhookBaseUrl = user?.role === 'admin' ? resolveWebhookBaseUrl(body) : APP_BASE_URL;

    const agora = new Date().toISOString();

    // 🔧 RESGATE DE ÓRFÃOS: execuções que morreram (502/timeout) deixam registros
    // presos em 'processing' para sempre. Devolve para 'pending' os que não têm
    // sinal de vida há mais de 15min. Comparação NUMÉRICA (timestamps sem 'Z'
    // quebram comparação textual). 'tentativas' é preservado para auditoria.
    const agoraMs = Date.now();
    try {
      const travados = await base44.asServiceRole.entities.WebhookInboundWAL.filter(
        { status: 'processing' }, 'created_date', 100
      );
      let resgatados = 0;
      for (const w of travados) {
        const refMs = parseBase44Date(w.last_attempt_at || w.updated_date);
        if (!Number.isFinite(refMs) || (agoraMs - refMs) <= ORFAO_TIMEOUT_MS) continue;
        await base44.asServiceRole.entities.WebhookInboundWAL.update(w.id, {
          status: 'pending',
          next_attempt_at: new Date(agoraMs).toISOString(),
          erro_ultimo: 'processing_orfao_resgatado'
        });
        resgatados++;
      }
      if (resgatados > 0) console.log(`[WAL-WORKER] ♻️ órfãos resgatados: ${resgatados}`);
    } catch (e) {
      console.warn(`[WAL-WORKER] resgate de órfãos falhou: ${e.message}`);
    }

    // Buscar WALs elegíveis: pending + next_attempt_at <= agora (ou null)
    // 🔧 ANTI HEAD-OF-LINE BLOCKING: busca uma janela AMPLA e só depois aplica o
    // limite. Antes buscava limit*2 ordenado por created_date ASC — a janela enchia
    // de itens em backoff (next_attempt_at futuro) e o worker nunca alcançava os
    // pendentes elegíveis mais novos, travando a fila indefinidamente.
    const pendingTodos = await base44.asServiceRole.entities.WebhookInboundWAL.filter(
      { status: 'pending' },
      'created_date',
      200
    );

    // Comparação NUMÉRICA (timestamps gravados sem 'Z' quebram comparação textual).
    const elegiveis = pendingTodos.filter(w => {
      if (!w.next_attempt_at) return true;
      const t = parseBase44Date(w.next_attempt_at);
      return !Number.isFinite(t) || t <= agoraMs;
    }).slice(0, limit);

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

    const resultados = { total: elegiveis.length, processed: 0, failed: 0, retry: 0, skipped: 0, abortado_por_tempo: false };

    for (const wal of elegiveis) {
      // Para antes de ser morto pela plataforma: o item não tocado permanece
      // 'pending' e é retomado na próxima execução do cron.
      if (Date.now() - agoraMs > TIME_BUDGET_MS) {
        resultados.abortado_por_tempo = true;
        console.log(`[WAL-WORKER ${VERSION}] ⏱️ orçamento de tempo atingido — encerrando lote`);
        break;
      }

      // Provider inválido/ausente: falha explícita, sem replay às cegas na ZAPI.
      const webhookUrlValidado = getWebhookUrl(wal.provider, webhookBaseUrl);
      if (!webhookUrlValidado) {
        await base44.asServiceRole.entities.WebhookInboundWAL.update(wal.id, {
          status: 'failed',
          erro_ultimo: `provider_desconhecido: ${String(wal.provider || 'null')}`
        });
        resultados.failed++;
        continue;
      }

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
      const webhookUrl = webhookUrlValidado;
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