import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Phone, PhoneOff, Video } from 'lucide-react';
import WhatsAppCallOverlay from './WhatsAppCallOverlay';

/**
 * Alerta global de chamada entrante + overlay de chamada ativa.
 * Estilo WhatsApp.
 */
export default function IncomingCallAlert({ usuario }) {
  const [chamadaEntrante, setChamadaEntrante] = useState(null);
  const [chamadaAtiva, setChamadaAtiva] = useState(null); // { sessionId, tipo, peerNome }
  const [duracao, setDuracao] = useState(0);
  const duracaoRef = useRef(null);

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
      osc.stop(ctx.currentTime + 0.5);
    };
    beep();
    const interval = setInterval(beep, 3000);
    return () => { clearInterval(interval); ctx.close(); };
  }, [chamadaEntrante?.id]);

  // Subscribe global
  useEffect(() => {
    if (!usuario?.id) return;
    const unsub = base44.entities.CallSession.subscribe((event) => {
      const s = event.data;
      if (!s) return;
      if (s.modo === 'interno_webrtc' && s.callee_id === usuario.id && s.status === 'chamando' && event.type === 'create') {
        setChamadaEntrante(s);
      }
      if (chamadaEntrante?.id === s.id && ['encerrada', 'rejeitada', 'perdida'].includes(s.status)) {
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
    setChamadaAtiva({ sessionId: chamadaEntrante.id, tipo: chamadaEntrante.tipo || 'audio', peerNome: chamadaEntrante.caller_nome });
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

  const isVideo = chamadaEntrante?.tipo === 'video';

  return (
    <>
      {/* Overlay de chamada ativa (callee) */}
      {chamadaAtiva && (
        <WhatsAppCallOverlay
          tipo={chamadaAtiva.tipo}
          peerNome={chamadaAtiva.peerNome}
          sessionId={chamadaAtiva.sessionId}
          duracao={duracao}
          formatDuracao={formatDuracao}
          isCaller={false}
          onEncerrar={encerrar}
        />
      )}

      {/* Alerta de chamada entrante — estilo WhatsApp */}
      {chamadaEntrante && !chamadaAtiva && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-80 overflow-hidden">
            {/* Cabeçalho verde */}
            <div
              className="flex flex-col items-center pt-8 pb-6 px-6"
              style={{ background: 'linear-gradient(160deg, #075e54 0%, #128c7e 100%)' }}
            >
              <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center text-white text-3xl font-bold shadow-xl mb-4">
                {(chamadaEntrante.caller_nome || '?')[0].toUpperCase()}
              </div>
              <p className="text-white text-xl font-semibold">{chamadaEntrante.caller_nome || 'Colega'}</p>
              <p className="text-white/70 text-sm mt-1 flex items-center gap-1.5">
                {isVideo
                  ? <><Video className="w-3.5 h-3.5" /> Videochamada de voz</>
                  : <><Phone className="w-3.5 h-3.5" /> Chamada de voz</>}
              </p>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-around py-6 px-8 bg-white">
              {/* Rejeitar */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={rejeitar}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                >
                  <PhoneOff className="w-6 h-6 text-white" />
                </button>
                <span className="text-xs text-slate-500">Recusar</span>
              </div>

              {/* Aceitar */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={aceitar}
                  className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                >
                  {isVideo ? <Video className="w-6 h-6 text-white" /> : <Phone className="w-6 h-6 text-white" />}
                </button>
                <span className="text-xs text-slate-500">Aceitar</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}