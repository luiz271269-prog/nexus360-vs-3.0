// ============================================================================
// SKILL 1 — ACK IMEDIATO v1.0
// Objetivo: Resposta em <2s para NENHUM cliente ficar sem retorno
// Disparo: Primeira linha do processInbound, antes de qualquer lógica
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const base44 = createClientFromRequest(req);
  const startTime = Date.now();
  const payload = await req.json().catch(() => ({}));
  const { thread, contact, integracao } = payload;

  try {
    // Guard: só executa na primeira mensagem
    const jaRespondido = thread.last_outbound_at && thread.last_outbound_at > thread.last_inbound_at;
    if (jaRespondido) {
      return Response.json({ success: true, skipped: true, reason: 'ja_respondido' });
    }

    // Guard: só para threads externas
    if (thread.thread_type !== 'contact_external') {
      return Response.json({ success: true, skipped: true, reason: 'thread_interna' });
    }

    // Guard: cooldown 60s
    const agora = Date.now();
    if (thread.last_outbound_at) {
      const diffMs = agora - new Date(thread.last_outbound_at).getTime();
      if (diffMs < 60_000) {
        return Response.json({ success: true, skipped: true, reason: 'cooldown_60s' });
      }
    }

    // Personalizar por tipo
    const primeiroNome = (contact.nome || 'cliente').split(' ')[0];
    const ehVip = contact.is_vip || contact.classe_abc === 'A';
    let mensagemAck;

    if (ehVip) {
      mensagemAck = `Ola, ${primeiroNome}!\nRecebi sua mensagem e ja estou verificando para voce. Um momento!`;
    } else if (contact.tipo_contato === 'cliente') {
      mensagemAck = `Ola, ${primeiroNome}! Ja recebi sua mensagem. Vou verificar e te ajudo em instantes!`;
    } else {
      mensagemAck = `Ola, ${primeiroNome}! Recebi sua mensagem.\nVou analisar e te responder em instantes!`;
    }

    // Buscar integração
    const integracaoId = thread.whatsapp_integration_id || integracao?.id;
    if (!integracaoId) {
      return Response.json({ success: false, error: 'integracao_nao_encontrada' }, { status: 400 });
    }

    const integracaoData = await base44.asServiceRole.entities.WhatsAppIntegration
      .get(integracaoId)
      .catch(() => null);

    if (!integracaoData?.instance_id) {
      return Response.json({ success: false, error: 'instance_id_ausente' }, { status: 400 });
    }

    // Normalizar telefone
    const telefoneLimpo = (contact.telefone || '').replace(/\D/g, '');
    const telefoneE164 = telefoneLimpo.startsWith('55') ? `+${telefoneLimpo}` : `+55${telefoneLimpo}`;

    // Enviar via Z-API
    const respEnvio = await fetch(`https://api.z-api.io/instances/${integracaoData.instance_id}/token/${integracaoData.api_key_provider}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: telefoneE164, message: mensagemAck })
    }).then(r => r.json()).catch(() => null);

    if (!respEnvio?.success) {
      return Response.json({ success: false, error: 'envio_whatsapp_falhou' }, { status: 500 });
    }

    // Persistir
    await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: 'nexus_agent',
      sender_type: 'user',
      recipient_id: contact.id,
      recipient_type: 'contact',
      content: mensagemAck,
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      visibility: 'public_to_customer',
      metadata: { is_ack: true, skill: 'skillACKImediato' }
    });

    // Atualizar thread
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      last_outbound_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'user',
      last_message_content: mensagemAck
    });

    // Log
    await base44.asServiceRole.entities.SkillExecution.create({
      skill_name: 'skillACKImediato',
      triggered_by: 'processInbound',
      execution_mode: 'autonomous_safe',
      success: true,
      duration_ms: Date.now() - startTime,
      context: { thread_id: thread.id, contact_id: contact.id }
    }).catch(() => null);

    return Response.json({ success: true, ack_enviado: mensagemAck });

  } catch (error) {
    await base44.asServiceRole.entities.SkillExecution.create({
      skill_name: 'skillACKImediato',
      triggered_by: 'processInbound',
      execution_mode: 'autonomous_safe',
      success: false,
      error_message: error.message,
      duration_ms: Date.now() - startTime
    }).catch(() => null);

    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});