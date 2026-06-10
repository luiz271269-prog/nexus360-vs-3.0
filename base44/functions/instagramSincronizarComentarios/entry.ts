import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * SINCRONIZAR COMENTÁRIOS DO INSTAGRAM → CENTRAL DE COMUNICAÇÃO
 * Busca os comentários dos posts recentes da conta conectada e cria
 * Contact + MessageThread (canal instagram) + Message para cada comentário novo.
 * Idempotente: dedup por instagram_message_id (id do comentário).
 * Executado por automação agendada (a cada 10 min) ou manualmente por admin.
 */

const GRAPH = 'https://graph.instagram.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');

    // Conta própria (para ignorar respostas nossas)
    const meRes = await fetch(`${GRAPH}/me?fields=id,username&access_token=${accessToken}`);
    const me = await meRes.json();
    if (!me.id) {
      return Response.json({ error: 'Falha ao identificar conta Instagram', details: me }, { status: 500 });
    }

    // Posts recentes
    const mediaRes = await fetch(`${GRAPH}/me/media?fields=id,permalink,caption,timestamp&limit=10&access_token=${accessToken}`);
    const mediaData = await mediaRes.json();
    const posts = mediaData.data || [];

    // Coletar todos os comentários dos posts
    const comentarios = [];
    for (const post of posts) {
      const cRes = await fetch(`${GRAPH}/${post.id}/comments?fields=id,text,username,from,timestamp&limit=50&access_token=${accessToken}`);
      const cData = await cRes.json();
      for (const c of (cData.data || [])) {
        const username = c.from?.username || c.username;
        if (!username || username === me.username) continue; // ignora comentários da própria conta
        comentarios.push({
          comment_id: c.id,
          text: c.text || '',
          username,
          user_igsid: c.from?.id || null,
          timestamp: c.timestamp,
          media_id: post.id,
          permalink: post.permalink
        });
      }
    }

    if (comentarios.length === 0) {
      return Response.json({ success: true, novos: 0, motivo: 'Nenhum comentário encontrado' });
    }

    // Dedup: quais comentários já existem como Message
    const idsComentarios = comentarios.map(c => c.comment_id);
    const existentes = await base44.asServiceRole.entities.Message.filter(
      { instagram_message_id: { $in: idsComentarios } }, '-created_date', 200
    );
    const idsExistentes = new Set((existentes || []).map(m => m.instagram_message_id));
    const novos = comentarios.filter(c => !idsExistentes.has(c.comment_id));

    let criados = 0;
    const threadsCache = {};

    for (const c of novos) {
      // 1. Contato (por instagram_id ou nome de usuário)
      let contato = null;
      if (c.user_igsid) {
        const porId = await base44.asServiceRole.entities.Contact.filter({ instagram_id: c.user_igsid }, '-created_date', 1);
        contato = porId[0] || null;
      }
      if (!contato) {
        const porNome = await base44.asServiceRole.entities.Contact.filter({ nome: `@${c.username}` }, '-created_date', 1);
        contato = porNome[0] || null;
      }
      if (!contato) {
        contato = await base44.asServiceRole.entities.Contact.create({
          nome: `@${c.username}`,
          instagram_id: c.user_igsid || undefined,
          tipo_contato: 'novo',
          conexao_origem: 'instagram_comentarios',
          observacoes: 'Criado automaticamente a partir de comentário no Instagram'
        });
      }

      // 2. Thread do canal instagram (cache por contato dentro do loop)
      let thread = threadsCache[contato.id];
      if (!thread) {
        const threads = await base44.asServiceRole.entities.MessageThread.filter(
          { contact_id: contato.id, channel: 'instagram' }, '-created_date', 1
        );
        thread = threads[0] || null;
        if (!thread) {
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contato.id,
            channel: 'instagram',
            thread_type: 'contact_external',
            status: 'aberta',
            sector_id: 'vendas',
            primeira_mensagem_at: new Date().toISOString()
          });
        }
        threadsCache[contato.id] = thread;
      }

      // 3. Mensagem do comentário
      const conteudo = `💬 Comentou no post: "${c.text}"`;
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: contato.id,
        sender_type: 'contact',
        content: conteudo,
        channel: 'instagram',
        provider: 'instagram_api',
        status: 'recebida',
        instagram_message_id: c.comment_id,
        sent_at: c.timestamp || new Date().toISOString(),
        metadata: {
          instagram_comment: true,
          instagram_media_id: c.media_id,
          instagram_permalink: c.permalink,
          instagram_username: c.username,
          canal_nome: 'Instagram - Comentários'
        }
      });

      // 4. Atualizar resumo da thread
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        last_message_content: conteudo.substring(0, 200),
        last_message_at: new Date().toISOString(),
        last_inbound_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_sender_name: `@${c.username}`,
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1,
        status: 'aberta'
      });
      thread.unread_count = (thread.unread_count || 0) + 1;
      thread.total_mensagens = (thread.total_mensagens || 0) + 1;

      criados++;
    }

    console.log(`[IG COMENTÁRIOS] ${posts.length} posts verificados, ${comentarios.length} comentários, ${criados} novos sincronizados`);

    return Response.json({
      success: true,
      posts_verificados: posts.length,
      comentarios_encontrados: comentarios.length,
      novos: criados
    });

  } catch (error) {
    console.error('[IG COMENTÁRIOS] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});