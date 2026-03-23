// SKILL 01 — ACK IMEDIATO v1.2 (anti-duplicação reforçado)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function getACKMessage(tipo, nome, isVIP, hora) {
  if (hora < 8 || hora > 18) {
    return { tipo: 'fora_horario', msg: 'Olá! 😊\nNosso atendimento é Seg-Sex 08h-18h. Até logo! 👋' };
  }
  if (isVIP) return { tipo: 'vip', msg: `✨ Olá ${nome}!\nJá recebi sua mensagem. Um momento!` };
  if (tipo === 'cliente') return { tipo: 'cliente', msg: `👋 Olá ${nome}! Recebi sua mensagem. Vou ajudar em instantes!` };
  if (tipo === 'fornecedor') return { tipo: 'fornecedor', msg: `🤝 Olá ${nome}! Recebi seu contato. Vou direcionar para compras.` };
  return { tipo: 'novo', msg: `👋 Olá ${nome}! Recebi sua mensagem. Vou analisar!` };
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const tsInicio = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { thread_id, contact_id, integration_id, message_id } = payload;

    if (!thread_id || !contact_id) {
      return Response.json({ success: false, error: 'Missing IDs' }, { status: 400, headers });
    }

    // ═══════════════════════════════════════════════════════════
    // GUARD 1: Cooldown 5 minutos
    // ═══════════════════════════════════════════════════════════
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    const agora = Date.now();
    if (thread.last_outbound_at) {
      const diffMs = agora - new Date(thread.last_outbound_at).getTime();
      if (diffMs < 300_000) {
        console.log('[SKILL-ACK] Cooldown 5min ativo');
        return Response.json({ success: true, skipped: true, reason: 'cooldown_5min' }, { headers });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // GUARD 2: Webhook duplicado?
    // ═══════════════════════════════════════════════════════════
    if (message_id) {
      const msgs = await base44.asServiceRole.entities.Message.filter({
        thread_id,
        sender_id: 'skill_ack'
      }, '-created_date', 1).catch(() => []);

      if (msgs.length > 0 && msgs[0].metadata?.msg_id === message_id) {
        console.log('[SKILL-ACK] Webhook duplicado detectado');
        return Response.json({ success: true, skipped: true, reason: 'webhook_duplicado' }, { headers });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Enviar ACK
    // ═══════════════════════════════════════════════════════════
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    const nome = (contact.nome || 'cliente').split(' ')[0];
    const isVIP = contact.is_vip || contact.classe_abc === 'A';
    const tipo = contact.tipo_contato || 'novo';
    const hora = new Date().getHours();

    const ack = getACKMessage(tipo, nome, isVIP, hora);
    const integId = thread.whatsapp_integration_id || integration_id;

    if (!integId) {
      return Response.json({ success: false, error: 'No integration' }, { status: 400, headers });
    }

    const integ = await base44.asServiceRole.entities.WhatsAppIntegration.get(integId);
    if (!integ || !integ.instance_id_provider || !integ.api_key_provider) {
      return Response.json({ success: false, error: 'Invalid credentials' }, { status: 400, headers });
    }

    const tel = (contact.telefone || '').replace(/\D/g, '');
    const phone = tel.startsWith('55') ? tel : '55' + tel;
    const isWAPI = integ.api_provider === 'w_api';

    let resp;
    if (isWAPI) {
      const url = (integ.base_url_provider || 'https://api.w-api.app/v1') + `/message/send-text?instanceId=${integ.instance_id_provider}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
        body: JSON.stringify({ phone, message: ack.msg, delayMessage: 1 })
      });
      resp = await r.json();
    } else {
      const url = (integ.base_url_provider || 'https://api.z-api.io') + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-text`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: ack.msg })
      });
      resp = await r.json();
    }

    const ok = isWAPI ? (resp.messageId || resp.insertedId) : resp.success === true;
    if (!ok) {
      console.error('[SKILL-ACK] Envio falhou:', JSON.stringify(resp));
      return Response.json({ success: false, error: 'Send failed' }, { status: 500, headers });
    }

    const msgId = resp.messageId || resp.key?.id || resp.id || 'unknown';
    console.log('[SKILL-ACK] ✅ Enviado:', msgId);

    // Persistir
    await base44.asServiceRole.entities.Message.create({
      thread_id,
      sender_id: 'skill_ack',
      sender_type: 'user',
      recipient_id: contact_id,
      recipient_type: 'contact',
      content: ack.msg,
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      visibility: 'public_to_customer',
      metadata: { is_ack: true, ack_tipo: ack.tipo, msg_id: message_id }
    });

    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_outbound_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'user'
    });

    return Response.json({ success: true, ack: ack.tipo }, { headers });

  } catch (error) {
    console.error('[SKILL-ACK] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});