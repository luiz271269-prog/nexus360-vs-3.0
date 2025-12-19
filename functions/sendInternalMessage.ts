import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const {
      thread_id,
      content,
      media_type = 'none',
      media_url,
      media_caption,
      reply_to_message_id
    } = payload;

    if (!thread_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'thread_id obrigatorio' }),
        { status: 400, headers }
      );
    }

    if (!content && !media_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'content ou media_url obrigatorio' }),
        { status: 400, headers }
      );
    }

    const user = await base44.auth.me();
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }

    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);

    if (!thread) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thread nao encontrada' }),
        { status: 404, headers }
      );
    }

    if (thread.thread_type !== 'team_internal' && thread.thread_type !== 'sector_group') {
      return new Response(
        JSON.stringify({ success: false, error: 'Thread nao eh interna' }),
        { status: 400, headers }
      );
    }

    if (!thread.participants || !thread.participants.includes(user.id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario nao eh participante' }),
        { status: 403, headers }
      );
    }

    let contentFinal = content || '';

    if (!contentFinal && media_type !== 'none') {
      const tipoMap = {
        'image': '[Imagem]',
        'video': '[Video]',
        'audio': '[Audio]',
        'document': '[Documento]'
      };
      contentFinal = tipoMap[media_type] || '[Midia]';
    }

    const agora = new Date().toISOString();

    const messageData = {
      thread_id: thread.id,
      sender_id: user.id,
      sender_type: 'user',
      content: contentFinal,
      media_type: media_type,
      media_url: media_url || null,
      media_caption: media_caption || null,
      channel: 'interno',
      provider: 'internal_system',
      status: 'enviada',
      sent_at: agora,
      delivered_at: agora,
      read_at: null,
      metadata: {
        user_name: user.full_name || user.email,
        ...(payload.metadata || {})
      }
    };

    if (reply_to_message_id) {
      messageData.reply_to_message_id = reply_to_message_id;
    }

    const savedMessage = await base44.asServiceRole.entities.Message.create(messageData);

    let currentUnreads = thread.unread_by || {};
    currentUnreads[user.id] = 0;

    thread.participants.forEach(participantId => {
      if (participantId !== user.id) {
        currentUnreads[participantId] = (currentUnreads[participantId] || 0) + 1;
      }
    });

    let previewContent = content ? content.substring(0, 200) : '';

    if (!previewContent && media_type !== 'none') {
      const previewMap = {
        'image': 'Imagem',
        'video': 'Video',
        'audio': 'Audio',
        'document': 'Documento'
      };
      previewContent = previewMap[media_type] || 'Midia';
    }

    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      last_message_at: savedMessage.sent_at,
      last_message_content: previewContent,
      last_message_sender: 'user',
      last_media_type: media_type,
      unread_by: currentUnreads
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: savedMessage
      }),
      { status: 200, headers }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno'
      }),
      { status: 500, headers }
    );
  }
});