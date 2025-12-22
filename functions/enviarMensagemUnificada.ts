import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ROTEADOR CENTRAL DE ENVIO
 * Hub agnóstico que despacha mensagens para o adaptador correto
 * baseado na conexão escolhida pelo usuário.
 * 
 * Preserva 100% a lógica existente do WhatsApp.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { 
      connectionId, 
      threadId, 
      contactId, 
      content, 
      mediaType, 
      mediaUrl, 
      replyToMessageId, 
      metadata 
    } = payload;

    // 1) Determinar tipo de conexão e buscar
    let connection = null;
    let connectionType = null;

    // Tentar WhatsApp primeiro
    const whatsappConns = await base44.entities.WhatsAppIntegration.filter({ id: connectionId });
    if (whatsappConns.length > 0) {
      connection = whatsappConns[0];
      connectionType = 'whatsapp';
    }

    // Tentar Instagram
    if (!connection) {
      const instagramConns = await base44.entities.InstagramIntegration.filter({ id: connectionId });
      if (instagramConns.length > 0) {
        connection = instagramConns[0];
        connectionType = 'instagram';
      }
    }

    // Tentar Facebook
    if (!connection) {
      const facebookConns = await base44.entities.FacebookIntegration.filter({ id: connectionId });
      if (facebookConns.length > 0) {
        connection = facebookConns[0];
        connectionType = 'facebook';
      }
    }

    if (!connection) {
      return Response.json({ 
        error: 'Conexão não encontrada ou inativa',
        connectionId 
      }, { status: 400 });
    }

    // 2) Buscar contexto (thread/contact)
    const thread = threadId ? await base44.entities.MessageThread.get(threadId) : null;
    const contact = contactId ? await base44.entities.Contact.get(contactId) : 
                    (thread?.contact_id ? await base44.entities.Contact.get(thread.contact_id) : null);

    if (!contact) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 400 });
    }

    // 3) Resolver destino (telefone ou scoped id)
    let destinationId = null;
    if (connectionType === 'whatsapp') {
      destinationId = contact.telefone;
    } else if (connectionType === 'instagram') {
      destinationId = contact.instagram_id || contact.metadata?.social_ids?.instagram;
    } else if (connectionType === 'facebook') {
      destinationId = contact.facebook_id || contact.metadata?.social_ids?.facebook;
    }

    if (!destinationId) {
      return Response.json({ 
        error: `Contato sem identificador para canal ${connectionType}`,
        channel: connectionType,
        contact: contact.id
      }, { status: 400 });
    }

    // 4) Criar Message outbound antes de enviar (rastreabilidade)
    const newMessage = await base44.entities.Message.create({
      thread_id: thread?.id,
      sender_id: user.id,
      sender_type: 'user',
      recipient_id: contact.id,
      recipient_type: 'contact',
      content: content || '',
      media_type: mediaType || 'none',
      media_url: mediaUrl || null,
      channel: connectionType,
      provider: connectionType === 'whatsapp' ? connection.api_provider : 
                connectionType === 'instagram' ? 'instagram_api' : 'facebook_graph_api',
      status: 'enviando',
      reply_to_message_id: replyToMessageId || null,
      metadata: {
        ...metadata,
        connectionId: connection.id,
        connection_name: connection.nome_instancia
      }
    });

    let result;

    // 5) SWITCH CIRÚRGICO por tipo de conexão
    try {
      switch (connectionType) {
        
        // ═══ WHATSAPP (mantém 100% o que já existe) ═══
        case 'whatsapp': {
          result = await base44.functions.invoke('enviarWhatsApp', {
            phone: destinationId,
            message: content,
            media_url: mediaUrl,
            media_type: mediaType,
            integration_id: connection.id,
            reply_to_message_id: replyToMessageId,
            metadata: metadata
          });
          break;
        }

        // ═══ INSTAGRAM (novo adaptador) ═══
        case 'instagram': {
          result = await base44.functions.invoke('sendInstagramMessage', {
            recipientId: destinationId,
            content: content,
            mediaType: mediaType,
            mediaUrl: mediaUrl,
            replyToMessageId: replyToMessageId,
            accessToken: connection.access_token,
            pageId: connection.page_id,
            igBusinessId: connection.instagram_business_account_id
          });
          break;
        }

        // ═══ FACEBOOK (novo adaptador) ═══
        case 'facebook': {
          result = await base44.functions.invoke('sendFacebookMessage', {
            recipientId: destinationId,
            content: content,
            mediaType: mediaType,
            mediaUrl: mediaUrl,
            replyToMessageId: replyToMessageId,
            accessToken: connection.access_token,
            pageId: connection.page_id
          });
          break;
        }

        default:
          throw new Error(`Canal não suportado: ${connectionType}`);
      }

      // 6) Atualizar Message com sucesso
      await base44.entities.Message.update(newMessage.id, {
        status: 'enviada',
        sent_at: new Date().toISOString(),
        metadata: {
          ...newMessage.metadata,
          external_message_id: result.data?.messageId || result.data?.message_id,
          provider_result: result.data
        }
      });

      // 7) Atualizar thread
      if (thread) {
        await base44.entities.MessageThread.update(thread.id, {
          last_message_at: new Date().toISOString(),
          last_message_content: content?.substring(0, 100) || '[Mídia]',
          last_message_sender: 'user',
          last_media_type: mediaType || 'none'
        });
      }

      return Response.json({
        success: true,
        messageId: newMessage.id,
        externalMessageId: result.data?.messageId || result.data?.message_id,
        channel: connectionType,
        status: 'enviada'
      });

    } catch (sendError) {
      // Marcar mensagem como falhou
      await base44.entities.Message.update(newMessage.id, {
        status: 'falhou',
        erro_detalhes: sendError.message,
        metadata: {
          ...newMessage.metadata,
          error: sendError.message,
          error_stack: sendError.stack
        }
      });

      throw sendError;
    }

  } catch (error) {
    console.error('[ROTEADOR] Erro:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});