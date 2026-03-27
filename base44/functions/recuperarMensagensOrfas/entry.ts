import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { dry_run = true, criar_threads = false } = body;

    // Buscar todas as mensagens de contatos (sender_type = contact)
    const todasMensagens = await base44.asServiceRole.entities.Message.list('-sent_at', 10000);

    // Buscar todas as threads existentes
    const todasThreads = await base44.asServiceRole.entities.MessageThread.list('-created_date', 5000);

    // Buscar todos os contatos
    const todosContatos = await base44.asServiceRole.entities.Contact.list('-created_date', 5000);

    // Criar Set de contact_ids que JÁ TÊM thread
    const contactIdsComThread = new Set(
      todasThreads.filter(t => t.contact_id).map(t => t.contact_id)
    );

    // Agrupar mensagens por contato
    const mensagensPorContato = {};
    for (const msg of todasMensagens) {
      if (msg.sender_type !== 'contact' || !msg.sender_id) continue;
      if (contactIdsComThread.has(msg.sender_id)) continue;

      if (!mensagensPorContato[msg.sender_id]) {
        mensagensPorContato[msg.sender_id] = [];
      }
      mensagensPorContato[msg.sender_id].push(msg);
    }

    const contatosOrfaos = Object.keys(mensagensPorContato);
    const contatoMap = new Map(todosContatos.map(c => [c.id, c]));

    const resultado = contatosOrfaos.map(contactId => {
      const contato = contatoMap.get(contactId);
      const msgs = mensagensPorContato[contactId];
      const msgsSorted = msgs.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
      const ultimaMensagem = msgsSorted[0];
      return {
        contactId,
        nome: contato?.nome || 'Desconhecido',
        telefone: contato?.telefone || null,
        totalMensagens: msgs.length,
        ultimaMensagem: ultimaMensagem?.sent_at,
        ultimoConteudo: ultimaMensagem?.content?.substring(0, 100)
      };
    });

    const threadsCreadas = [];
    if (criar_threads && !dry_run) {
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list();
      const integracaoAtiva = integracoes.find(i => i.status === 'conectado');

      if (!integracaoAtiva) {
        return Response.json({
          success: false,
          error: 'Nenhuma integração WhatsApp conectada para criar threads'
        });
      }

      for (const item of resultado) {
        try {
          const novaThread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: item.contactId,
            whatsapp_integration_id: integracaoAtiva.id,
            conexao_id: integracaoAtiva.id,
            thread_type: 'contact_external',
            channel: 'whatsapp',
            is_canonical: true,
            status: 'aberta',
            unread_count: item.totalMensagens,
            total_mensagens: item.totalMensagens,
            last_message_at: item.ultimaMensagem,
            last_message_content: item.ultimoConteudo,
            last_message_sender: 'contact',
            primeira_mensagem_at: item.ultimaMensagem
          });
          threadsCreadas.push({ contactId: item.contactId, threadId: novaThread.id, nome: item.nome });
        } catch (e) {
          console.error(`Erro ao criar thread para ${item.contactId}:`, e.message);
        }
      }
    }

    return Response.json({
      success: true,
      dry_run,
      totalContatosOrfaos: resultado.length,
      contatosOrfaos: resultado,
      threadsCreadas: threadsCreadas.length > 0 ? threadsCreadas : []
    });

  } catch (error) {
    console.error('[recuperarMensagensOrfas] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});