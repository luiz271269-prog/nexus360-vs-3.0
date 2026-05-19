import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Busca uma CallSession pelo ID usando service role (bypassa RLS).
 * Necessário para o callee conseguir ler a sessão criada pelo caller.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId } = await req.json();
    if (!sessionId) return Response.json({ error: 'sessionId obrigatório' }, { status: 400 });

    const session = await base44.asServiceRole.entities.CallSession.get(sessionId);
    if (!session) return Response.json({ error: 'Sessão não encontrada' }, { status: 404 });

    // Verifica se o usuário é caller ou callee desta sessão
    if (session.caller_id !== user.id && session.callee_id !== user.id) {
      return Response.json({ error: 'Sem permissão para esta sessão' }, { status: 403 });
    }

    return Response.json({ session });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});