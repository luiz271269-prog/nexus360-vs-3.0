import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Retorna as threads internas (team_internal e sector_group) onde o usuário
// autenticado é participante. Usa asServiceRole para contornar a RLS de
// MessageThread (que só libera por assigned_user_id/shared_with_users/admin
// e ignora o campo participants). Admin recebe todas as internas.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const internas = await base44.asServiceRole.entities.MessageThread.filter(
      { thread_type: { $in: ['team_internal', 'sector_group'] } },
      '-last_message_at',
      100
    );

    const isAdmin = user.role === 'admin';
    const threads = isAdmin
      ? internas
      : internas.filter((t) => Array.isArray(t.participants) && t.participants.includes(user.id));

    return Response.json({ threads });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});