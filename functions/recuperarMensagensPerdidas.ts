import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * RECUPERADOR DE MENSAGENS PERDIDAS
 * Reprocessa payloads que falharam devido ao erro de phoneNormalizer
 * Busca logs de hoje e tenta recriar Contact/Thread/Message
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado - apenas admin' }, { status: 403 });
    }

    const { data_inicio } = await req.json();
    const dataFiltro = data_inicio || new Date().toISOString().split('T')[0] + 'T00:00:00';

    console.log(`[RECUPERADOR] 🔍 Buscando payloads desde: ${dataFiltro}`);

    // Buscar todos os payloads de hoje que possam ter falhado
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter({
      timestamp_recebido: { $gte: dataFiltro }
    }, '-timestamp_recebido', 200);

    console.log(`[RECUPERADOR] 📊 ${payloads.length} payloads encontrados`);

    const recuperados = [];
    const erros = [];

    for (const payload of payloads) {
      try {
        // Pular se não for mensagem de usuário
        if (!payload.payload_bruto?.text?.message && !payload.payload_bruto?.messageId) {
          continue;
        }

        const pb = payload.payload_bruto;
        const telefone = pb.phone || pb.from;
        const messageId = pb.messageId;

        if (!telefone || !messageId) continue;

        // Verificar se a mensagem já existe
        const msgExistente = await base44.asServiceRole.entities.Message.filter({
          whatsapp_message_id: messageId
        }, '-created_date', 1);

        if (msgExistente.length > 0) {
          console.log(`[RECUPERADOR] ⏭️ Mensagem já existe: ${messageId}`);
          continue;
        }

        // ✅ Usar contactManagerCentralized
        const { getOrCreateContactCentralized } = await import('./lib/contactManagerCentralized.js');
        
        const contato = await getOrCreateContactCentralized(
          base44,
          telefone,
          pb.senderName || pb.chatName || telefone,
          pb.photo || null,
          pb.pushName || pb.senderName || null,
          payload.integration_id
        );

        // Buscar ou criar thread
        let threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contato.id,
          whatsapp_integration_id: payload.integration_id
        }, '-last_message_at', 1);

        let thread;
        if (threads.length === 0) {
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contato.id,
            thread_type: 'contact_external',
            channel: 'whatsapp',
            whatsapp_integration_id: payload.integration_id,
            status: 'aberta',
            last_message_at: pb.momment ? new Date(pb.momment).toISOString() : payload.timestamp_recebido,
            last_inbound_at: pb.momment ? new Date(pb.momment).toISOString() : payload.timestamp_recebido,
            last_message_sender: 'contact',
            last_message_content: pb.text?.message?.substring(0, 100) || '[Mensagem recuperada]',
            unread_count: 1,
            total_mensagens: 1
          });
        } else {
          thread = threads[0];
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_at: pb.momment ? new Date(pb.momment).toISOString() : payload.timestamp_recebido,
            last_inbound_at: pb.momment ? new Date(pb.momment).toISOString() : payload.timestamp_recebido,
            unread_count: (thread.unread_count || 0) + 1,
            total_mensagens: (thread.total_mensagens || 0) + 1
          });
        }

        // Criar mensagem
        const mensagem = await base44.asServiceRole.entities.Message.create({
          thread_id: thread.id,
          sender_id: contato.id,
          sender_type: 'contact',
          content: pb.text?.message || '[Mensagem recuperada]',
          channel: 'whatsapp',
          status: 'recebida',
          whatsapp_message_id: messageId,
          sent_at: pb.momment ? new Date(pb.momment).toISOString() : payload.timestamp_recebido,
          metadata: {
            whatsapp_integration_id: payload.integration_id,
            recuperada: true,
            payload_original_id: payload.id
          }
        });

        recuperados.push({
          telefone,
          messageId,
          message_id: mensagem.id,
          thread_id: thread.id
        });

        console.log(`[RECUPERADOR] ✅ Recuperada: ${messageId} | Thread: ${thread.id}`);

      } catch (error) {
        console.error(`[RECUPERADOR] ❌ Erro ao recuperar:`, error.message);
        erros.push({
          payload_id: payload.id,
          telefone: payload.payload_bruto?.phone,
          erro: error.message
        });
      }
    }

    return Response.json({
      success: true,
      total_payloads: payloads.length,
      recuperados: recuperados.length,
      erros: erros.length,
      detalhes: {
        recuperados,
        erros
      }
    });

  } catch (error) {
    console.error('[RECUPERADOR] ❌ Erro geral:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});