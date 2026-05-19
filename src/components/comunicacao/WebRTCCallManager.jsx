import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Motor WebRTC para chamadas internas diretas (áudio e vídeo).
 * Usa CallSession como canal de sinalização via polling + subscribe.
 *
 * Props:
 *  - sessionId: ID da CallSession
 *  - isCaller: boolean — true se este usuário iniciou a chamada
 *  - tipo: 'audio' | 'video'
 *  - localVideoRef: ref para <video> do stream local (só vídeo)
 *  - remoteVideoRef: ref para <video> do stream remoto (só vídeo)
 *  - localStreamRef: ref externo para controlar o stream local (mute/unmute)
 *  - onConnected: () => void
 *  - onEnded: () => void
 *  - onError: (msg) => void
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
  const pcRef            = useRef(null);
  const internalStreamRef = useRef(null);
  const unsubRef         = useRef(null);
  const endedRef         = useRef(false);
  const remoteAudioRef   = useRef(null);
  const icePendingRef    = useRef([]); // ICE candidates recebidos antes do remoteDescription

  // Expõe o localStream externamente se ref fornecida
  const localStreamRef = externalLocalStreamRef || internalStreamRef;

  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
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

  const safeAddIce = useCallback(async (pc, candidates) => {
    if (!candidates?.length) return;
    for (const c of candidates) {
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

  const publishIceCandidate = useCallback(async (candidate) => {
    if (!sessionId) return;
    try {
      // Usa backend function para bypassar RLS
      const session = await base44.functions.invoke('buscarChamadasEntrantes', {});
      // Fallback: atualiza diretamente (funciona para o caller que criou o registro)
      const s = await base44.entities.CallSession.get(sessionId).catch(() => null);
      if (!s) return;
      const field = isCaller ? 'ice_candidates_caller' : 'ice_candidates_callee';
      const existing = s[field] || [];
      await base44.entities.CallSession.update(sessionId, {
        [field]: [...existing, JSON.stringify(candidate)]
      });
    } catch (_) {}
  }, [sessionId, isCaller]);

  const initPeerConnection = useCallback(async () => {
    const constraints = tipo === 'video'
      ? { audio: true, video: { width: 1280, height: 720 } }
      : { audio: true, video: false };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;

    if (localVideoRef?.current && tipo === 'video') {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) publishIceCandidate(e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0] || new MediaStream([e.track]);
      if (tipo === 'video' && remoteVideoRef?.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      } else {
        // Áudio: criar elemento Audio e reproduzir
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = remoteStream;
        // Forçar play (necessário em alguns browsers mobile)
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') onConnected?.();
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        if (!endedRef.current) { cleanup(); onEnded?.(); }
      }
    };

    return pc;
  }, [tipo, localVideoRef, remoteVideoRef, publishIceCandidate, onConnected, onEnded, cleanup]);

  // ── CALLER ────────────────────────────────────────────────────────────────
  const startAsCaller = useCallback(async () => {
    try {
      const pc = await initPeerConnection();
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: tipo === 'video' });
      await pc.setLocalDescription(offer);

      await base44.entities.CallSession.update(sessionId, {
        webrtc_offer: JSON.stringify(offer)
      });

      // Polling para detectar answer (subscribe tem RLS também)
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        if (endedRef.current || pollCount++ > 60) { clearInterval(pollInterval); return; }
        try {
          const s = await base44.entities.CallSession.get(sessionId);
          if (!s) return;
          if (['rejeitada', 'encerrada'].includes(s.status)) {
            clearInterval(pollInterval);
            cleanup(); onEnded?.(); return;
          }
          if (s.webrtc_answer && pc.remoteDescription == null) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.webrtc_answer)));
            await flushPendingIce(pc);
          }
          if (s.ice_candidates_callee?.length) {
            await safeAddIce(pc, s.ice_candidates_callee);
          }
        } catch (_) {}
      }, 2000);

      // Subscribe como complemento (pode chegar mais rápido)
      unsubRef.current = base44.entities.CallSession.subscribe(async (event) => {
        if (event.id !== sessionId && event.data?.id !== sessionId) return;
        const s = event.data;
        if (!s) return;
        if (['rejeitada', 'encerrada'].includes(s.status)) {
          clearInterval(pollInterval);
          cleanup(); onEnded?.(); return;
        }
        if (s.webrtc_answer && pc.remoteDescription == null) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.webrtc_answer)));
            await flushPendingIce(pc);
          } catch (_) {}
        }
        if (s.ice_candidates_callee?.length) await safeAddIce(pc, s.ice_candidates_callee);
      });

    } catch (e) {
      onError?.(e.message); cleanup();
    }
  }, [sessionId, tipo, initPeerConnection, safeAddIce, flushPendingIce, cleanup, onEnded, onError]);

  // ── CALLEE ────────────────────────────────────────────────────────────────
  const startAsCallee = useCallback(async () => {
    try {
      // Busca a sessão via backend function (bypassa RLS)
      const res = await base44.functions.invoke('buscarSessaoChamada', { sessionId });
      const session = res?.data?.session;
      if (!session?.webrtc_offer) {
        onError?.('Offer não encontrado'); return;
      }

      const pc = await initPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(session.webrtc_offer)));
      await flushPendingIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await base44.entities.CallSession.update(sessionId, {
        webrtc_answer: JSON.stringify(answer),
        status: 'ativa'
      });

      await safeAddIce(pc, session.ice_candidates_caller);

      // Polling para novos ICE candidates do caller
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        if (endedRef.current || pollCount++ > 60) { clearInterval(pollInterval); return; }
        try {
          const r = await base44.functions.invoke('buscarSessaoChamada', { sessionId });
          const s = r?.data?.session;
          if (!s) return;
          if (s.status === 'encerrada') {
            clearInterval(pollInterval);
            cleanup(); onEnded?.(); return;
          }
          if (s.ice_candidates_caller?.length) await safeAddIce(pc, s.ice_candidates_caller);
        } catch (_) {}
      }, 2000);

      unsubRef.current = base44.entities.CallSession.subscribe(async (event) => {
        if (event.id !== sessionId && event.data?.id !== sessionId) return;
        const s = event.data;
        if (!s) return;
        if (s.status === 'encerrada') {
          clearInterval(pollInterval);
          cleanup(); onEnded?.(); return;
        }
        if (s.ice_candidates_caller?.length) await safeAddIce(pc, s.ice_candidates_caller);
      });

    } catch (e) {
      onError?.(e.message); cleanup();
    }
  }, [sessionId, initPeerConnection, safeAddIce, flushPendingIce, cleanup, onEnded, onError]);

  useEffect(() => {
    if (!sessionId) return;
    endedRef.current = false;
    icePendingRef.current = [];
    if (isCaller) startAsCaller();
    else startAsCallee();
    return cleanup;
  }, [sessionId, isCaller]);

  return null;
}