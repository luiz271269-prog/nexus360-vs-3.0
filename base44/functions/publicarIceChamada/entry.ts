import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Publica ICE candidates em CallSession via service role.
 * Bypassa RLS para que o callee (que não é created_by) consiga escrever.
 * Valida que o usuário autenticado é caller ou callee da sessão.
 *
 * Entrada:
 *   { sessionId: string, isCaller: boolean, candidates: string[] }
 *
 * Saída:
 *   { success: boolean, error?: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, isCaller, candidates } = await req.json();
    if (!sessionId || !Array.isArray(candidates) || candidates.length === 0) {
      return Response.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const session = await base44.asServiceRole.entities.CallSession.get(sessionId);
    if (!session) {
      return Response.json({ success: false, error: 'Sessão não encontrada' }, { status: 404 });
    }

    // Validação: usuário deve ser caller ou callee da sessão
    const ehCaller = session.caller_id === user.id;
    const ehCallee = session.callee_id === user.id ||
      (Array.isArray(session.callee_ids) && session.callee_ids.includes(user.id));
    if (!ehCaller && !ehCallee) {
      return Response.json({ success: false, error: 'Sem permissão' }, { status: 403 });
    }

    const field = isCaller ? 'ice_candidates_caller' : 'ice_candidates_callee';
    const existing = Array.isArray(session[field]) ? session[field] : [];

    await base44.asServiceRole.entities.CallSession.update(sessionId, {
      [field]: [...existing, ...candidates]
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});