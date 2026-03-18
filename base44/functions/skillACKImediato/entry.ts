// ============================================================================
// SKILL 01 — ACK IMEDIATO v1.1
// ============================================================================
// Objetivo: Resposta <2s para zero contatos ignorados
// Função: Verifica horário comercial, personaliza por tipo, idempotente 60s
// Dispara: fire-and-forget no início do processInbound
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

interface ACKPayload {
  thread_id: string;
  contact_id: string;
  integration_id: string;
}

function getACKMessage(tipoContato: string, primeiroNome: string, isVIP: boolean, horaAtual: number): { mensagem: string; tipo: string } {
  const foraDoHorario = horaAtual < 8 || horaAtual > 18;
  
  if (foraDoHorario) {
    return {
      tipo: 'fora_horario',
      mensagem: '🌙 Sua mensagem foi recebida!\nAbrimos amanhã às 8h. Obrigado! 😊'
    };
  }

  if (isVIP) {
    return {
      tipo: 'vip',
      mensagem: `✨ Olá ${primeiroNome}!\nJá recebi sua mensagem e estou verificando para você. Um momento!`
    };
  }

  if (tipoContato === 'cliente') {
    return {
      tipo: 'cliente',
      mensagem: `👋 Olá ${primeiroNome}! Já recebi sua mensagem.\nVou verificar e te ajudo em instantes!`
    };
  }

  if (tipoContato === 'fornecedor') {
    return {
      tipo: 'fornecedor',
      mensagem: `🤝 Olá ${primeiroNome}! Recebi seu contato.\nVou direcionar para nossa equipe de compras.`
    };
  }

  return {
    tipo: 'novo',
    mensagem: `👋 Olá ${primeiroNome}! Recebi sua mensagem.\nVou analisar e te responder em instantes!`
  };
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const tsInicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const payload: ACKPayload = await req.json();
    const { thread_id, contact_id, integration_id } = payload;

    if (!thread_id || !contact_id) {
      return Response.json(
        { success: false, error: 'thread_id e contact_id obrigatórios' },
        { status: 400, headers }
      );
    }

    // Guard: já respondido recentemente?
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    const agora = Date.now();
    if (thread.last_outbound_at) {
      const diffMs = agora - new Date(thread.last_outbound_at).getTime();
      if (diffMs < 60_000) { // cooldown 60s
        return Response.json({
          success: true,
          skipped: true,
          reason: 'cooldown_60s'
        }, { headers });
      }
    }

    // Buscar contato
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    const primeiroNome = (contact.nome || 'cliente').split(' ')[0];
    const isVIP = contact.is_vip || contact.classe_abc === 'A';
    const tipoContato = contact.tipo_contato || 'novo';

    // Gerar mensagem ACK
    const horaAtual = new Date().getHours();
    const ackConfig = getACKMessage(tipoContato, primeiroNome, isVIP, horaAtual);

    // Buscar integração
    const integId = thread.whatsapp_integration_id || integration_id;
    if (!integId) {
      return Response.json(
        { success: false, error: 'integração não encontrada' },
        { status: 400, headers }
      );
    }

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integId);
    if (!integracao?.instance_id_provider || !integracao?.api_key_provider) {
      return Response.json(
        { success: false, error: 'credenciais incompletas' },
        { status: 400, headers }
      );
    }

    // Normalizar telefone E.164
    const telefoneLimpo = (contact.telefone || '').replace(/\D/g, '');
    const telefoneE164 = telefoneLimpo.startsWith('55') ? `+${telefoneLimpo}` : `+55${telefoneLimpo}`;

    // Enviar via Z-API (provedor padrão)
    const respEnvio = await fetch(
      `https://api.z-api.io/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: telefoneE164, message: ackConfig.mensagem })
      }
    ).then(r => r.json());

    if (!respEnvio?.success) {
      console.warn('[SKILL-ACK] Envio Z-API falhou:', respEnvio);
      return Response.json(
        { success: false, error: 'envio_whatsapp_falhou' },
        { status: 500, headers }
      );
    }

    // Persistir mensagem
    await base44.asServiceRole.entities.Message.create({
      thread_id,
      sender_id: 'skill_ack',
      sender_type: 'user',
      recipient_id: contact_id,
      recipient_type: 'contact',
      content: ackConfig.mensagem,
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      visibility: 'public_to_customer',
      metadata: {
        is_ack: true,
        skill_version: 'v1.1',
        ack_tipo: ackConfig.tipo,
        is_vip: isVIP
      }
    });

    // Atualizar thread
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_outbound_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'user',
      last_message_content: ackConfig.mensagem.substring(0, 100)
    });

    return Response.json({
      success: true,
      ack_tipo: ackConfig.tipo,
      duration_ms: Date.now() - tsInicio
    }, { headers });

  } catch (error) {
    console.error('[SKILL-ACK] Erro:', error);
    return Response.json(
      { success: false, error: (error as any).message },
      { status: 500, headers }
    );
  }
});