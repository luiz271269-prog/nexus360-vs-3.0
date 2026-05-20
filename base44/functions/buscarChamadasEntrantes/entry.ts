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

    // ── 1. WebRTC 1:1: usuário é callee_id direto ─────────────────────────
    const sessoes1a1 = await base44.asServiceRole.entities.CallSession.filter(
      { callee_id: user.id, status: 'chamando', modo: 'interno_webrtc' },
      '-created_date',
      10
    );

    // ── 2. WebRTC grupo legado (caso ainda exista no banco) ───────────────
    const sessoesWebrtcRecentes = await base44.asServiceRole.entities.CallSession.filter(
      { status: 'chamando', modo: 'interno_webrtc' },
      '-created_date',
      100
    );
    const sessoesWebrtcGrupo = sessoesWebrtcRecentes.filter(s =>
      Array.isArray(s.callee_ids) &&
      s.callee_ids.includes(user.id) &&
      s.callee_id !== user.id
    );

    // ── 3. Jitsi GRUPO INTERNO: modo=externo_jitsi com thread_id ──────────
    // (chamadas Jitsi externas para contato WhatsApp não têm thread_id ou
    //  têm contact_id e não devem alertar atendentes que estão na thread)
    const sessoesJitsiRecentes = await base44.asServiceRole.entities.CallSession.filter(
      { status: 'ativa', modo: 'externo_jitsi' },
      '-created_date',
      100
    );
    const sessoesJitsiGrupo = sessoesJitsiRecentes.filter(s =>
      Array.isArray(s.callee_ids) &&
      s.callee_ids.length > 0 &&
      s.callee_ids.includes(user.id) &&
      !!s.thread_id &&        // só interno (tem thread)
      !s.contact_id &&        // exclui chamadas externas para contato
      s.caller_id !== user.id // não notifica quem iniciou
    );

    // ── Unifica, deduplica e marca tipo ───────────────────────────────────
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