import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Motor WebRTC para chamadas internas diretas (áudio e vídeo).
 * Usa CallSession como canal de sinalização via subscribe.
 *
 * Props:
 *  - sessionId: ID da CallSession
 *  - isCaller: boolean — true se este usuário iniciou a chamada
 *  - tipo: 'audio' | 'video'
 *  - localVideoRef: ref para <video> do stream local (só vídeo)
 *  - remoteVideoRef: ref para <video> do stream remoto (só vídeo)
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
  onConnected,
  onEnded,
  onError
}) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const unsubRef = useRef(null);
  const endedRef = useRef(false);
  const remoteAudioRef = useRef(null); // Para áudio sem elemento <video>

  const ICE_CONFIG = {
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
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    if (localVideoRef?.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef?.current) remoteVideoRef.current.srcObject = null;
  }, [localVideoRef, remoteVideoRef]);

  const applyRemoteCandidates = useCallback(async (candidates) => {
    if (!pcRef.current || !candidates?.length) return;
    for (const c of candidates) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(JSON.parse(c)));
      } catch (_) {}
    }
  }, []);

  const publishIceCandidate = useCallback(async (candidate) => {
    if (!sessionId) return;
    try {
      const session = await base44.entities.CallSession.get(sessionId);
      const field = isCaller ? 'ice_candidates_caller' : 'ice_candidates_callee';
      const existing = session[field] || [];
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

    // Exibir stream local no elemento de vídeo (se houver)
    if (localVideoRef?.current && tipo === 'video') {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true; // Evita eco
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) publishIceCandidate(e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      if (tipo === 'video' && remoteVideoRef?.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      } else {
        // Áudio: usar elemento Audio invisível
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = remoteStream;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') onConnected?.();
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanup();
        onEnded?.();
      }
    };

    return pc;
  }, [tipo, localVideoRef, remoteVideoRef, publishIceCandidate, onConnected, onEnded, cleanup]);

  const startAsCaller = useCallback(async () => {
    try {
      const pc = await initPeerConnection();
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: tipo === 'video'
      });
      await pc.setLocalDescription(offer);

      await base44.entities.CallSession.update(sessionId, {
        webrtc_offer: JSON.stringify(offer),
        status: 'chamando'
      });

      unsubRef.current = base44.entities.CallSession.subscribe(async (event) => {
        if (event.id !== sessionId) return;
        const s = event.data;

        if (s.status === 'rejeitada' || s.status === 'encerrada') {
          cleanup(); onEnded?.(); return;
        }

        if (s.webrtc_answer && pc.remoteDescription == null) {
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.webrtc_answer)));
        }

        if (s.ice_candidates_callee?.length) {
          await applyRemoteCandidates(s.ice_candidates_callee);
        }
      });

    } catch (e) {
      onError?.(e.message);
      cleanup();
    }
  }, [sessionId, tipo, initPeerConnection, applyRemoteCandidates, cleanup, onEnded, onError]);

  const startAsCallee = useCallback(async () => {
    try {
      const session = await base44.entities.CallSession.get(sessionId);
      if (!session.webrtc_offer) { onError?.('Offer não encontrado'); return; }

      const pc = await initPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(session.webrtc_offer)));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await base44.entities.CallSession.update(sessionId, {
        webrtc_answer: JSON.stringify(answer),
        status: 'ativa'
      });

      await applyRemoteCandidates(session.ice_candidates_caller);

      unsubRef.current = base44.entities.CallSession.subscribe(async (event) => {
        if (event.id !== sessionId) return;
        const s = event.data;

        if (s.status === 'encerrada') { cleanup(); onEnded?.(); return; }
        if (s.ice_candidates_caller?.length) {
          await applyRemoteCandidates(s.ice_candidates_caller);
        }
      });

    } catch (e) {
      onError?.(e.message);
      cleanup();
    }
  }, [sessionId, initPeerConnection, applyRemoteCandidates, cleanup, onEnded, onError]);

  useEffect(() => {
    if (!sessionId) return;
    endedRef.current = false;
    if (isCaller) {
      startAsCaller();
    } else {
      startAsCallee();
    }
    return cleanup;
  }, [sessionId, isCaller]);

  return null;
}