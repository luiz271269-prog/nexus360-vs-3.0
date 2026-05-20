import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Retorna chamadas entrantes ativas para o usuário autenticado.
 *
 * Cobre os 3 cenários da Fase 0:
 *   1. WebRTC 1:1 interno      → modo='interno_webrtc' + callee_id=user.id
 *   2. Jitsi grupo interno     → modo='externo_jitsi'  + thread_id != null + callee_ids ∋ user.id
 *   3. (Não cobre externo Jitsi para contato WhatsApp — não é chamada "entrante" para atendente)
 *
 * Retorna a lista enriquecida com `is_grupo_jitsi: boolean` para o front
 * decidir o overlay correto (WhatsAppCallOverlay vs VideoCallModule).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── UNIFICADO: 1 query com $or cobre os 3 cenários da Fase 0 ──────────
    // Cenário A: WebRTC 1:1 → modo='interno_webrtc' + status='chamando' + callee_id=user.id
    // Cenário B: WebRTC grupo legado → modo='interno_webrtc' + status='chamando' + callee_ids ∋ user.id
    // Cenário C: Jitsi grupo interno → modo='externo_jitsi' + status='ativa' + thread_id + callee_ids ∋ user.id
    const candidatas = await base44.asServiceRole.entities.CallSession.filter(
      {
        $or: [
          { modo: 'interno_webrtc', status: 'chamando' },
          { modo: 'externo_jitsi', status: 'ativa' }
        ]
      },
      '-created_date',
      150
    );

    const sessoes1a1 = candidatas.filter(s =>
      s.modo === 'interno_webrtc' && s.status === 'chamando' && s.callee_id === user.id
    );
    const sessoesWebrtcGrupo = candidatas.filter(s =>
      s.modo === 'interno_webrtc' &&
      s.status === 'chamando' &&
      Array.isArray(s.callee_ids) &&
      s.callee_ids.includes(user.id) &&
      s.callee_id !== user.id
    );
    const sessoesJitsiGrupo = candidatas.filter(s =>
      s.modo === 'externo_jitsi' &&
      s.status === 'ativa' &&
      Array.isArray(s.callee_ids) &&
      s.callee_ids.length > 0 &&
      s.callee_ids.includes(user.id) &&
      !!s.thread_id &&
      !s.contact_id &&
      s.caller_id !== user.id
    );

    const todas = [
      ...sessoes1a1.map(s => ({ ...s, is_grupo_jitsi: false })),
      ...sessoesWebrtcGrupo.map(s => ({ ...s, is_grupo_jitsi: false })),
      ...sessoesJitsiGrupo.map(s => ({ ...s, is_grupo_jitsi: true }))
    ];
    const unicas = todas.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);

    return Response.json({ sessoes: unicas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});