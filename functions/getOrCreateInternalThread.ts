import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_ids } = await req.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length !== 2) {
      return Response.json({ error: 'user_ids deve conter exatamente 2 IDs' }, { status: 400 });
    }

    // Criar pair_key único (ordenado)
    const sortedIds = [...user_ids].sort();
    const pairKey = `${sortedIds[0]}:${sortedIds[1]}`;

    // Buscar thread existente com este pair_key
    let threads = await base44.asServiceRole.entities.MessageThread.filter({ pair_key: pairKey });

    if (threads.length > 0) {
      // Thread já existe
      return Response.json({
        success: true,
        thread: threads[0],
        created: false
      });
    }

    // Criar nova thread interna 1:1
    const newThread = await base44.asServiceRole.entities.MessageThread.create({
      thread_type: 'team_internal',
      channel: 'interno',
      is_canonical: true,
      status: 'aberta',
      pair_key: pairKey,
      participants: user_ids,
      is_group_chat: false,
      unread_by: {
        [user_ids[0]]: 0,
        [user_ids[1]]: 0
      },
      total_mensagens: 0,
      primeira_mensagem_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      thread: newThread,
      created: true
    });

  } catch (error) {
    console.error('[getOrCreateInternalThread] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});