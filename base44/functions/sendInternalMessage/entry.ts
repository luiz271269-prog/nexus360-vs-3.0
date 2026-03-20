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
      reply_to_message_id,
      sender_id: senderIdOverride,       // ✅ Permite envio em nome de outro ID (ex: Jarvis/Copiloto)
      sender_name: senderNameOverride    // ✅ Nome de exibição (ex: "🤖 Jarvis")
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

    // ✅ IDENTIDADE DO REMETENTE:
    // Se vier sender_id_override (ex: Jarvis/automações), usa ele.
    // Só admins podem enviar em nome de outro ID.
    const JARVIS_SYSTEM_ID = 'jarvis_copiloto_ia';
    const isAdminOrSystem = user.role === 'admin';

    const effectiveSenderId = (senderIdOverride && isAdminOrSystem)
      ? senderIdOverride
      : user.id;

    const effectiveSenderName = (senderIdOverride && isAdminOrSystem && senderNameOverride)
      ? senderNameOverride
      : (senderIdOverride === JARVIS_SYSTEM_ID && isAdminOrSystem)
      ? '🤖 Jarvis'
      : (user.full_name || user.email);

    // ═══════════════════════════════════════════════════════════════════
    // 🎯 FLUXO EXCLUSIVO INTERNO - Zero validação de contact/WhatsApp
    // ═══════════════════════════════════════════════════════════════════
    let thread;
    try {
      thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);

      if (!thread) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thread nao encontrada' }),
          { status: 404, headers }
        );
      }
    } catch (getError) {
      return new Response(
        JSON.stringify({ success: false, error: `Thread nao encontrada: ${getError.message}` }),
        { status: 404, headers }
      );
    }

    // ✅ VALIDAÇÃO CRÍTICA: Thread DEVE ser interna
    if (thread.thread_type !== 'team_internal' && thread.thread_type !== 'sector_group') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Esta funcao eh exclusiva para threads internas (team_internal/sector_group)'
        }),
        { status: 400, headers }
      );
    }

    // ✅ VALIDAÇÃO: Usuário deve ser participante ou admin
    const isParticipante = Array.isArray(thread.participants) && thread.participants.includes(user.id);
    const isAdmin = user.role === 'admin';
    const isJarvisOverride = senderIdOverride && isAdmin; // Jarvis/sistema bypassa validação de participante

    if (!isParticipante && !isAdmin && !isJarvisOverride) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Usuario nao eh participante desta thread interna'
        }),
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

    // ✅ DIFERENCIAR: 1:1 interno vs Grupo/Setor
    const is1on1 = thread.thread_type === 'team_internal' && 
                   !thread.is_group_chat && 
                   thread.participants?.length === 2;
    
    let recipientIdFinal = null;
    let recipientTypeFinal = 'group';
    
    if (is1on1) {
      // 🎯 1:1 INTERNO: Identificar o outro usuário como destinatário
      const outroUsuarioId = thread.participants.find(id => id !== user.id);
      if (outroUsuarioId) {
        recipientIdFinal = outroUsuarioId;
        recipientTypeFinal = 'user';
        console.log('[SEND_INTERNAL] 💬 Mensagem 1:1 para usuário:', outroUsuarioId);
      }
    } else {
      // 👥 GRUPO/SETOR: Broadcast para todos (recipient_id null)
      console.log('[SEND_INTERNAL] 👥 Mensagem de grupo - broadcast para todos os participantes');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🎯 PAYLOAD PURO INTERNO - Zero campos de WhatsApp/Contact
    // ═══════════════════════════════════════════════════════════════════
    const messageData = {
      thread_id: thread.id,
      sender_id: effectiveSenderId,
      sender_type: 'user',
      recipient_id: recipientIdFinal || null,
      recipient_type: recipientTypeFinal,
      content: contentFinal,
      channel: 'interno',
      visibility: 'internal_only',
      provider: 'internal_system',
      status: 'enviada',
      sent_at: agora,
      metadata: {
        is_internal_message: true,
        is_1on1: is1on1,
        sender_name: user.full_name || user.email
      }
    };

    // Campos opcionais (só se houver)
    if (media_type && media_type !== 'none') messageData.media_type = media_type;
    if (media_url) messageData.media_url = media_url;
    if (media_caption) messageData.media_caption = media_caption;
    if (reply_to_message_id) messageData.reply_to_message_id = reply_to_message_id;

    console.log('[SEND_INTERNAL] 🔵 Criando mensagem interna:', {
      thread_id: thread.id,
      thread_type: thread.thread_type,
      sender_id: user.id,
      sender_type: 'user',
      recipient_id: recipientIdFinal,
      recipient_type: recipientTypeFinal,
      channel: 'interno',
      visibility: 'internal_only',
      is_1on1: is1on1,
      participants_count: thread.participants?.length,
      content: contentFinal.substring(0, 50)
    });

    const savedMessage = await base44.asServiceRole.entities.Message.create(messageData);

    console.log('[SEND_INTERNAL] ✅ Mensagem criada com sucesso:', {
      message_id: savedMessage.id,
      thread_id: savedMessage.thread_id,
      sender_id: savedMessage.sender_id,
      channel: savedMessage.channel,
      visibility: savedMessage.visibility
    });

    // ✅ Garantir que user.id está em participants[] (mesmo padrão das threads externas)
    let participants = Array.isArray(thread.participants) ? [...thread.participants] : [];
    if (!participants.includes(user.id)) {
      participants.push(user.id);
    }

    // ✅ CORREÇÃO: Garantir que unread_by seja atualizado corretamente para TODOS os participantes
    let currentUnreads = thread.unread_by || {};
    
    // Zerar para o remetente
    currentUnreads[user.id] = 0;

    // ✅ Incrementar para TODOS os outros participantes (garantir que existam no objeto)
    participants.forEach(participantId => {
      if (participantId !== user.id) {
        currentUnreads[participantId] = (currentUnreads[participantId] || 0) + 1;
      }
    });

    console.log('[SEND_INTERNAL] 🔔 Atualizando unread_by:', currentUnreads);

    // ✅ Preview de conteúdo mais robusto
    let previewContent = content ? content.substring(0, 200) : '';

    if (!previewContent && media_type !== 'none') {
      const previewMap = {
        'image': '📷 Imagem',
        'video': '🎥 Vídeo',
        'audio': '🎤 Áudio',
        'document': '📄 Documento'
      };
      previewContent = previewMap[media_type] || '📎 Mídia';
    }

    // ✅ Atualizar thread com dados completos (incluindo participants[])
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      last_message_at: savedMessage.sent_at,
      last_message_content: previewContent,
      last_message_sender: 'user',
      last_message_sender_name: user.full_name || user.email,
      last_media_type: media_type,
      unread_by: currentUnreads,
      participants: participants,
      total_mensagens: (thread.total_mensagens || 0) + 1
    });

    console.log('[SEND_INTERNAL] ✅ Thread atualizada:', {
      thread_id: thread.id,
      total_mensagens: (thread.total_mensagens || 0) + 1,
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
    console.error('[SEND_INTERNAL] ❌ ERRO CRÍTICO:', {
      message: error.message,
      stack: error.stack
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno',
        details: error.stack
      }),
      { status: 500, headers }
    );
  }
});