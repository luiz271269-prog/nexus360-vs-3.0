import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WebRTCCallManager from './WebRTCCallManager';

/**
 * Escuta por chamadas WebRTC entrantes para o usuário logado.
 * Suporta áudio e vídeo.
 */
export default function IncomingCallAlert({ usuario }) {
  const [chamadaEntrante, setChamadaEntrante] = useState(null);
  const [chamadaAtiva, setChamadaAtiva] = useState(null); // { sessionId, isCaller, tipo }
  const [duracao, setDuracao] = useState(0);
  const [micMutado, setMicMutado] = useState(false);
  const [camDesligada, setCamDesligada] = useState(false);
  const duracaoRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null); // Referência ao stream local para mute

  // Toque de chamada
  useEffect(() => {
    if (!chamadaEntrante) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    };
    beep();
    const interval = setInterval(beep, 2000);
    return () => { clearInterval(interval); ctx.close(); };
  }, [chamadaEntrante?.id]);

  // Subscribe global para chamadas destinadas a este usuário
  useEffect(() => {
    if (!usuario?.id) return;
    const unsub = base44.entities.CallSession.subscribe((event) => {
      const s = event.data;
      if (!s) return;

      if (
        s.modo === 'interno_webrtc' &&
        s.callee_id === usuario.id &&
        s.status === 'chamando' &&
        event.type === 'create'
      ) {
        setChamadaEntrante(s);
      }

      if (
        chamadaEntrante?.id === s.id &&
        ['encerrada', 'rejeitada', 'perdida'].includes(s.status)
      ) {
        setChamadaEntrante(null);
        setChamadaAtiva(null);
      }
    });
    return unsub;
  }, [usuario?.id, chamadaEntrante?.id]);

  // Temporizador
  useEffect(() => {
    if (chamadaAtiva) {
      setDuracao(0);
      duracaoRef.current = setInterval(() => setDuracao(d => d + 1), 1000);
    } else {
      clearInterval(duracaoRef.current);
      setDuracao(0);
    }
    return () => clearInterval(duracaoRef.current);
  }, [chamadaAtiva?.sessionId]);

  const formatDuracao = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  };

  const aceitar = () => {
    if (!chamadaEntrante) return;
    setChamadaAtiva({ sessionId: chamadaEntrante.id, isCaller: false, tipo: chamadaEntrante.tipo || 'audio' });
    setChamadaEntrante(null);
  };

  const rejeitar = async () => {
    if (!chamadaEntrante) return;
    try { await base44.entities.CallSession.update(chamadaEntrante.id, { status: 'rejeitada' }); } catch (_) {}
    setChamadaEntrante(null);
  };

  const encerrar = async () => {
    if (!chamadaAtiva) return;
    try {
      await base44.entities.CallSession.update(chamadaAtiva.sessionId, {
        status: 'encerrada',
        encerrado_em: new Date().toISOString(),
        duracao_segundos: duracao
      });
    } catch (_) {}
    setChamadaAtiva(null);
  };

  const toggleMic = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = micMutado; });
    }
    setMicMutado(m => !m);
  };

  const toggleCam = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) {
      stream.getVideoTracks().forEach(t => { t.enabled = camDesligada; });
    }
    setCamDesligada(c => !c);
  };

  const isVideo = chamadaAtiva?.tipo === 'video';

  return (
    <>
      {/* Motor WebRTC invisível */}
      {chamadaAtiva && (
        <WebRTCCallManager
          sessionId={chamadaAtiva.sessionId}
          isCaller={chamadaAtiva.isCaller}
          tipo={chamadaAtiva.tipo}
          localVideoRef={isVideo ? localVideoRef : undefined}
          remoteVideoRef={isVideo ? remoteVideoRef : undefined}
          onConnected={() => {}}
          onEnded={() => setChamadaAtiva(null)}
          onError={() => setChamadaAtiva(null)}
        />
      )}

      {/* Alerta de chamada entrante */}
      {chamadaEntrante && (
        <div className="fixed bottom-24 right-6 z-[100] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 w-72">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center animate-pulse ${chamadaEntrante.tipo === 'video' ? 'bg-purple-500/20' : 'bg-green-500/20'}`}>
              {chamadaEntrante.tipo === 'video'
                ? <Video className="w-6 h-6 text-purple-400" />
                : <Phone className="w-6 h-6 text-green-400" />}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">
                {chamadaEntrante.tipo === 'video' ? 'Videochamada' : 'Chamada de voz'}
              </p>
              <p className="text-slate-300 text-sm">{chamadaEntrante.caller_nome || 'Colega'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={rejeitar} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl" size="sm">
              <PhoneOff className="w-4 h-4 mr-1" /> Rejeitar
            </Button>
            <Button onClick={aceitar} className={`flex-1 text-white rounded-xl ${chamadaEntrante.tipo === 'video' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`} size="sm">
              {chamadaEntrante.tipo === 'video'
                ? <><Video className="w-4 h-4 mr-1" /> Aceitar</>
                : <><Phone className="w-4 h-4 mr-1" /> Aceitar</>}
            </Button>
          </div>
        </div>
      )}

      {/* Overlay de videochamada ativa */}
      {chamadaAtiva && isVideo && (
        <div className="fixed inset-0 z-[99] bg-black flex flex-col">
          {/* Vídeo remoto (tela cheia) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="flex-1 w-full object-cover"
          />
          {/* Vídeo local (canto) */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-24 right-4 w-36 h-28 rounded-xl object-cover border-2 border-white/30 shadow-xl"
          />
          {/* Nome + duração */}
          <div className="absolute top-4 left-0 right-0 flex justify-center">
            <div className="bg-black/50 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {formatDuracao(duracao)}
            </div>
          </div>
          {/* Controles */}
          <div className="bg-black/80 flex items-center justify-center gap-6 py-5">
            <button
              onClick={toggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${micMutado ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              {micMutado ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={encerrar}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={toggleCam}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${camDesligada ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              {camDesligada ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>
      )}

      {/* Barra de chamada de áudio ativa */}
      {chamadaAtiva && !isVideo && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-green-700 flex items-center justify-between px-6 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            Chamada ativa — {formatDuracao(duracao)}
          </div>
          <Button onClick={encerrar} size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1 text-xs">
            <PhoneOff className="w-3 h-3 mr-1" /> Encerrar
          </Button>
        </div>
      )}
    </>
  );
}