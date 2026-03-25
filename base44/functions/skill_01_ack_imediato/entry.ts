// ============================================================================
// SKILL 01: ACK IMEDIATO v1.0.0
// ============================================================================
// Objetivo: Zero contatos ignorados. Responde em <2 segundos.
// Função: Detecta tipo de contato → envia ACK personalizado
// Dispara: No webhook inbound, fire-and-forget (não bloqueia)
// Idempotência: verifica se já enviou ACK na última 1h
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function detectarTipoAck(mensagem, tipoContatoAtual, horaAtual) {
  const texto = (mensagem || '').toLowerCase();
  const hora = new Date(horaAtual).getHours();
  const foraDoHorario = hora < 8 || hora > 18; // 8h-18h = horário comercial

  // NOVO/FORA HORÁRIO
  if (foraDoHorario) {
    return {
      tipo: 'fora_horario',
      mensagem: 'Olá! 😊\nNosso atendimento funciona: • *Seg a Sex*: 08h às 18h\nAssim que abrirmos entro em Contato. Até logo! 👋'
    };
  }

  // CLIENTE EXISTENTE (keywords simples)
  if (/já comprei|sou cliente|comprei|pedido|pedidos|anterior|ultima|último/.test(texto)) {
    return {
      tipo: 'cliente',
      mensagem: '✅ Oi! Já recebi sua mensagem.\nVou verificar e te ajudar agora! 👋'
    };
  }

  // PROBLEMA/SUPORTE
  if (/problema|defeito|quebrou|não funciona|não liga|conserto|bug|erro|travado|lento/.test(texto)) {
    return {
      tipo: 'suporte',
      mensagem: '🔧 Recebi sua mensagem de suporte!\nNosso time já está analisando. Voltamos em breve!'
    };
  }

  // FINANCEIRO/PAGAMENTO
  if (/boleto|pagamento|fatura|parcela|cobrança|vencimento|pagar/.test(texto)) {
    return {
      tipo: 'financeiro',
      mensagem: '💳 Oi! Recebi sua mensagem.\nUm momento que verifiquei sua pendência!'
    };
  }

  // DEFAULT: NOVO/LEAD
  return {
    tipo: 'novo',
    mensagem: '👋 Olá! Já recebi sua mensagem.\nVou te ajudar agora mesmo! 😊'
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
    const payload = await req.json().catch(() => ({}));
    const { thread_id, contact_id, message_content } = payload;

    if (!thread_id || !contact_id) {
      return Response.json(
        { success: false, error: 'thread_id e contact_id obrigatórios' },
        { status: 400, headers }
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 1: Buscar thread + contato
    // ══════════════════════════════════════════════════════════════════
    const [thread, contact] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.get(thread_id),
      base44.asServiceRole.entities.Contact.get(contact_id)
    ]);

    // LOCK ATÔMICO: verificar ACK recente (1h) ANTES de gravar lock
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const ultimoAck = await base44.asServiceRole.entities.Message.filter({
      thread_id,
      sender_id: 'skill_ack',
      created_date: { $gte: umaHoraAtras }
    }, '-created_date', 1).catch(() => []);

    if (ultimoAck && ultimoAck.length > 0) {
      console.log(`[SKILL-ACK] ⏭️ ACK já enviado há menos de 1h para thread ${thread_id}`);
      return Response.json({ success: true, skipped: true, reason: 'ack_already_sent' }, { headers });
    }

    // ✅ GRAVAR LOCK IMEDIATAMENTE antes de enviar
    // Qualquer instância paralela encontrará este registro e será bloqueada
    const lockRecord = await base44.asServiceRole.entities.Message.create({
      thread_id,
      sender_id: 'skill_ack',
      sender_type: 'user',
      content: '...', // placeholder — atualizado após envio
      channel: 'whatsapp',
      status: 'enviando',
      sent_at: new Date().toISOString(),
      visibility: 'public_to_customer',
      metadata: { is_ack: true, ack_tipo: 'lock_placeholder' }
    }).catch(() => null);

    if (!lockRecord) {
      console.warn('[SKILL-ACK] ⚠️ Não foi possível gravar lock — abortando para evitar duplicata');
      return Response.json({ success: true, skipped: true, reason: 'lock_failed' }, { headers });
    }
    console.log('[SKILL-ACK] 🔒 Lock atômico gravado:', lockRecord.id);

    // STEP 2: Detectar tipo de contato + mensagem ACK
    // ══════════════════════════════════════════════════════════════════
    const ackConfig = detectarTipoAck(
      message_content,
      contact.tipo_contato,
      new Date().toISOString()
    );

    console.log(`[SKILL-ACK] 📨 Tipo detectado: ${ackConfig.tipo} | Thread: ${thread_id}`);

    // ══════════════════════════════════════════════════════════════════
    // STEP 3: Enviar ACK via WhatsApp
    // ══════════════════════════════════════════════════════════════════
    if (thread.whatsapp_integration_id && contact.telefone) {
      try {
        const respEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: thread.whatsapp_integration_id,
          numero_destino: contact.telefone,
          mensagem: ackConfig.mensagem
        });

        if (respEnvio.data?.success) {
          // ✅ Atualizar o lock record com conteúdo real (em vez de criar nova mensagem)
          await base44.asServiceRole.entities.Message.update(lockRecord.id, {
            content: ackConfig.mensagem,
            status: 'enviada',
            metadata: { is_ai_response: true, ai_agent: 'skill_ack_imediato', ack_tipo: ackConfig.tipo }
          }).catch(() => {});

          // Atualizar thread
          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            last_message_at: new Date().toISOString(),
            last_outbound_at: new Date().toISOString(),
            last_message_sender: 'user',
            last_message_content: ackConfig.mensagem.substring(0, 100)
          });

          console.log(`[SKILL-ACK] ✅ ACK enviado (${ackConfig.tipo}) para ${contact.nome}`);

          return Response.json({
            success: true,
            ack_tipo: ackConfig.tipo,
            message_sent: true,
            duration_ms: Date.now() - tsInicio
          }, { headers });
        }
      } catch (e) {
        console.error(`[SKILL-ACK] ❌ Erro ao enviar WhatsApp:`, e.message);
        // Limpar lock para não bloquear próxima tentativa
        await base44.asServiceRole.entities.Message.delete(lockRecord.id).catch(() => {});
      }
    }

    return Response.json({
      success: false,
      error: 'Não foi possível enviar ACK',
      details: {
        temIntegracaoWpp: !!thread.whatsapp_integration_id,
        temTelefone: !!contact.telefone
      }
    }, { status: 500, headers });

  } catch (error) {
    console.error('[SKILL-ACK] ❌ Erro geral:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});