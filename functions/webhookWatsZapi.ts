import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔗 WEBHOOK Z-API - RECEPÇÃO DE EVENTOS DO WHATSAPP
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Processa eventos do Z-API:
 * - ReceivedCallback: Mensagens recebidas
 * - MessageStatusCallback: Status de leitura/entrega
 * - PresenceChatCallback: Indicadores de digitação
 * ═══════════════════════════════════════════════════════════════════════════════
 */

Deno.serve(async (req) => {
  try {
    // Health check GET
    if (req.method === 'GET') {
      return Response.json({
        status: 'ok',
        service: 'webhookWatsZapi',
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }

    // POST - processar eventos
    if (req.method !== 'POST') {
      return Response.json({ error: 'Método não permitido' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    let payload;

    try {
      payload = await req.json();
    } catch (e) {
      console.error('[webhookWatsZapi] Erro ao parsear JSON:', e);
      return Response.json({ error: 'JSON inválido' }, { status: 400 });
    }

    console.log('[webhookWatsZapi] 📥 Evento recebido:', {
      type: payload.type,
      phone: payload.phone,
      instanceId: payload.instanceId,
      timestamp: new Date().toISOString()
    });

    // ✅ Validação básica
    if (!payload || !payload.instanceId) {
      return Response.json({ 
        error: 'Payload inválido - falta instanceId',
        received: Object.keys(payload || {})
      }, { status: 400 });
    }

    // Roteador por tipo de evento
    const type = payload.type;

    // Ignorar eventos de sistema
    if (type === 'event_system' || type === 'PresenceChatCallback') {
      console.log(`[webhookWatsZapi] ⏭️ Ignorado: ${type}`);
      return Response.json({ status: 'ignored' }, { status: 200 });
    }

    // Processar mensagem recebida
    if (type === 'ReceivedCallback' && payload.phone && payload.text?.message) {
      try {
        console.log(`[webhookWatsZapi] 💬 Mensagem recebida de ${payload.phone}`);
        
        const { processInbound } = await import('./functions/processInbound.js');
        
        await processInbound(base44, {
          provider: 'z_api',
          instanceId: payload.instanceId,
          phoneNumber: payload.phone,
          messageId: payload.messageId,
          text: payload.text?.message,
          timestamp: payload.moment,
          senderName: payload.senderName,
          isGroup: payload.isGroup || false,
          connectedPhone: payload.connectedPhone,
          chatName: payload.chatName,
          media: payload.media,
          mediaType: payload.type_message
        });

        return Response.json({ 
          status: 'processed',
          messageId: payload.messageId 
        }, { status: 200 });
      } catch (error) {
        console.error('[webhookWatsZapi] Erro ao processar mensagem:', error);
        return Response.json({ 
          error: 'Erro ao processar mensagem',
          details: error.message 
        }, { status: 500 });
      }
    }

    // Status de leitura/entrega
    if (type === 'MessageStatusCallback') {
      console.log(`[webhookWatsZapi] 📊 Status atualizado: ${payload.status}`);
      // TODO: Atualizar status de mensagem enviada
      return Response.json({ status: 'ok' }, { status: 200 });
    }

    // Evento desconhecido
    console.log(`[webhookWatsZapi] ❓ Tipo de evento desconhecido: ${type}`);
    return Response.json({ 
      status: 'unknown_type',
      type: type 
    }, { status: 200 });

  } catch (error) {
    console.error('[webhookWatsZapi] ❌ Erro no webhook:', error);
    return Response.json({ 
      error: 'Erro interno no servidor',
      message: error.message 
    }, { status: 500 });
  }
});