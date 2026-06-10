import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * RESPONDER COMENTÁRIO DO INSTAGRAM PELA CENTRAL
 * Recebe { thread_id, texto } e publica a resposta como reply público
 * no último comentário recebido da thread (via Graph API /replies).
 * Registra a Message do atendente na thread e atualiza o resumo.
 */

const GRAPH = 'https://graph.instagram.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id, texto } = await req.json();
    if (!thread_id || !texto?.trim()) {
      return Response.json({ success: false, error: 'thread_id e texto são obrigatórios' }, { status: 400 });
    }

    // Último comentário recebido nesta thread (alvo da resposta)
    const ultimosComentarios = await base44.asServiceRole.entities.Message.filter(
      { thread_id, sender_type: 'contact', channel: 'instagram' }, '-created_date', 1
    );
    const comentario = ultimosComentarios[0];
    if (!comentario?.instagram_message_id) {
      return Response.json({ success: false, error: 'Nenhum comentário do Instagram encontrado nesta conversa para responder' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');

    // Publicar resposta pública ao comentário
    const replyRes = await fetch(`${GRAPH}/${comentario.instagram_message_id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message: texto.trim(), access_token: accessToken })
    });
    const replyData = await replyRes.json();

    if (!replyData.id) {
      console.error('[IG RESPONDER] Erro da API:', JSON.stringify(replyData));
      return Response.json({
        success: false,
        error: replyData.error?.message || 'Falha ao publicar resposta no Instagram'
      }, { status: 500 });
    }

    // Registrar mensagem do atendente na thread
    await base44.asServiceRole.entities.Message.create({
      thread_id,
      sender_id: user.id,
      sender_type: 'user',
      recipient_id: comentario.sender_id,
      recipient_type: 'contact',
      content: texto.trim(),
      channel: 'instagram',
      provider: 'instagram_api',
      status: 'enviada',
      instagram_message_id: replyData.id,
      sent_at: new Date().toISOString(),
      metadata: {
        instagram_comment_reply: true,
        instagram_parent_comment_id: comentario.instagram_message_id,
        instagram_media_id: comentario.metadata?.instagram_media_id || null,
        instagram_permalink: comentario.metadata?.instagram_permalink || null,
        user_name: user.full_name,
        canal_nome: 'Instagram - Comentários'
      }
    });

    // Atualizar resumo da thread
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_message_content: texto.trim().substring(0, 200),
      last_message_at: new Date().toISOString(),
      last_outbound_at: new Date().toISOString(),
      last_human_message_at: new Date().toISOString(),
      last_message_sender: 'user',
      last_message_sender_name: user.full_name,
      unread_count: 0
    });

    console.log(`[IG RESPONDER] Resposta publicada: ${replyData.id} (comentário ${comentario.instagram_message_id})`);

    return Response.json({ success: true, reply_id: replyData.id });

  } catch (error) {
    console.error('[IG RESPONDER] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});