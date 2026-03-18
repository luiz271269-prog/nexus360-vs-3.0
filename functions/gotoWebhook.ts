import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * WEBHOOK GOTO
 * Recebe SMS inbound e eventos de chamada do GoTo Connect
 * Normaliza para Contact/MessageThread/Message e CallSession
 */

Deno.serve(async (req) => {
  try {
    // Verificação do webhook (GET)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const verifyToken = url.searchParams.get('verify_token');
      const expectedToken = Deno.env.get('GOTO_VERIFY_TOKEN');
      
      if (verifyToken === expectedToken) {
        return new Response('OK', { status: 200 });
      }
      
      return Response.json({ error: 'Invalid verify token' }, { status: 403 });
    }

    // Processar evento (POST)
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    console.log('[GOTO_WEBHOOK] Evento recebido:', payload);

    const eventType = payload.eventType || payload.type;

    // ═══ SMS INBOUND ═══
    if (eventType === 'message.received' || eventType === 'sms.received') {
      const senderPhone = payload.from || payload.sender;
      const messageText = payload.body || payload.text || payload.content;
      const messageId = payload.id || payload.messageId;
      const conversationId = payload.conversationId || payload.threadId;

      if (!senderPhone || !messageText) {
        console.warn('[GOTO_WEBHOOK] SMS sem dados suficientes');
        return Response.json({ received: true });
      }

      // 1) Buscar/criar Contact
      let contact = await base44.entities.Contact.filter({ telefone: senderPhone });
      if (!contact || contact.length === 0) {
        contact = await base44.entities.Contact.create({
          nome: `GoTo ${senderPhone}`,
          telefone: senderPhone,
          tipo_contato: 'novo',
          preferencias_comunicacao: {
            canal_preferido: 'phone'
          }
        });
      } else {
        contact = contact[0];
      }

      // 2) Buscar/criar MessageThread
      let thread = await base44.entities.MessageThread.filter({
        contact_id: contact.id,
        channel: 'phone'
      });

      if (!thread || thread.length === 0) {
        thread = await base44.entities.MessageThread.create({
          contact_id: contact.id,
          channel: 'phone',
          thread_type: 'contact_external',
          status: 'aberta',
          last_message_at: new Date().toISOString(),
          last_message_content: messageText.substring(0, 100),
          last_message_sender: 'contact',
          last_inbound_at: new Date().toISOString()
        });
      } else {
        thread = thread[0];
        await base44.entities.MessageThread.update(thread.id, {
          last_message_at: new Date().toISOString(),
          last_message_content: messageText.substring(0, 100),
          last_message_sender: 'contact',
          last_inbound_at: new Date().toISOString()
        });
      }

      // 3) Criar Message
      await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: contact.id,
        sender_type: 'contact',
        recipient_id: thread.assigned_user_id || 'system',
        recipient_type: 'user',
        content: messageText,
        channel: 'phone',
        provider: 'goto_phone',
        status: 'recebida',
        goto_message_id: messageId,
        sent_at: new Date().toISOString(),
        metadata: {
          conversation_id: conversationId,
          raw_payload: payload
        }
      });

      console.log('[GOTO_WEBHOOK] ✅ SMS processado');
      return Response.json({ received: true });
    }

    // ═══ CALL EVENTS ═══
    if (eventType?.startsWith('call.')) {
      const callId = payload.callId || payload.id;
      const fromNumber = payload.from || payload.caller;
      const toNumber = payload.to || payload.callee;
      const callStatus = payload.status || payload.state;

      if (!callId || !fromNumber) {
        console.warn('[GOTO_WEBHOOK] Call event sem dados suficientes');
        return Response.json({ received: true });
      }

      // Determinar direção (inbound se veio de fora, outbound se originou do sistema)
      const direction = payload.direction || 'inbound';

      // 1) Buscar/criar Contact baseado no número
      const contactPhone = direction === 'inbound' ? fromNumber : toNumber;
      let contact = await base44.entities.Contact.filter({ telefone: contactPhone });
      
      if (!contact || contact.length === 0) {
        contact = await base44.entities.Contact.create({
          nome: `GoTo ${contactPhone}`,
          telefone: contactPhone,
          tipo_contato: 'novo'
        });
      } else {
        contact = contact[0];
      }

      // 2) Buscar ou criar CallSession
      let callSession = await base44.entities.CallSession.filter({ provider_call_id: callId });
      
      if (!callSession || callSession.length === 0) {
        callSession = await base44.entities.CallSession.create({
          contact_id: contact.id,
          direction: direction,
          from_number: fromNumber,
          to_number: toNumber,
          status: callStatus || 'ringing',
          provider_call_id: callId,
          started_at: payload.startedAt || new Date().toISOString(),
          metadata: payload
        });
      } else {
        callSession = callSession[0];
        
        // Atualizar status conforme evolução
        const updates = {
          status: callStatus,
          metadata: payload
        };

        if (callStatus === 'answered' && !callSession.answered_at) {
          updates.answered_at = payload.answeredAt || new Date().toISOString();
        }

        if (callStatus === 'ended' && !callSession.ended_at) {
          updates.ended_at = payload.endedAt || new Date().toISOString();
          updates.duration_seconds = payload.duration || 
            (Math.floor((new Date(updates.ended_at) - new Date(callSession.started_at)) / 1000));
        }

        await base44.entities.CallSession.update(callSession.id, updates);
      }

      console.log('[GOTO_WEBHOOK] ✅ Call event processado');
      return Response.json({ received: true });
    }

    // Evento não reconhecido
    console.warn('[GOTO_WEBHOOK] Evento não reconhecido:', eventType);
    return Response.json({ received: true });

  } catch (error) {
    console.error('[GOTO_WEBHOOK] Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});