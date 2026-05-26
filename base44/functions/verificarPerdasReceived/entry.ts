// ============================================================================
// VERIFICAR PERDAS — busca ReceivedCallback sem Message correspondente
// ============================================================================
// Admin-only.
// Varre ZapiPayloadNormalized últimas N horas (default 24h) com:
//   evento=ReceivedCallback + payload_bruto.fromMe=false + message_id != null
// Cruza com Message.whatsapp_message_id. Retorna órfãs.
// Opcional: action=inject_wal → cria WAL pending para cada órfã (reprocessamento).
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VERSION = 'v1.0.0';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ success: false, error: 'forbidden_admin_only' }, { status: 403 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const horas = Math.min(body.horas || 24, 168); // máx 7 dias
    const acao = body.action || 'list'; // 'list' | 'inject_wal'
    const provider = body.provider || null; // 'z_api' | 'w_api' | null

    const desde = new Date(Date.now() - horas * 3600_000).toISOString();

    // Buscar audits do período — não filtrar fromMe direto (está em payload_bruto), filtrar em JS
    const filtroAudit = {
      evento: 'ReceivedCallback',
      timestamp_recebido: { $gte: desde }
    };
    if (provider) filtroAudit.provider = provider;

    const audits = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      filtroAudit,
      '-timestamp_recebido',
      500
    );

    // Filtrar só inbound real (fromMe=false) com message_id
    const candidatos = audits.filter(a => {
      const pb = a.payload_bruto || {};
      return pb.fromMe !== true && a.message_id;
    });

    console.log(`[VERIFICAR-PERDAS ${VERSION}] audits=${audits.length} candidatos=${candidatos.length}`);

    // Coletar todos message_ids para cruzar em lote
    const msgIds = [...new Set(candidatos.map(c => c.message_id).filter(Boolean))];
    const orfas = [];

    // Cruzamento em batches de 50
    const BATCH = 50;
    const idsExistentes = new Set();
    for (let i = 0; i < msgIds.length; i += BATCH) {
      const slice = msgIds.slice(i, i + BATCH);
      try {
        const found = await base44.asServiceRole.entities.Message.filter(
          { whatsapp_message_id: { $in: slice } }, '-created_date', BATCH
        );
        found.forEach(m => idsExistentes.add(m.whatsapp_message_id));
      } catch (e) {
        console.warn(`[VERIFICAR-PERDAS] batch ${i} falhou: ${e.message}`);
      }
    }

    for (const c of candidatos) {
      if (!idsExistentes.has(c.message_id)) {
        const pb = c.payload_bruto || {};
        orfas.push({
          audit_id: c.id,
          message_id: c.message_id,
          telefone: pb.phone || pb.from || null,
          sender_name: pb.senderName || pb.chatName || null,
          conteudo_preview: (pb.text?.message || pb.body || pb.msgContent?.conversation || '').substring(0, 120),
          timestamp: c.timestamp_recebido,
          provider: c.provider,
          erro_anterior: c.erro_detalhes || null
        });
      }
    }

    let injetadas = 0;
    if (acao === 'inject_wal' && orfas.length > 0) {
      // Verificar WAL existente para não duplicar
      const walExistentes = await base44.asServiceRole.entities.WebhookInboundWAL.filter(
        { message_id: { $in: orfas.map(o => o.message_id) } },
        '-created_date',
        orfas.length
      );
      const idsComWal = new Set(walExistentes.map(w => w.message_id));

      for (const orfa of orfas) {
        if (idsComWal.has(orfa.message_id)) continue;
        const audit = candidatos.find(c => c.id === orfa.audit_id);
        if (!audit) continue;
        try {
          await base44.asServiceRole.entities.WebhookInboundWAL.create({
            provider: orfa.provider || 'z_api',
            message_id: orfa.message_id,
            payload_bruto: audit.payload_bruto,
            evento_tipo: 'ReceivedCallback',
            telefone_origem: orfa.telefone,
            integration_id: audit.integration_id || null,
            status: 'pending',
            tentativas: 0,
            max_tentativas: 5,
            next_attempt_at: new Date().toISOString()
          });
          injetadas++;
        } catch (e) {
          console.warn(`[VERIFICAR-PERDAS] inject_wal falhou ${orfa.message_id}: ${e.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      version: VERSION,
      horas,
      action: acao,
      total_audits: audits.length,
      total_candidatos: candidatos.length,
      total_orfas: orfas.length,
      wals_injetadas: injetadas,
      orfas: orfas.slice(0, 200)
    });

  } catch (error) {
    console.error('[VERIFICAR-PERDAS] erro:', error?.message);
    return Response.json({ success: false, error: error?.message }, { status: 500 });
  }
});