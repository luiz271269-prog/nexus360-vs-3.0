import { useEffect, useRef, useCallback, useState } from 'react';
import { base44 } from '@/api/base44Client';

// STUN-only fallback usado quando ConfiguracaoSistema não tem 'ice_servers' configurado
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

/**
 * Motor WebRTC para chamadas internas diretas (áudio e vídeo).
 * Sinalização via CallSession (Base44 entity).
 *
 * ⚠️ REGRA ARQUITETURAL — NÃO VIOLAR:
 * Este motor suporta SOMENTE chamadas 1:1 (P2P puro).
 *   - thread_type === 'team_internal' com 1 outro participante → OK aqui
 *   - thread_type === 'sector_group' ou >1 participante       → usar Jitsi (VideoCallModule)
 *
 * Por que: WebRTC peer-to-peer não escala para multipoint. Cada callee adicional
 * sobrescreve webrtc_answer no banco. Apenas 1 dos N conecta com áudio.
 *
 * callee_ids[] no schema serve APENAS para:
 *   - Roteamento de NOTIFICAÇÃO (todos recebem alerta)
 *   - Auditoria (quem foi convidado)
 * NÃO serve para roteamento de MÍDIA.
 *
 * Grupo não é "múltiplo destinatário". Grupo é outra topologia de mídia (SFU).
 */
