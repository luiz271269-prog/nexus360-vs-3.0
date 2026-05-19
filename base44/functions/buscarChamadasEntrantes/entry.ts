import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Busca chamadas 1:1 onde o usuário é o callee direto
    const sessoes1a1 = await base44.asServiceRole.entities.CallSession.filter(
      { callee_id: user.id, status: 'chamando', modo: 'interno_webrtc' },
      '-created_date',
      10
    );

    // Busca todas as chamadas recentes de grupo (callee_ids não é filtrável diretamente)
    // Pega as últimas 100 chamadas e filtra no lado servidor
    const sessoesRecentes = await base44.asServiceRole.entities.CallSession.filter(
      { status: 'chamando', modo: 'interno_webrtc' },
      '-created_date',
      100
    );

    const sessoesGrupo = sessoesRecentes.filter(s =>
      Array.isArray(s.callee_ids) &&
      s.callee_ids.includes(user.id) &&
      s.callee_id !== user.id // evita duplicar com sessoes1a1
    );

    // Unifica e deduplica por id
    const todas = [...sessoes1a1, ...sessoesGrupo];
    const unicas = todas.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);

    return Response.json({ sessoes: unicas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});