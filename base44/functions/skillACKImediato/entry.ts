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
      mensagem: 'Olá! 😊\nNosso atendimento funciona: • *Seg a Sex*: 08h às 18h\nAssim que abrirmos entro em Contato. Até logo! 👋'
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

    // Enviar respeitando o provedor real (Z-API ou W-API)
    const telefoneLimpo = (contact.telefone || '').replace(/\D/g, '');
    const numeroFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : '55' + telefoneLimpo;
    
    const isWAPI = integracao.api_provider === 'w_api';
    let respEnvio;
    
    if (isWAPI) {
      // W-API: usa endpoint /message/send-text com Bearer token
      const baseUrl = integracao.base_url_provider || 'https://api.w-api.app/v1';
      const endpoint = `${baseUrl}/message/send-text?instanceId=${integracao.instance_id_provider}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integracao.api_key_provider}`
        },
        body: JSON.stringify({ phone: numeroFormatado, message: ackConfig.mensagem, delayMessage: 1 })
      });
      respEnvio = await resp.json();
      console.log('[SKILL-ACK] W-API enviou:', respEnvio);
    } else {
      // Z-API: endpoint direto (compatível com nova arquitetura)
      const baseUrl = integracao.base_url_provider || 'https://api.z-api.io';
      const endpoint = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: numeroFormatado, message: ackConfig.mensagem })
      });
      respEnvio = await resp.json();
      console.log('[SKILL-ACK] Z-API enviou:', respEnvio);
    }

    // Validar resposta conforme provedor
    // W-API: retorna { messageId, instanceId, insertedId }
    // Z-API: retorna { success: true, messageId, ... }
    const sucessoZ = respEnvio?.success === true;
    const sucessoW = respEnvio?.messageId || respEnvio?.insertedId;
    const envioOk = isWAPI ? sucessoW : sucessoZ;

    if (!envioOk) {
      console.error('[SKILL-ACK] ❌ Envio falhou | Provider:', isWAPI ? 'W-API' : 'Z-API');
      console.error('[SKILL-ACK] Response:', JSON.stringify(respEnvio));
      return Response.json(
        { success: false, error: 'envio_whatsapp_falhou', provider: isWAPI ? 'w_api' : 'z_api', response: respEnvio },
        { status: 500, headers }
      );
    }

    const msgId = respEnvio?.messageId || respEnvio?.key?.id || respEnvio?.id || 'unknown';
    console.log('[SKILL-ACK] ✅ Mensagem enviada via', isWAPI ? 'W-API' : 'Z-API', '| messageId:', msgId);

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