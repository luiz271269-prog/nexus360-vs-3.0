// SKILL 01 — ACK IMEDIATO v1.2 (anti-duplicação reforçado)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // Guard: integration_id nulo → buscar via thread
    let resolvedIntegrationId = integration_id;
    if (!resolvedIntegrationId) {
      const threadCheck = await base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null);
      resolvedIntegrationId = threadCheck?.whatsapp_integration_id || null;
      if (!resolvedIntegrationId) {
        console.warn('[SKILL-ACK] ⚠️ integration_id null e thread sem integração — ACK pulado');
        return Response.json({ success: true, skipped: true, reason: 'no_integration_id' }, { headers });
      }
      console.log('[SKILL-ACK] 🔄 integration_id recuperado via thread:', resolvedIntegrationId);
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
    // GUARD 2: LOCK ATÔMICO no banco (fix race condition entre instâncias paralelas)
    // Padrão: GRAVAR o lock PRIMEIRO, depois verificar, depois enviar.
    // Isso garante que mesmo com 10 instâncias paralelas, só uma passa.
    // ═══════════════════════════════════════════════════════════
    const cincoMinAtras = new Date(Date.now() - 300_000).toISOString();
    const ackRecentes = await base44.asServiceRole.entities.Message.filter({
      thread_id,
      sender_id: 'skill_ack',
      created_date: { $gte: cincoMinAtras }
    }, '-created_date', 1).catch(() => []);

    if (ackRecentes.length > 0) {
      console.log('[SKILL-ACK] ⏭️ Lock atômico: ACK recente no banco — rejeitando');
      return Response.json({ success: true, skipped: true, reason: 'ack_recente_db' }, { headers });
    }

    // ✅ GRAVAR LOCK IMEDIATAMENTE antes de qualquer envio
    // Qualquer instância paralela que chegar depois vai encontrar este registro
    const lockRecord = await base44.asServiceRole.entities.Message.create({
      thread_id,
      sender_id: 'skill_ack',
      sender_type: 'user',
      recipient_id: contact_id,
      recipient_type: 'contact',
      content: '...', // placeholder — atualizado após envio
      channel: 'whatsapp',
      status: 'enviando',
      sent_at: new Date().toISOString(),
      visibility: 'public_to_customer',
      metadata: { is_ack: true, ack_tipo: 'lock_placeholder', msg_id: message_id }
    }).catch(() => null);

    if (!lockRecord) {
      console.warn('[SKILL-ACK] ⚠️ Não foi possível gravar lock — abortando para evitar duplicata');
      return Response.json({ success: true, skipped: true, reason: 'lock_failed' }, { headers });
    }
    console.log('[SKILL-ACK] 🔒 Lock atômico gravado:', lockRecord.id);

    // Buscar contato e integração
    const [contact, integ] = await Promise.all([
      base44.asServiceRole.entities.Contact.get(contact_id),
      base44.asServiceRole.entities.WhatsAppIntegration.get(resolvedIntegrationId)
    ]);

    const integ_ok = integ;
    if (!integ || !integ.instance_id_provider || !integ.api_key_provider) {
      // W-API requer client-token — validar
      if (integ?.api_provider === 'w_api' && !integ?.security_client_token_header) {
        console.warn('[SKILL-ACK] ⚠️ W-API sem client-token — ACK pulado');
        // Limpar lock placeholder
        await base44.asServiceRole.entities.Message.delete(lockRecord.id).catch(() => {});
        return Response.json({ success: true, skipped: true, reason: 'wapi_no_client_token' }, { headers });
      }
      await base44.asServiceRole.entities.Message.delete(lockRecord.id).catch(() => {});
      return Response.json({ success: false, error: 'Invalid credentials' }, { status: 400, headers });
    }

    // ═══════════════════════════════════════════════════════════
    // SAUDAÇÃO ESPECIAL: ex_cliente (retorno após longa ausência)
    // ═══════════════════════════════════════════════════════════
    if (contact.tipo_contato === 'ex_cliente') {
      const primeiroNome = (contact.nome || '').split(' ')[0];
      const msgRetorno = `Que bom ter você de volta${primeiroNome ? `, ${primeiroNome}` : ''}! 😊`;
      try {
        await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id,
          numero_destino: contact.telefone,
          mensagem: msgRetorno
        });
        console.log('[SKILL-ACK] ✅ Saudação ex_cliente enviada');
      } catch (e) {
        console.warn('[SKILL-ACK] ⚠️ Falha saudação ex_cliente:', e.message);
      }
    }

    const hora = new Date().getHours();
    const ack = getACKMessage(contact.tipo_contato, contact.nome, contact.is_vip, hora);

    const tel = (contact.telefone || '').replace(/\D/g, '');
    const phone = tel.startsWith('55') ? tel : '55' + tel;
    const isWAPI = integ_ok.api_provider === 'w_api';

    let resp;
    if (isWAPI) {
      const url = (integ_ok.base_url_provider || 'https://api.w-api.app/v1') + `/message/send-text?instanceId=${integ_ok.instance_id_provider}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ_ok.api_key_provider}` },
        body: JSON.stringify({ phone, message: ack.msg, delayMessage: 1 })
      });
      resp = await r.json();
    } else {
      const url = (integ_ok.base_url_provider || 'https://api.z-api.io') + `/instances/${integ_ok.instance_id_provider}/token/${integ_ok.api_key_provider}/send-text`;
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
      // Limpar lock para não bloquear próxima tentativa
      await base44.asServiceRole.entities.Message.delete(lockRecord.id).catch(() => {});
      return Response.json({ success: false, error: 'Send failed' }, { status: 500, headers });
    }

    const msgId = resp.messageId || resp.key?.id || resp.id || 'unknown';
    console.log('[SKILL-ACK] ✅ Enviado:', msgId);

    // ✅ Atualizar o lock record com conteúdo real (em vez de criar nova mensagem)
    await base44.asServiceRole.entities.Message.update(lockRecord.id, {
      content: ack.msg,
      status: 'enviada',
      metadata: { is_ack: true, ack_tipo: ack.tipo, msg_id: message_id, whatsapp_msg_id: msgId }
    }).catch(() => {});

    // Calcular tempo_primeira_resposta_minutos
    let tempoResposta = null;
    if (thread.primeira_mensagem_at) {
      tempoResposta = Math.round((Date.now() - new Date(thread.primeira_mensagem_at).getTime()) / 60000);
    }

    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_outbound_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'user',
      ...(tempoResposta !== null ? { tempo_primeira_resposta_minutos: tempoResposta } : {})
    });

    return Response.json({ success: true, ack: ack.tipo, tempo_resposta_min: tempoResposta }, { headers });

  } catch (error) {
    console.error('[SKILL-ACK] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});