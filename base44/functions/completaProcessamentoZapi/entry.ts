// ============================================================================
// completaProcessamentoZapi
// ----------------------------------------------------------------------------
// Reprocessa registros de ZapiPayloadNormalized marcados como rescue_required
// (status: sucesso_processamento=false + erro_detalhes contendo 'rescue_required').
//
// Estratégia idempotente:
//   1. Carrega o ZapiPayloadNormalized
//   2. Verifica se já existe Message com whatsapp_message_id correspondente
//      - Se existe: apenas marca payload como processado (sucesso) e sai
//      - Se NÃO existe: invoca webhookFinalZapi reenviando o payload_bruto
//        (deixando webhookFinalZapi cuidar de criar Contact/Thread/Message
//         com toda a lógica de WH-2 / WH-3 / dedup / WAL).
//   3. Re-confere se a Message foi criada e marca o payload como recuperado.
//
// Modos de operação (payload da requisição):
//   { zapiPayloadNormalizedId: "..." }   → processa 1 registro específico
//   { messageId: "3EB0..." }             → processa pelo whatsapp_message_id
//   { batch: true, limit: 20 }           → processa N órfãos mais antigos
//
// Apenas admins podem invocar.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VERSION = 'v1.0.0';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonOk(body, init = {}) {
  return Response.json(body, { status: 200, headers: corsHeaders, ...init });
}

// Marca o payload como recuperado/processado
async function marcarPayloadComoRecuperado(base44, payloadId, motivo, extras = {}) {
  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.update(payloadId, {
      sucesso_processamento: true,
      erro_detalhes: motivo,
      ...extras,
    });
    return true;
  } catch (e) {
    console.warn(`[completaProcessamentoZapi] ⚠️ Falha ao atualizar payload ${payloadId}:`, e.message);
    return false;
  }
}

// Processa UM ZapiPayloadNormalized de forma idempotente
async function processarUmPayload(base44, registroPayload, req) {
  const r = {
    payload_id: registroPayload.id,
    message_id: registroPayload.message_id || null,
    telefone: registroPayload.telefone_normalizado || null,
    status: 'pending',
    detalhes: null,
  };

  const messageId = registroPayload.message_id || registroPayload.payload_bruto?.messageId || null;

  if (!messageId) {
    r.status = 'skipped';
    r.detalhes = 'sem_message_id';
    return r;
  }

  // 1) Mensagem já existe? → idempotente, só marca como recuperado
  try {
    const jaExiste = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: messageId },
      '-created_date',
      1
    );

    if (jaExiste && jaExiste.length > 0) {
      const msg = jaExiste[0];
      await marcarPayloadComoRecuperado(
        base44,
        registroPayload.id,
        `recuperado_idempotente | message_ja_existe | msg_id=${msg.id}`,
      );
      r.status = 'already_exists';
      r.detalhes = `Message ${msg.id} já existia — payload marcado como recuperado.`;
      return r;
    }
  } catch (e) {
    console.warn(`[completaProcessamentoZapi] ⚠️ Erro ao checar Message existente:`, e.message);
  }

  // 2) Mensagem NÃO existe → reenviar payload_bruto para webhookFinalZapi
  //    Vantagem: aproveita toda a lógica oficial (Contact, Thread, WAL, dedup, WH-2).
  const payloadBruto = registroPayload.payload_bruto;
  if (!payloadBruto || typeof payloadBruto !== 'object') {
    r.status = 'error';
    r.detalhes = 'payload_bruto_invalido';
    return r;
  }

  try {
    const resp = await base44.asServiceRole.functions.invoke('webhookFinalZapi', payloadBruto);
    const respData = resp?.data || {};

    // Re-confere se a mensagem foi criada
    const reconfere = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: messageId },
      '-created_date',
      1
    );

    if (reconfere && reconfere.length > 0) {
      await marcarPayloadComoRecuperado(
        base44,
        registroPayload.id,
        `recuperado_via_webhook | msg_id=${reconfere[0].id}`,
        { integration_id: reconfere[0]?.metadata?.whatsapp_integration_id || null }
      );
      r.status = 'recovered';
      r.detalhes = `Message ${reconfere[0].id} criada pelo webhook.`;
      return r;
    }

    // Webhook respondeu, mas não criou Message (pode ter sido ignorada)
    r.status = 'webhook_skipped';
    r.detalhes = `Webhook retornou: ${JSON.stringify(respData).slice(0, 200)}`;
    return r;
  } catch (e) {
    r.status = 'error';
    r.detalhes = `Erro ao invocar webhookFinalZapi: ${e.message}`;
    return r;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);

    // 🔒 Apenas admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json(
        { success: false, error: 'Acesso negado. Apenas administradores.' },
        { status: 403, headers: corsHeaders }
      );
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      // sem body → modo batch padrão pequeno
      body = { batch: true, limit: 5 };
    }

    const { zapiPayloadNormalizedId, messageId, batch, limit } = body;

    // -------- MODO 1: Por ID específico --------
    if (zapiPayloadNormalizedId) {
      const registro = await base44.asServiceRole.entities.ZapiPayloadNormalized.get(zapiPayloadNormalizedId);
      if (!registro) {
        return jsonOk({ success: false, error: 'ZapiPayloadNormalized não encontrado' });
      }
      const resultado = await processarUmPayload(base44, registro, req);
      return jsonOk({ success: true, modo: 'por_id', resultado });
    }

    // -------- MODO 2: Por whatsapp_message_id --------
    if (messageId) {
      const registros = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
        { message_id: messageId },
        '-created_date',
        5
      );
      if (!registros || registros.length === 0) {
        return jsonOk({ success: false, error: 'Nenhum ZapiPayloadNormalized com este message_id' });
      }
      const resultados = [];
      for (const reg of registros) {
        resultados.push(await processarUmPayload(base44, reg, req));
      }
      return jsonOk({ success: true, modo: 'por_message_id', total: resultados.length, resultados });
    }

    // -------- MODO 3: Batch dos mais antigos com rescue_required --------
    if (batch === true || batch === undefined) {
      const max = Math.min(Math.max(parseInt(limit) || 5, 1), 50);
      const orfaos = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
        {
          sucesso_processamento: false,
          erro_detalhes: { $regex: 'rescue_required' },
        },
        'created_date', // mais antigos primeiro
        max
      );

      const resultados = [];
      for (const reg of orfaos) {
        const r = await processarUmPayload(base44, reg, req);
        resultados.push(r);
        // Pequena pausa para não saturar o webhook
        await new Promise((res) => setTimeout(res, 250));
      }

      const stats = resultados.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});

      return jsonOk({
        success: true,
        modo: 'batch',
        version: VERSION,
        total: resultados.length,
        stats,
        resultados,
      });
    }

    return jsonOk({ success: false, error: 'Nenhum modo válido informado' });
  } catch (error) {
    console.error('[completaProcessamentoZapi] ❌ Erro:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});