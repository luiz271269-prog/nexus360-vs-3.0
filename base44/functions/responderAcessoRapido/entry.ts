import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// RESPONDER ACESSO RÁPIDO — entrega o link/Pix/mensagem da opção escolhida
// ============================================================================
// Recebe a escolha de uma Lista Interativa (id = "acesso_rapido:ID"),
// busca o AcessoRapido no banco e envia o conteúdo correspondente.
// Chamado pelo guard do processInbound quando detecta um list_reply de acesso.
// ============================================================================

Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { selected_row_id, thread_id, contact_id, integration_id } = body;

    if (!selected_row_id || !String(selected_row_id).startsWith('acesso_rapido:')) {
      return Response.json({ success: false, skipped: 'nao_e_acesso_rapido' });
    }

    const acessoId = String(selected_row_id).split(':')[1];
    if (!acessoId) {
      return Response.json({ success: false, error: 'id_invalido' });
    }

    // ── Buscar o acesso rápido escolhido ──
    etapa = 'buscar_acesso';
    const acesso = await base44.asServiceRole.entities.AcessoRapido.get(acessoId).catch(() => null);
    if (!acesso) {
      return Response.json({ success: false, error: 'acesso_nao_encontrado' });
    }

    // ── Carregar contato ──
    etapa = 'carregar_contato';
    let contato = null;
    if (contact_id) {
      contato = await base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null);
    }
    if (!contato && thread_id) {
      const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null);
      if (thread?.contact_id) {
        contato = await base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null);
      }
    }
    if (!contato?.telefone) {
      return Response.json({ success: false, error: 'contato_sem_telefone' });
    }

    // ── Selecionar integração ──
    etapa = 'selecionar_integracao';
    let integration = null;
    if (integration_id) {
      integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id).catch(() => null);
    }
    if (!integration) {
      const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      integration = ints[0];
    }
    if (!integration) {
      return Response.json({ success: false, error: 'sem_integracao_conectada' });
    }

    // ── Montar a resposta conforme o tipo ──
    etapa = 'montar_resposta';
    const emoji = acesso.emoji || '🔗';
    let textoResposta;
    if (acesso.tipo === 'pix') {
      textoResposta = `${emoji} *${acesso.titulo}*\n\nChave Pix (copie e cole):\n${acesso.url}`;
    } else {
      textoResposta = `${emoji} *${acesso.titulo}*\n\n${acesso.url}`;
    }

    // ── Enviar via gateway ──
    etapa = 'enviar_whatsapp';
    const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: integration.id,
      numero_destino: contato.telefone,
      mensagem: textoResposta
    });
    if (!resp?.data?.success) {
      return Response.json({ success: false, error: resp?.data?.error || 'erro_envio' });
    }

    // ── Persistir Message na thread ──
    if (thread_id) {
      await base44.asServiceRole.entities.Message.create({
        thread_id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contato.id,
        recipient_type: 'contact',
        content: textoResposta,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.data.message_id,
        sent_at: new Date().toISOString(),
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: true,
          message_type: 'acesso_rapido_resposta',
          acesso_rapido_id: acessoId
        }
      });
    }

    console.log(`[responderAcessoRapido] ✅ "${acesso.titulo}" entregue a ${contato.nome}`);
    return Response.json({ success: true, message_id: resp.data.message_id, acesso: acesso.titulo });

  } catch (error) {
    console.error('[responderAcessoRapido] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});