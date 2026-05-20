import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Grava webrtc_answer + status='ativa' na CallSession via service role.
 *
 * Por que existe:
 * A CallSession é criada pela skillInitiateVideoCall em service role
 * (created_by = service+...). O callee (que aceita a chamada) NÃO é o
 * created_by, então o SDK do user é bloqueado pela RLS ao tentar
 * update da entidade. Resultado: webrtc_answer fica preso no navegador
 * do callee, caller espera answer infinitamente e a chamada cai.
 *
 * Esta função:
 *   1. Autentica o user
 *   2. Valida que o user é o callee_id (ou está em callee_ids[]) da sessão
 *   3. Grava webrtc_answer + status='ativa' via service role (bypassa RLS)
 *
 * Espelha o padrão já usado em publicarIceChamada para os ICE candidates.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, webrtc_answer } = await req.json();

    if (!sessionId || !webrtc_answer) {
      return Response.json(
        { error: 'sessionId e webrtc_answer são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca a sessão via service role (callee pode não ter permissão de leitura direta)
    const session = await base44.asServiceRole.entities.CallSession.get(sessionId);
    if (!session) {
      return Response.json({ error: 'CallSession não encontrada' }, { status: 404 });
    }

    // Valida que o user autenticado é destinatário da chamada
    const calleeIds = Array.isArray(session.callee_ids) ? session.callee_ids : [];
    const ehCallee = session.callee_id === user.id || calleeIds.includes(user.id);
    if (!ehCallee) {
      return Response.json(
        { error: 'Usuário não é destinatário desta chamada' },
        { status: 403 }
      );
    }

    // Grava answer + ativa via service role (bypassa RLS)
    await base44.asServiceRole.entities.CallSession.update(sessionId, {
      webrtc_answer,
      status: 'ativa'
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});