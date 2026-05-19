import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Phone, PhoneOff, Video } from 'lucide-react';
import WhatsAppCallOverlay from './WhatsAppCallOverlay';

/**
 * Alerta global de chamada entrante + overlay de chamada ativa.
 * Estilo WhatsApp.
 * 
 * CORREÇÃO: subscribe estável via useRef para evitar closure stale.
 */
export default function IncomingCallAlert({ usuario }) {
  const [chamadaEntrante, setChamadaEntrante] = useState(null);
  const [chamadaAtiva, setChamadaAtiva] = useState(null); // { sessionId, tipo, peerNome }
  const [duracao, setDuracao] = useState(0);
  const duracaoRef = useRef(null);

  // ✅ Refs para evitar closure stale no subscribe
  const chamadaEntranteRef = useRef(null);
  const chamadaAtivaRef = useRef(null);

  // Sincronizar refs com state
  useEffect(() => { chamadaEntranteRef.current = chamadaEntrante; }, [chamadaEntrante]);
  useEffect(() => { chamadaAtivaRef.current = chamadaAtiva; }, [chamadaAtiva]);

  // Toque de chamada
  useEffect(() => {
    if (!chamadaEntrante) return;
    let ctx;
    let interval;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = () => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 520;
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
        } catch (_) {}
      };
      beep();
      interval = setInterval(beep, 3000);
    } catch (_) {}
    return () => {
      if (interval) clearInterval(interval);
      if (ctx) ctx.close().catch(() => {});
    };
  }, [chamadaEntrante?.id]);

  // ✅ Subscribe global ESTÁVEL — sem dependências que mudam
  useEffect(() => {
    if (!usuario?.id) return;

    const unsub = base44.entities.CallSession.subscribe((event) => {
      const s = event.data;
      if (!s) return;

      // Nova chamada entrante para mim
      if (
        s.modo === 'interno_webrtc' &&
        s.callee_id === usuario.id &&
        s.status === 'chamando' &&
        event.type === 'create'
      ) {
        // Não sobrescrever se já há chamada ativa
        if (!chamadaAtivaRef.current) {
          setChamadaEntrante(s);
          chamadaEntranteRef.current = s;
        }
        return;
      }

      // Chamada encerrada/rejeitada remotamente
      const entranteAtual = chamadaEntranteRef.current;
      const ativaAtual = chamadaAtivaRef.current;

      if (entranteAtual?.id === s.id && ['encerrada', 'rejeitada', 'perdida'].includes(s.status)) {
        setChamadaEntrante(null);
        chamadaEntranteRef.current = null;
      }

      if (ativaAtual?.sessionId === s.id && s.status === 'encerrada') {
        setChamadaAtiva(null);
        chamadaAtivaRef.current = null;
      }
    });

    return unsub;
  }, [usuario?.id]); // ✅ Só recria se o usuário mudar

  // Temporizador de duração
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

  const aceitar = useCallback(() => {
    const chamada = chamadaEntranteRef.current;
    if (!chamada) return;
    const ativa = { sessionId: chamada.id, tipo: chamada.tipo || 'audio', peerNome: chamada.caller_nome };
    setChamadaAtiva(ativa);
    chamadaAtivaRef.current = ativa;
    setChamadaEntrante(null);
    chamadaEntranteRef.current = null;
  }, []);

  const rejeitar = useCallback(async () => {
    const chamada = chamadaEntranteRef.current;
    if (!chamada) return;
    try { await base44.entities.CallSession.update(chamada.id, { status: 'rejeitada' }); } catch (_) {}
    setChamadaEntrante(null);
    chamadaEntranteRef.current = null;
  }, []);

  const encerrar = useCallback(async () => {
    const ativa = chamadaAtivaRef.current;
    if (!ativa) return;
    try {
      await base44.entities.CallSession.update(ativa.sessionId, {
        status: 'encerrada',
        encerrado_em: new Date().toISOString(),
        duracao_segundos: duracao
      });
    } catch (_) {}
    setChamadaAtiva(null);
    chamadaAtivaRef.current = null;
  }, [duracao]);

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
        <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/60 backdrop-blur-sm pb-0">
          <div className="w-full max-w-sm mb-0 overflow-hidden rounded-t-3xl shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' }}>

            {/* Cabeçalho */}
            <div className="flex flex-col items-center pt-10 pb-6 px-6">
              {/* Pulso animado ao redor do avatar */}
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping scale-125" />
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border-4 border-white/20 flex items-center justify-center text-white text-4xl font-bold shadow-2xl relative z-10">
                  {(chamadaEntrante.caller_nome || '?')[0].toUpperCase()}
                </div>
              </div>

              <p className="text-white/60 text-sm mb-1">
                {isVideo ? 'Videochamada interna' : 'Chamada de voz interna'}
              </p>
              <p className="text-white text-2xl font-bold">{chamadaEntrante.caller_nome || 'Colega'}</p>

              {/* Ícone do tipo */}
              <div className="flex items-center gap-1.5 mt-2 text-white/50 text-xs">
                {isVideo
                  ? <><Video className="w-3 h-3" /> Vídeo</>
                  : <><Phone className="w-3 h-3" /> Voz</>}
              </div>
            </div>

            {/* Botões Recusar / Aceitar */}
            <div className="flex items-center justify-around py-8 px-10 border-t border-white/10">
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={rejeitar}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-all active:scale-95"
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-white/60 text-xs">Recusar</span>
              </div>

              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={aceitar}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-xl transition-all active:scale-95 animate-pulse"
                >
                  {isVideo
                    ? <Video className="w-7 h-7 text-white" />
                    : <Phone className="w-7 h-7 text-white" />}
                </button>
                <span className="text-white/60 text-xs">Aceitar</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}