export default function WebRTCCallManager({
  sessionId,
  isCaller,
  tipo = 'audio',
  localVideoRef,
  remoteVideoRef,
  localStreamRef: externalLocalStreamRef,
  onConnected,
  onEnded,
  onError
}) {
  const pcRef             = useRef(null);
  const internalStreamRef = useRef(null);
  const endedRef          = useRef(false);
  const remoteAudioElem   = useRef(null); // elemento <audio> real injetado no DOM
  const icePendingRef     = useRef([]);
  const appliedIceCaller  = useRef(new Set());
  const appliedIceCallee  = useRef(new Set());
  const publishingIce     = useRef(false);
  const iceQueueRef       = useRef([]); // fila local de ICE a publicar
  const icePollRef        = useRef(null); // ref para cleanup do poll de ICE pós-answer

  // ── Backoff 429: pula iterações quando rate-limited (1→2→4, teto 4) ────────
  const backoffCallerMain = useRef({ skip: 0, factor: 1 });
  const backoffCallerIce  = useRef({ skip: 0, factor: 1 });
  const backoffCalleeWait = useRef({ skip: 0, factor: 1 });
  const backoffCalleeIce  = useRef({ skip: 0, factor: 1 });

  // Detecção ampla de 429 (status, response.status ou mensagem)
  const is429 = (err) =>
    err?.status === 429 ||
    err?.response?.status === 429 ||
    /429|rate.?limit|too many/i.test(err?.message || '');

  // Wrapper: se for 429 → aumenta factor (teto 4) e seta skip; senão → reseta
  const withBackoff = async (ref, fn) => {
    if (ref.current.skip > 0) { ref.current.skip--; return; }
    try {
      await fn();
      ref.current.factor = 1; // sucesso reseta
    } catch (err) {
      if (is429(err)) {
        ref.current.skip = ref.current.factor;
        ref.current.factor = Math.min(ref.current.factor * 2, 4);
      }
      // outros erros: silencioso (mesma semântica do try/catch original)
    }
  };

  const localStreamRef = externalLocalStreamRef || internalStreamRef;

  // ── PATCH B: iceServers configurável via ConfiguracaoSistema ─────────────
  // Lê uma vez no mount. Fallback STUN se não houver config no banco.
  // Para adicionar TURN no futuro:
  //   ConfiguracaoSistema.create({
  //     categoria: 'video_call',
  //     chave: 'ice_servers',
  //     valor_json: [ {urls:'stun:...'}, {urls:'turn:...', username, credential} ]
  //   })
  const [iceServersConfig, setIceServersConfig] = useState(DEFAULT_ICE_SERVERS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await base44.entities.ConfiguracaoSistema.filter({
          categoria: 'video_call',
          chave: 'ice_servers'
        }, '-created_date', 1);
        if (cancelled) return;
        const cfg = rows?.[0]?.valor_json;
        if (Array.isArray(cfg) && cfg.length > 0) setIceServersConfig(cfg);
      } catch (_) { /* mantém STUN default */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (icePollRef.current) { clearInterval(icePollRef.current); icePollRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioElem.current) {
      remoteAudioElem.current.srcObject = null;
      remoteAudioElem.current.remove();
      remoteAudioElem.current = null;
    }
    if (localVideoRef?.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef?.current) remoteVideoRef.current.srcObject = null;
  }, []);

  // ── Aplica ICE deduplicado ────────────────────────────────────────────────
  const applyIce = useCallback(async (pc, candidates, seenSet) => {
    if (!candidates?.length || !pc) return;
    for (const c of candidates) {
      if (seenSet.has(c)) continue;
      seenSet.add(c);
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(c)));
        } else {
          icePendingRef.current.push(c);
        }
      } catch (_) {}
    }
  }, []);

  const flushPendingIce = useCallback(async (pc) => {
    const pending = [...icePendingRef.current];
    icePendingRef.current = [];
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(c))); } catch (_) {}
    }
  }, []);

  // ── Publica ICE em fila serial via backend (service role bypassa RLS) ──
  const publishIce = useCallback((candidate) => {
    iceQueueRef.current.push(JSON.stringify(candidate));
    if (publishingIce.current) return;
    const flush = async () => {
      publishingIce.current = true;
      while (iceQueueRef.current.length > 0) {
        const batch = [...iceQueueRef.current];
        iceQueueRef.current = [];
        if (endedRef.current) break;
        try {
          await base44.functions.invoke('publicarIceChamada', {
            sessionId,
            isCaller,
            candidates: batch
          });
        } catch (_) {}
      }
      publishingIce.current = false;
    };
    flush();
  }, [sessionId, isCaller]);

  // ── Inicia PeerConnection e captura microfone ─────────────────────────────
  const initPeerConnection = useCallback(async () => {
    const constraints = tipo === 'video'
      ? { audio: true, video: { width: 1280, height: 720, facingMode: 'user' } }
      : { audio: true, video: false };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      throw new Error('Permissão de microfone negada: ' + err.message);
    }

    localStreamRef.current = stream;

    if (localVideoRef?.current && tipo === 'video') {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
    }

    const pc = new RTCPeerConnection({ iceServers: iceServersConfig });
    pcRef.current = pc;

    // Adiciona todas as tracks (áudio obrigatório, vídeo opcional)
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) publishIce(e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      const remoteStream = e.streams?.[0] || (() => {
        const ms = new MediaStream();
        ms.addTrack(e.track);
        return ms;
      })();

      if (tipo === 'video' && remoteVideoRef?.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      } else {
        // Usa elemento <audio> real no DOM — evita bloqueio de autoplay
        if (!remoteAudioElem.current) {
          const audio = document.createElement('audio');
          audio.autoplay = true;
          audio.setAttribute('playsinline', '');
          audio.style.display = 'none';
          document.body.appendChild(audio);
          remoteAudioElem.current = audio;
        }
        remoteAudioElem.current.srcObject = remoteStream;
        remoteAudioElem.current.play().catch(() => {});
      }
    };

    // ── PATCH A: detecta falha de ICE/conexão e encerra via skill ──────────
    // Garante que o OUTRO LADO sempre vê CallSession.status='encerrada'
    // (cleanup local sozinho deixava sessão presa em 'ativa' no banco).
    const encerrarViaSkill = async (reason) => {
      try {
        await base44.functions.invoke('skillInitiateVideoCall', {
          action: 'encerrar',
          session_id: sessionId,
          ended_reason: reason
        });
      } catch (_) {}
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') onConnected?.();
      if (['disconnected', 'failed', 'closed'].includes(state)) {
        if (!endedRef.current) {
          // Só estados terminais reais disparam encerramento no servidor.
          // 'disconnected' pode ser transitório, mas se chegou aqui sem reconectar,
          // o cleanup vai rodar — então também encerramos.
          encerrarViaSkill(state === 'failed' ? 'ice_failed' : 'peer_disconnected');
          cleanup();
          onEnded?.();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed' && !endedRef.current) {
        encerrarViaSkill('ice_failed');
        cleanup();
        onEnded?.();
      }
    };

    return pc;
  }, [tipo, localVideoRef, remoteVideoRef, publishIce, onConnected, onEnded, cleanup, sessionId, iceServersConfig]);

  // ─── CALLER ──────────────────────────────────────────────────────────────
  const startAsCaller = useCallback(async () => {
    try {
      const pc = await initPeerConnection();

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: tipo === 'video'
      });
      await pc.setLocalDescription(offer);

      // Salva offer + muda para 'chamando' atomicamente
      await base44.entities.CallSession.update(sessionId, {
        webrtc_offer: JSON.stringify(offer),
        status: 'chamando'
      });

      let attempts = 0;
      const poll = setInterval(async () => {
        if (endedRef.current || attempts++ > 80) { clearInterval(poll); return; }
        await withBackoff(backoffCallerMain, async () => {
          const s = await base44.entities.CallSession.get(sessionId);
          if (!s) return;

          if (['rejeitada', 'encerrada'].includes(s.status)) {
            clearInterval(poll); cleanup(); onEnded?.(); return;
          }

          if (s.webrtc_answer && !pc.remoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.webrtc_answer)));
            await flushPendingIce(pc);
            clearInterval(poll); // para de pollar — ICE já é tratado separado
            // Inicia poll só para ICE callee — salvo em ref para cleanup correto
            let iceAttempts = 0;
            icePollRef.current = setInterval(async () => {
              if (endedRef.current || iceAttempts++ > 60) { clearInterval(icePollRef.current); return; }
              await withBackoff(backoffCallerIce, async () => {
                const ss = await base44.entities.CallSession.get(sessionId);
                if (!ss || ['encerrada', 'rejeitada'].includes(ss.status)) {
                  clearInterval(icePollRef.current); cleanup(); onEnded?.(); return;
                }
                await applyIce(pc, ss.ice_candidates_callee, appliedIceCallee.current);
              });
            }, 2000);
          } else {
            await applyIce(pc, s.ice_candidates_callee, appliedIceCallee.current);
          }
        });
      }, 1500);

    } catch (e) {
      onError?.(e.message); cleanup();
    }
  }, [sessionId, tipo, initPeerConnection, applyIce, flushPendingIce, cleanup, onEnded, onError]);

  // ─── CALLEE ──────────────────────────────────────────────────────────────
  const startAsCallee = useCallback(async () => {
    try {
      // Aguarda offer (máx 15s, com check de cancelamento + backoff 429)
      let session = null;
      for (let i = 0; i < 15; i++) {
        if (endedRef.current) return; // FIX: cancela se chamada foi encerrada
        await withBackoff(backoffCalleeWait, async () => {
          const res = await base44.functions.invoke('buscarSessaoChamada', { sessionId });
          const s = res?.data?.session;
          if (s?.webrtc_offer) { session = s; }
        });
        if (session?.webrtc_offer) break;
        if (endedRef.current) return; // FIX: cancela antes do sleep também
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!session?.webrtc_offer) {
        onError?.('Offer não recebido'); return;
      }

      const pc = await initPeerConnection();

      await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(session.webrtc_offer)));
      await flushPendingIce(pc);
      await applyIce(pc, session.ice_candidates_caller, appliedIceCaller.current);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await base44.entities.CallSession.update(sessionId, {
        webrtc_answer: JSON.stringify(answer),
        status: 'ativa'
      });

      // Poll para ICE caller — com backoff em 429
      let attempts = 0;
      const poll = setInterval(async () => {
        if (endedRef.current || attempts++ > 60) { clearInterval(poll); return; }
        await withBackoff(backoffCalleeIce, async () => {
          const res = await base44.functions.invoke('buscarSessaoChamada', { sessionId });
          const s = res?.data?.session;
          if (!s) return;
          if (s.status === 'encerrada') {
            clearInterval(poll); cleanup(); onEnded?.(); return;
          }
          await applyIce(pc, s.ice_candidates_caller, appliedIceCaller.current);
        });
      }, 2000);

    } catch (e) {
      onError?.(e.message); cleanup();
    }
  }, [sessionId, initPeerConnection, applyIce, flushPendingIce, cleanup, onEnded, onError]);

  useEffect(() => {
    if (!sessionId) return;
    endedRef.current = false;
    icePendingRef.current = [];
    iceQueueRef.current = [];
    appliedIceCaller.current = new Set();
    appliedIceCallee.current = new Set();
    if (isCaller) startAsCaller();
    else startAsCallee();
    return cleanup;
  }, [sessionId, isCaller]);

  return null;
}