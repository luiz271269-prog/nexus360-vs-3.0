import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Motor WebRTC para chamadas internas diretas.
 * Usa CallSession como canal de sinalização via subscribe.
 *
 * Props:
 *  - sessionId: ID da CallSession
 *  - isCaller: boolean — true se este usuário iniciou a chamada
 *  - onConnected: () => void
 *  - onEnded: () => void
 *  - onError: (msg) => void
 */
export default function WebRTCCallManager({ sessionId, isCaller, onConnected, onEnded, onError }) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const unsubRef = useRef(null);
  const endedRef = useRef(false);

  // Config STUN público (sem TURN por ora — funciona em rede local/LAN)
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
  }, []);

  // Adicionar ICE candidates recebidos do outro lado
  const applyRemoteCandidates = useCallback(async (candidates) => {
    if (!pcRef.current || !candidates?.length) return;
    for (const c of candidates) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(JSON.parse(c)));
      } catch (_) {}
    }
  }, []);

  // Publicar ICE candidate local no banco
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) publishIceCandidate(e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      // Reproduzir áudio remoto
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      remoteAudioRef.current.srcObject = e.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') onConnected?.();
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanup();
        onEnded?.();
      }
    };

    return pc;
  }, [publishIceCandidate, onConnected, onEnded, cleanup]);

  // Fluxo CALLER: criar offer, salvar no banco, esperar answer
  const startAsCaller = useCallback(async () => {
    try {
      const pc = await initPeerConnection();
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      await base44.entities.CallSession.update(sessionId, {
        webrtc_offer: JSON.stringify(offer),
        status: 'chamando'
      });

      // Observar resposta do callee
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
  }, [sessionId, initPeerConnection, applyRemoteCandidates, cleanup, onEnded, onError]);

  // Fluxo CALLEE: pegar offer, criar answer, salvar no banco
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

      // Aplicar ICE candidates do caller que já chegaram
      await applyRemoteCandidates(session.ice_candidates_caller);

      // Observar novos ICE candidates do caller
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
    if (isCaller) {
      startAsCaller();
    } else {
      startAsCallee();
    }
    return cleanup;
  }, [sessionId, isCaller]);

  // Componente invisível — só lógica
  return null;
}