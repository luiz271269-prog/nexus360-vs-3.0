import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Motor WebRTC para chamadas internas diretas (áudio e vídeo).
 * Sinalização via CallSession (Base44 entity).
 *
 * Props:
 *  - sessionId: ID da CallSession
 *  - isCaller: boolean
 *  - tipo: 'audio' | 'video'
 *  - localVideoRef / remoteVideoRef: refs para elementos <video>
 *  - localStreamRef: ref externo compartilhado para controle de mic/cam
 *  - onConnected / onEnded / onError: callbacks
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
  const unsubRef          = useRef(null);
  const endedRef          = useRef(false);
  const remoteAudioRef    = useRef(null);
  const icePendingRef     = useRef([]);
  const appliedIceCaller  = useRef(new Set());
  const appliedIceCallee  = useRef(new Set());

  const localStreamRef = externalLocalStreamRef || internalStreamRef;

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const cleanup = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    if (localVideoRef?.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef?.current) remoteVideoRef.current.srcObject = null;
  }, []);

  // Aplica ICE candidate deduplicated
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

  const publishIce = useCallback(async (candidate) => {
    if (!sessionId) return;
    try {
      const s = await base44.entities.CallSession.get(sessionId);
      if (!s) return;
      const field = isCaller ? 'ice_candidates_caller' : 'ice_candidates_callee';
      const existing = Array.isArray(s[field]) ? s[field] : [];
      await base44.entities.CallSession.update(sessionId, {
        [field]: [...existing, JSON.stringify(candidate)]
      });
    } catch (_) {}
  }, [sessionId, isCaller]);

  const initPeerConnection = useCallback(async () => {
    // Solicitar permissão de microfone/câmera
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

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

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
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') onConnected?.();
      if (['disconnected', 'failed', 'closed'].includes(state)) {
        if (!endedRef.current) { cleanup(); onEnded?.(); }
      }
    };

    return pc;
  }, [tipo, localVideoRef, remoteVideoRef, publishIce, onConnected, onEnded, cleanup]);

  // ─── CALLER ──────────────────────────────────────────────────────────────
  const startAsCaller = useCallback(async () => {
    try {
      const pc = await initPeerConnection();

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: tipo === 'video'
      });
      await pc.setLocalDescription(offer);

      // Salva offer E muda status para 'chamando' — callee só vê quando offer já está disponível
      await base44.entities.CallSession.update(sessionId, {
        webrtc_offer: JSON.stringify(offer),
        status: 'chamando'
      });

      // Poll a cada 1.5s esperando answer do callee
      let attempts = 0;
      const poll = setInterval(async () => {
        if (endedRef.current || attempts++ > 60) { clearInterval(poll); return; }
        try {
          const s = await base44.entities.CallSession.get(sessionId);
          if (!s) return;

          if (['rejeitada', 'encerrada'].includes(s.status)) {
            clearInterval(poll); cleanup(); onEnded?.(); return;
          }

          if (s.webrtc_answer && !pc.remoteDescription) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.webrtc_answer)));
              await flushPendingIce(pc);
            } catch (_) {}
          }

          await applyIce(pc, s.ice_candidates_callee, appliedIceCallee.current);
        } catch (_) {}
      }, 1500);

    } catch (e) {
      onError?.(e.message); cleanup();
    }
  }, [sessionId, tipo, initPeerConnection, applyIce, flushPendingIce, cleanup, onEnded, onError]);

  // ─── CALLEE ──────────────────────────────────────────────────────────────
  const startAsCallee = useCallback(async () => {
    try {
      // Aguarda o offer ficar disponível (o caller pode ter acabado de criar a sessão)
      let session = null;
      for (let i = 0; i < 15; i++) {
        try {
          const res = await base44.functions.invoke('buscarSessaoChamada', { sessionId });
          const s = res?.data?.session;
          if (s?.webrtc_offer) { session = s; break; }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!session?.webrtc_offer) {
        onError?.('Offer não recebido — verifique a conexão do chamador'); return;
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

      // Poll para novos ICE candidates do caller
      let attempts = 0;
      const poll = setInterval(async () => {
        if (endedRef.current || attempts++ > 60) { clearInterval(poll); return; }
        try {
          const res = await base44.functions.invoke('buscarSessaoChamada', { sessionId });
          const s = res?.data?.session;
          if (!s) return;
          if (s.status === 'encerrada') {
            clearInterval(poll); cleanup(); onEnded?.(); return;
          }
          await applyIce(pc, s.ice_candidates_caller, appliedIceCaller.current);
        } catch (_) {}
      }, 1500);

    } catch (e) {
      onError?.(e.message); cleanup();
    }
  }, [sessionId, initPeerConnection, applyIce, flushPendingIce, cleanup, onEnded, onError]);

  useEffect(() => {
    if (!sessionId) return;
    endedRef.current = false;
    icePendingRef.current = [];
    appliedIceCaller.current = new Set();
    appliedIceCallee.current = new Set();
    if (isCaller) startAsCaller();
    else startAsCallee();
    return cleanup;
  }, [sessionId, isCaller]);

  return null;
}