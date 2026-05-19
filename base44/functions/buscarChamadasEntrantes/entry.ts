import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Usa service role para bypassar RLS e buscar chamadas destinadas ao usuário autenticado
    const sessoes = await base44.asServiceRole.entities.CallSession.filter(
      { callee_id: user.id, status: 'chamando', modo: 'interno_webrtc' },
      '-created_date',
      10
    );

    return Response.json({ sessoes: sessoes || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});