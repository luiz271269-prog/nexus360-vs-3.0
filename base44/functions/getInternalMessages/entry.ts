import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Busca mensagens de threads internas (grupo) sem restrição de RLS
// Necessário porque mensagens de grupo têm recipient_id=null (RLS bloqueia para não-remetentes)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const base44 = createClientFromRequest(req);

  const { thread_id, before_sent_at, limit = 20 } = await req.json().catch(() => ({}));
  // before_sent_at contém created_date (nome legado mantido para compatibilidade)

  if (!thread_id) {
    return Response.json({ success: false, error: 'thread_id required' }, { status: 400 });
  }

  // ⚡ PERF: auth.me(), thread (para validação) e mensagens TODOS em PARALELO.
  // Mantém todos os guards — dados só são retornados após validar usuário e permissão.
  const filter = { thread_id };
  if (before_sent_at) {
    filter.created_date = { $lt: before_sent_at };
  }

  const [user, thread, messages] = await Promise.all([
    base44.auth.me().catch(() => null),
    base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null),
    base44.asServiceRole.entities.Message.filter(filter, '-created_date', limit).catch(() => null)
  ]);

  if (!user) {
    return Response.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  if (messages === null) {
    return Response.json({ success: false, error: 'fetch_failed' }, { status: 500 });
  }

  if (!thread) {
    return Response.json({ success: false, error: 'thread not found' }, { status: 404 });
  }

  // Para sector_group: qualquer usuário autenticado pode ler (grupo aberto ao setor)
  // Para team_internal: apenas participantes ou admin
  const isSectorGroup = thread.thread_type === 'sector_group';
  const isParticipant = (thread.participants || []).includes(user.id);
  const isAdmin = user.role === 'admin';

  if (!isSectorGroup && !isParticipant && !isAdmin) {
    return Response.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  return Response.json({ success: true, messages });
});