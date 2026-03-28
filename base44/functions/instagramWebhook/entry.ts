import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * WEBHOOK INSTAGRAM
 * Recebe mensagens do Instagram via Meta Webhooks
 * Normaliza para o formato interno e cria Contact/Thread/Message
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req).asServiceRole;

    // Verificação do webhook (Meta envia GET para validar)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      // Token de verificação deve ser configurado nas variáveis de ambiente
      const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_VERIFY_TOKEN') || 'base44_instagram_token';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[INSTAGRAM] Webhook verificado');
        return new Response(challenge, { status: 200 });
      } else {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Processar mensagens recebidas
    const payload = await req.json();
    
    console.log('[INSTAGRAM] Webhook recebido:', JSON.stringify(payload, null, 2));

    // Meta envia array de entries
    if (!payload.entry || !Array.isArray(payload.entry)) {
      return Response.json({ success: true, message: 'No entries' });
    }

    for (const entry of payload.entry) {
      // Cada entry pode ter múltiplos messaging events
      const messaging = entry.messaging || [];
      
      for (const event of messaging) {
        try {
          // Identificar integração pela page_id ou ig_business_id
          const pageId = entry.id;
          const integrations = await base44.entities.InstagramIntegration.filter({
            instagram_business_account_id: pageId
          });

          if (integrations.length === 0) {
            console.warn('[INSTAGRAM] Integração não encontrada para page_id:', pageId);
            continue;
          }

          const integration = integrations[0];

          // Extrair dados da mensagem
          const senderId = event.sender?.id;
          const message = event.message;

          if (!senderId || !message) continue;

          // Buscar ou criar Contact via lookup por instagram_id
          // Instagram não tem telefone — não usar getOrCreateContactCentralized (telefone obrigatório)
          let contact;
          const existingContacts = await base44.entities.Contact.filter({
            instagram_id: senderId
          });

          if (existingContacts.length === 0) {
            contact = await base44.entities.Contact.create({
              nome: `Instagram ${senderId.substring(0, 8)}`,
              instagram_id: senderId,
              tipo_contato: 'novo',
              whatsapp_status: 'nao_verificado',
              conexao_origem: integration.id,
              ultima_interacao: new Date().toISOString()
            });
            console.log('[INSTAGRAM] ✅ Novo contato criado:', contact.id);
          } else {
            contact = existingContacts[0];
            await base44.entities.Contact.update(contact.id, {
              ultima_interacao: new Date().toISOString()
            });
          }

          // Buscar ou criar MessageThread
          let threads = await base44.entities.MessageThread.filter({
            contact_id: contact.id,
            thread_type: 'contact_external',
            channel: 'instagram'
          });

          let thread;
          if (threads.length === 0) {
            thread = await base44.entities.MessageThread.create({
              contact_id: contact.id,
              thread_type: 'contact_external',
              channel: 'instagram',
              conexao_id: integration.id,
              status: 'aberta',
              unread_count: 1
            });
          } else {
            thread = threads[0];
            await base44.entities.MessageThread.update(thread.id, {
              unread_count: (thread.unread_count || 0) + 1
            });
          }

          // Criar Message
          const content = message.text || '';
          const mediaType = message.attachments?.[0]?.type || 'none';
          const mediaUrl = message.attachments?.[0]?.payload?.url || null;

          await base44.entities.Message.create({
            thread_id: thread.id,
            sender_id: contact.id,
            sender_type: 'contact',
            content: content,
            media_type: mediaType,
            media_url: mediaUrl,
            channel: 'instagram',
            provider: 'instagram_api',
            status: 'recebida',
            sent_at: new Date(event.timestamp).toISOString(),
            metadata: {
              instagram_message_id: message.mid,
              integration_id: integration.id
            }
          });

          // Atualizar thread
          await base44.entities.MessageThread.update(thread.id, {
            last_message_at: new Date().toISOString(),
            last_message_content: content?.substring(0, 100) || '[Mídia]',
            last_message_sender: 'contact',
            last_media_type: mediaType
          });

        } catch (error) {
          console.error('[INSTAGRAM] Erro ao processar evento:', error);
        }
      }
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('[INSTAGRAM] Erro no webhook:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});