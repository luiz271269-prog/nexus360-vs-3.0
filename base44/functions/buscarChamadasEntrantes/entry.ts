import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Cache GLOBAL compartilhado entre todos os usuários (best-effort por isolate) ──
// O resultado do filter é o mesmo para todos — a filtragem por user.id é client-side aqui.
// 1 query Base44 a cada 5s serve N atendentes simultâneos no mesmo isolate.
type CacheEntry = { createdAt: number; candidatas: any[] };
const CACHE_TTL_MS = 5000;        // idade máxima para servir cache "fresco"
const STALE_MAX_MS = 30000;       // idade máxima para servir cache "stale" em caso de 429
let cacheGlobal: CacheEntry | null = null;
let inflight: Promise<any[]> | null = null; // dedup de requests concorrentes no mesmo isolate

/**
 * Retorna chamadas entrantes ativas para o usuário autenticado.
 *
 * Cobre os 3 cenários da Fase 0:
 *   1. WebRTC 1:1 interno      → modo='interno_webrtc' + callee_id=user.id
 *   2. WebRTC grupo legado     → modo='interno_webrtc' + callee_ids ∋ user.id
 *   3. Jitsi grupo interno     → modo='externo_jitsi'  + thread_id != null + callee_ids ∋ user.id
 *
 * Retorna a lista enriquecida com `is_grupo_jitsi: boolean` para o front
 * decidir o overlay correto (WhatsAppCallOverlay vs VideoCallModule).
 *
 * Otimizações operacionais:
 *   - Cache 2.5s por usuário (absorve poll de 4s do IncomingCallAlert)
 *   - Retry curto (120ms / 250ms) apenas para 429
 *   - Stale-cache fallback (até 15s) em caso de erro persistente
 */
Deno.serve(async (req) => {
  let user: any = null;

  try {
    const base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const agora = Date.now();

    // ── Cache global fresco: serve direto sem bater no banco ─────────────
    let candidatas: any[];
    if (cacheGlobal && (agora - cacheGlobal.createdAt) <= CACHE_TTL_MS) {
      candidatas = cacheGlobal.candidatas;
    } else if (inflight) {
      // Outra requisição no mesmo isolate já está buscando — aguarda ela em vez de duplicar
      candidatas = await inflight;
    } else {
      // ── UNIFICADO: 1 query com $or cobre os 3 cenários da Fase 0 ────────
      // SEM RETRY interno: 429 propaga para o catch → degraded response.
      inflight = base44.asServiceRole.entities.CallSession.filter(
        {
          $or: [
            { modo: 'interno_webrtc', status: 'chamando' },
            { modo: 'externo_jitsi', status: 'ativa' }
          ]
        },
        '-created_date',
        80
      );
      try {
        candidatas = await inflight;
        cacheGlobal = { createdAt: agora, candidatas };
      } finally {
        inflight = null;
      }
    }

    const sessoes1a1 = candidatas.filter((s: any) =>
      s.modo === 'interno_webrtc' && s.status === 'chamando' && s.callee_id === user.id
    );
    const sessoesWebrtcGrupo = candidatas.filter((s: any) =>
      s.modo === 'interno_webrtc' &&
      s.status === 'chamando' &&
      Array.isArray(s.callee_ids) &&
      s.callee_ids.includes(user.id) &&
      s.callee_id !== user.id
    );
    const sessoesJitsiGrupo = candidatas.filter((s: any) =>
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
      ...sessoes1a1.map((s: any) => ({ ...s, is_grupo_jitsi: false })),
      ...sessoesWebrtcGrupo.map((s: any) => ({ ...s, is_grupo_jitsi: false })),
      ...sessoesJitsiGrupo.map((s: any) => ({ ...s, is_grupo_jitsi: true }))
    ];
    const unicas = todas.filter((s: any, i: number, arr: any[]) =>
      arr.findIndex((x: any) => x.id === s.id) === i
    );

    return Response.json({ sessoes: unicas });
  } catch (error: any) {
    const agora = Date.now();
    const is429 = error?.status === 429
      || error?.response?.status === 429
      || /429|rate.?limit|taxa|too many/i.test(error?.message || '');

    if (is429) {
      // Stale-cache fallback: usa cache global (de qualquer usuário) se recente (≤ 30s)
      if (cacheGlobal && (agora - cacheGlobal.createdAt) <= STALE_MAX_MS && user?.id) {
        // Re-filtra as candidatas em cache pelo user atual (mantendo segurança por id)
        const candidatas = cacheGlobal.candidatas;
        const sessoes1a1 = candidatas.filter((s: any) =>
          s.modo === 'interno_webrtc' && s.status === 'chamando' && s.callee_id === user.id
        );
        const sessoesWebrtcGrupo = candidatas.filter((s: any) =>
          s.modo === 'interno_webrtc' &&
          s.status === 'chamando' &&
          Array.isArray(s.callee_ids) &&
          s.callee_ids.includes(user.id) &&
          s.callee_id !== user.id
        );
        const sessoesJitsiGrupo = candidatas.filter((s: any) =>
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
          ...sessoes1a1.map((s: any) => ({ ...s, is_grupo_jitsi: false })),
          ...sessoesWebrtcGrupo.map((s: any) => ({ ...s, is_grupo_jitsi: false })),
          ...sessoesJitsiGrupo.map((s: any) => ({ ...s, is_grupo_jitsi: true }))
        ];
        const unicas = todas.filter((s: any, i: number, arr: any[]) =>
          arr.findIndex((x: any) => x.id === s.id) === i
        );
        return Response.json({ sessoes: unicas, degraded: true, source: 'stale_cache' });
      }
      // Sem cache válido → degraded response (HTTP 200, frontend não recebe 500)
      return Response.json({
        sessoes: [],
        degraded: true,
        reason: user?.id ? 'rate_limited' : 'rate_limited_auth'
      });
    }

    // 401/403/outros erros → 500 (não mascara problemas reais)
    return Response.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
});