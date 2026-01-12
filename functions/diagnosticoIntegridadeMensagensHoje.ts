import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔍 DIAGNÓSTICO DE INTEGRIDADE - MENSAGENS DE HOJE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Compara:
 * 1. ZapiPayloadNormalized (payloads recebidos dos webhooks)
 * 2. Messages (mensagens salvas no banco)
 * 
 * Identifica mensagens que chegaram ao webhook mas não foram salvas.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanh = new Date(hoje);
    amanh.setDate(amanh.getDate() + 1);

    console.log('[DIAGNÓSTICO] 🔍 Analisando integridade de mensagens...');
    console.log(`[DIAGNÓSTICO] 📅 Período: ${hoje.toISOString()} até ${amanh.toISOString()}`);

    // 1️⃣ Buscar todos os payloads normalizados de hoje (Z-API)
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter({
      created_date: { $gte: hoje.toISOString(), $lt: amanh.toISOString() }
    }, '-created_date', 1000);

    console.log(`[DIAGNÓSTICO] 📥 Total de payloads Z-API hoje: ${payloads.length}`);

    // 2️⃣ Buscar todas as Messages inbound de hoje
    const messages = await base44.asServiceRole.entities.Message.filter({
      sender_type: 'contact',
      created_date: { $gte: hoje.toISOString(), $lt: amanh.toISOString() }
    }, '-created_date', 1000);

    console.log(`[DIAGNÓSTICO] 💬 Total de Messages inbound hoje: ${messages.length}`);

    // 3️⃣ Mapa de messageIds das Messages
    const messageIds = new Set(messages.map(m => m.whatsapp_message_id).filter(Boolean));

    // 4️⃣ Buscar também por metadata.whatsapp_message_id
    const messageIdsMetadata = new Set();
    messages.forEach(m => {
      if (m.metadata?.whatsapp_message_id) {
        messageIdsMetadata.add(m.metadata.whatsapp_message_id);
      }
    });

    console.log(`[DIAGNÓSTICO] 🆔 Unique message IDs nos campos diretos: ${messageIds.size}`);
    console.log(`[DIAGNÓSTICO] 🆔 Unique message IDs em metadata: ${messageIdsMetadata.size}`);

    // 5️⃣ Identificar payloads sem Message correspondente
    const payloadsSemMessage = [];
    const payloadsComMessage = [];

    payloads.forEach(payload => {
      const payloadMessageId = payload.payload_bruto_messageId || 
                               payload.messageId || 
                               payload.payload?.messageId;
      
      if (!payloadMessageId) {
        payloadsSemMessage.push({
          ...payload,
          razao: 'messageId não encontrado no payload'
        });
        return;
      }

      if (messageIds.has(payloadMessageId) || messageIdsMetadata.has(payloadMessageId)) {
        payloadsComMessage.push(payload);
      } else {
        payloadsSemMessage.push({
          ...payload,
          payloadMessageId,
          razao: 'Message não criada para este messageId'
        });
      }
    });

    console.log(`[DIAGNÓSTICO] ✅ Payloads com Message: ${payloadsComMessage.length}`);
    console.log(`[DIAGNÓSTICO] ❌ Payloads SEM Message: ${payloadsSemMessage.length}`);

    // 6️⃣ Analisar payloads faltando
    const analise = {
      resumo: {
        total_payloads: payloads.length,
        total_messages: messages.length,
        payloads_com_message: payloadsComMessage.length,
        payloads_sem_message: payloadsSemMessage.length,
        taxa_conversao: payloads.length > 0 
          ? ((payloadsComMessage.length / payloads.length) * 100).toFixed(2) + '%'
          : '0%'
      },
      
      payloads_sem_correspondencia: payloadsSemMessage.slice(0, 50).map(p => ({
        id: p.id,
        messageId: p.payload_bruto_messageId || p.messageId,
        phone: p.payload?.phone || p.phone,
        tipo: p.payload?.type,
        created: p.created_date,
        razao: p.razao
      })),

      analise_por_provedor: {
        z_api: {
          total: payloads.filter(p => p.provider === 'z_api' || !p.provider).length,
          sem_message: payloadsSemMessage.filter(p => p.provider === 'z_api' || !p.provider).length
        },
        w_api: {
          total: payloads.filter(p => p.provider === 'w_api').length,
          sem_message: payloadsSemMessage.filter(p => p.provider === 'w_api').length
        }
      },

      analise_por_tipo: {},
      analise_por_telefone: {}
    };

    // Agrupar por tipo de evento
    payloadsSemMessage.forEach(p => {
      const tipo = p.payload?.type || 'desconhecido';
      if (!analise.analise_por_tipo[tipo]) {
        analise.analise_por_tipo[tipo] = { total: 0, sem_message: 0 };
      }
      analise.analise_por_tipo[tipo].sem_message++;
    });

    payloads.forEach(p => {
      const tipo = p.payload?.type || 'desconhecido';
      if (!analise.analise_por_tipo[tipo]) {
        analise.analise_por_tipo[tipo] = { total: 0, sem_message: 0 };
      }
      analise.analise_por_tipo[tipo].total++;
    });

    // Agrupar por telefone/número
    payloadsSemMessage.slice(0, 10).forEach(p => {
      const phone = p.payload?.phone || p.phone || 'desconhecido';
      if (!analise.analise_por_telefone[phone]) {
        analise.analise_por_telefone[phone] = [];
      }
      analise.analise_por_telefone[phone].push({
        messageId: p.payload_bruto_messageId,
        tipo: p.payload?.type,
        timestamp: p.created_date
      });
    });

    console.log('[DIAGNÓSTICO] ✅ Análise concluída');

    return Response.json(analise, { status: 200 });

  } catch (error) {
    console.error('[DIAGNÓSTICO] ❌ Erro:', error.message);
    return Response.json({ 
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    }, { status: 500 });
  }
});