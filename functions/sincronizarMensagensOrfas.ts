import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Sincroniza mensagens órfãs (ligadas ao telefone da instância)
 * para o contato real do cliente
 * 
 * Problema: Mensagens que chegam pela instância (483045) precisam
 * apontar para o contato real (796744257)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem sincronizar' }, { status: 403 });
    }

    const { contact_id, target_contact_id } = await req.json();

    if (!contact_id || !target_contact_id) {
      return Response.json({
        error: 'contact_id e target_contact_id são obrigatórios'
      }, { status: 400 });
    }

    console.log(`[SINCRONIZAR] Iniciando sincronização de mensagens órfãs...`);
    console.log(`  De contato: ${contact_id}`);
    console.log(`  Para contato: ${target_contact_id}`);

    // 1️⃣ ENCONTRAR TODAS AS THREADS DO CONTATO ORIGEM
    const threadsOrigem = await base44.entities.MessageThread.filter({
      contact_id: contact_id
    }, '-last_message_at', 100);

    console.log(`[SINCRONIZAR] ${threadsOrigem?.length || 0} thread(s) encontrada(s) para contato origem`);

    // 2️⃣ ENCONTRAR TODAS AS MENSAGENS DESTAS THREADS
    const messagensOrfas = [];
    const threadsAtualizadas = [];

    for (const thread of (threadsOrigem || [])) {
      const mensagensDaThread = await base44.entities.Message.filter({
        thread_id: thread.id
      }, '-sent_at', 1000);

      console.log(`[SINCRONIZAR] Thread ${thread.id.substring(0, 8)}: ${mensagensDaThread?.length || 0} mensagens`);

      if (mensagensDaThread && mensagensDaThread.length > 0) {
        messagensOrfas.push(...(mensagensDaThread || []));
      }

      threadsAtualizadas.push({
        id: thread.id,
        original_contact_id: thread.contact_id,
        target_contact_id: target_contact_id,
        total_mensagens: mensagensDaThread?.length || 0
      });
    }

    console.log(`[SINCRONIZAR] Total de ${messagensOrfas.length} mensagens órfãs encontradas`);

    // 3️⃣ ATUALIZAR CADA MENSAGEM - Corrigir recipient_id ou sender_id
    let atualizadas = 0;
    let erros = 0;

    for (const msg of messagensOrfas) {
      try {
        // Se a mensagem foi recebida DO cliente (inbound)
        // sender_id aponta para o contato origem
        // Precisa apontar para o contato destino

        const updates = {};

        if (msg.sender_type === 'contact' && msg.sender_id === contact_id) {
          updates.sender_id = target_contact_id;
        }

        if (msg.recipient_type === 'contact' && msg.recipient_id === contact_id) {
          updates.recipient_id = target_contact_id;
        }

        if (Object.keys(updates).length > 0) {
          await base44.entities.Message.update(msg.id, updates);
          atualizadas++;

          console.log(`[SINCRONIZAR] ✅ Msg ${msg.id.substring(0, 8)}: corrigida`);
        }
      } catch (error) {
        erros++;
        console.error(`[SINCRONIZAR] ❌ Erro ao atualizar mensagem ${msg.id}:`, error.message);
      }
    }

    // 4️⃣ ATUALIZAR THREADS - Cambiar contact_id
    let threadsAtualizadas_count = 0;

    for (const threadInfo of threadsAtualizadas) {
      try {
        // Encontrar ou criar thread no contato destino
        const threadsDestino = await base44.entities.MessageThread.filter({
          contact_id: target_contact_id,
          thread_type: 'contact_external',
          channel: (await base44.entities.MessageThread.get(threadInfo.id)).channel
        }, '-last_message_at', 1);

        let threadDestino = threadsDestino?.[0];

        if (!threadDestino) {
          console.log(`[SINCRONIZAR] Criando nova thread no contato destino...`);
          const threadOrigem = await base44.entities.MessageThread.get(threadInfo.id);
          
          // Criar cópia da thread no contato destino
          threadDestino = await base44.entities.MessageThread.create({
            contact_id: target_contact_id,
            thread_type: threadOrigem.thread_type,
            channel: threadOrigem.channel,
            status: 'aberta',
            is_canonical: true,
            whatsapp_integration_id: threadOrigem.whatsapp_integration_id,
            last_message_content: threadOrigem.last_message_content,
            last_message_at: threadOrigem.last_message_at,
            last_message_sender: threadOrigem.last_message_sender,
            unread_count: threadOrigem.unread_count,
            total_mensagens: threadInfo.total_mensagens
          });
          
          console.log(`[SINCRONIZAR] ✅ Nova thread criada: ${threadDestino.id.substring(0, 8)}`);
        }

        // Atualizar todas as mensagens desta thread para apontar à nova thread
        const msgsDaThreadOrigem = await base44.entities.Message.filter({
          thread_id: threadInfo.id
        }, '-sent_at', 1000);

        for (const msg of (msgsDaThreadOrigem || [])) {
          await base44.entities.Message.update(msg.id, {
            thread_id: threadDestino.id
          });
        }

        // Marcar a thread origem como merged
        await base44.entities.MessageThread.update(threadInfo.id, {
          status: 'merged',
          merged_into: threadDestino.id
        });

        threadsAtualizadas_count++;
        console.log(`[SINCRONIZAR] ✅ Thread ${threadInfo.id.substring(0, 8)} mesclada → ${threadDestino.id.substring(0, 8)}`);
      } catch (error) {
        console.error(`[SINCRONIZAR] ❌ Erro ao atualizar thread:`, error.message);
      }
    }

    // 5️⃣ DELETAR CONTATO ORIGEM (opcionalmente)
    // await base44.entities.Contact.delete(contact_id);

    const resultado = {
      success: true,
      stats: {
        threads_encontradas: threadsAtualizadas.length,
        threads_sincronizadas: threadsAtualizadas_count,
        mensagens_encontradas: messagensOrfas.length,
        mensagens_atualizadas: atualizadas,
        erros_sincronizacao: erros
      },
      detalhes: {
        contact_origem: contact_id,
        contact_destino: target_contact_id,
        threads: threadsAtualizadas
      }
    };

    console.log(`[SINCRONIZAR] ✅ CONCLUÍDO:`, resultado.stats);

    return Response.json(resultado);
  } catch (error) {
    console.error('[SINCRONIZAR] ❌ Erro geral:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});