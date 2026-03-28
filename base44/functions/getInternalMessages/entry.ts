import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Busca mensagens de threads internas (grupo) sem restrição de RLS
// Necessário porque mensagens de grupo têm recipient_id=null (RLS bloqueia para não-remetentes)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const base44 = createClientFromRequest(req);

  // Validar usuário autenticado
  const user = await base44.auth.me().catch(() => null);
  if (!user) {
    return Response.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  const { thread_id, before_sent_at, limit = 20 } = await req.json().catch(() => ({}));
  // before_sent_at contém created_date (nome legado mantido para compatibilidade)

  if (!thread_id) {
    return Response.json({ success: false, error: 'thread_id required' }, { status: 400 });
  }

  // Verificar se o usuário é participante da thread
  const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null);
  if (!thread) {
    return Response.json({ success: false, error: 'thread not found' }, { status: 404 });
  }

  const isParticipant = thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group'
    ? (thread.participants || []).includes(user.id)
    : false;

  if (!isParticipant && user.role !== 'admin') {
    return Response.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const filter = { thread_id };
  if (before_sent_at) {
    filter.created_date = { $lt: before_sent_at };
  }

  const messages = await base44.asServiceRole.entities.Message.filter(
    filter,
    '-created_date',
    limit
  );

  return Response.json({ success: true, messages });
});