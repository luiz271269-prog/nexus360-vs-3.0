import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id, content, media_type, media_url, media_caption, reply_to_message_id } = await req.json();

    if (!thread_id || !content) {
      return Response.json({ error: 'thread_id e content são obrigatórios' }, { status: 400 });
    }

    // Buscar thread
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    if (!thread) {
      return Response.json({ error: 'Thread não encontrada' }, { status: 404 });
    }

    // Validar que é thread interna
    if (thread.thread_type !== 'team_internal' && thread.thread_type !== 'sector_group') {
      return Response.json({ error: 'Thread não é interna' }, { status: 400 });
    }

    // Criar mensagem
    const newMessage = await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: user.id,
      sender_type: 'user',
      recipient_type: 'user',
      content: content,
      channel: 'interno',
      media_type: media_type || 'none',
      media_url: media_url || null,
      media_caption: media_caption || null,
      reply_to_message_id: reply_to_message_id || null,
      status: 'enviada',
      sent_at: new Date().toISOString(),
      metadata: {
        is_internal_message: true,
        user_name: user.full_name || user.display_name || user.email
      }
    });

    // Atualizar thread: last_message_at, total_mensagens, unread_by
    const unreadBy = thread.unread_by || {};
    const participants = thread.participants || [];
    
    // Incrementar unread_count para todos EXCETO o remetente
    participants.forEach((participantId) => {
      if (participantId !== user.id) {
        unreadBy[participantId] = (unreadBy[participantId] || 0) + 1;
      }
    });

    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_message_at: new Date().toISOString(),
      last_message_content: content.substring(0, 100),
      last_message_sender: 'user',
      last_message_sender_name: user.full_name || user.display_name || user.email,
      total_mensagens: (thread.total_mensagens || 0) + 1,
      unread_by: unreadBy
    });

    return Response.json({
      success: true,
      message: newMessage
    });

  } catch (error) {
    console.error('[sendInternalMessage] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});