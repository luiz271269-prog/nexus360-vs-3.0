import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Phone, PhoneOff, Video } from 'lucide-react';
import WhatsAppCallOverlay from './WhatsAppCallOverlay';

/**
 * Detecta chamadas entrantes via POLLING (a cada 3s) + subscribe.
 * O polling é necessário porque o subscribe só entrega eventos ao criador do registro.
 */
export default function IncomingCallAlert({ usuario }) {
  const [chamadaEntrante, setChamadaEntrante] = useState(null);
  const [chamadaAtiva, setChamadaAtiva]   = useState(null);
  const [duracao, setDuracao]             = useState(0);

  const chamadaEntranteRef = useRef(null);
  const chamadaAtivaRef    = useRef(null);
  const duracaoRef         = useRef(null);
  const pollingRef         = useRef(null);
  const jaNotificadosRef   = useRef(new Set()); // IDs já tratados (evita duplicata)

  useEffect(() => { chamadaEntranteRef.current = chamadaEntrante; }, [chamadaEntrante]);
  useEffect(() => { chamadaAtivaRef.current    = chamadaAtiva;    }, [chamadaAtiva]);

  // ── Toque de chamada ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chamadaEntrante) return;
    let ctx, interval;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = () => {
        try {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = 520;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.6);
        } catch (_) {}
      };
      beep();
      interval = setInterval(beep, 2500);
    } catch (_) {}
    return () => { if (interval) clearInterval(interval); if (ctx) ctx.close().catch(() => {}); };
  }, [chamadaEntrante?.id]);

  // ── Polling principal: busca chamadas "chamando" destinadas a mim ─────────
  const verificarChamadasEntrantes = useCallback(async () => {
    if (!usuario?.id) return;
    try {
      const sessoes = await base44.entities.CallSession.filter({
        callee_id: usuario.id,
        status: 'chamando',
        modo: 'interno_webrtc'
      });

      for (const s of sessoes) {
        // Ignorar se já tratamos este ID
        if (jaNotificadosRef.current.has(s.id)) continue;
        // Ignorar se já temos chamada ativa ou entrante diferente
        if (chamadaAtivaRef.current) continue;
        // Ignorar chamadas com mais de 60 segundos (perdida)
        const iniciadoEm = new Date(s.iniciado_em || s.created_date).getTime();
        if (Date.now() - iniciadoEm > 60000) {
          jaNotificadosRef.current.add(s.id);
          continue;
        }

        jaNotificadosRef.current.add(s.id);
        setChamadaEntrante(s);
        chamadaEntranteRef.current = s;
        break; // Processar uma por vez
      }
    } catch (_) {}
  }, [usuario?.id]);

  // ── Subscribe para detectar encerramento/rejeição remota ─────────────────
  useEffect(() => {
    if (!usuario?.id) return;
    const unsub = base44.entities.CallSession.subscribe((event) => {
      const s = event.data;
      if (!s) return;

      // Chamada encerrada/rejeitada remotamente
      const entrante = chamadaEntranteRef.current;
      const ativa    = chamadaAtivaRef.current;

      if (entrante?.id === s.id && ['encerrada', 'rejeitada', 'perdida'].includes(s.status)) {
        setChamadaEntrante(null);
        chamadaEntranteRef.current = null;
      }
      if (ativa?.sessionId === s.id && s.status === 'encerrada') {
        setChamadaAtiva(null);
        chamadaAtivaRef.current = null;
      }
    });
    return unsub;
  }, [usuario?.id]);

  // ── Iniciar polling a cada 3s ─────────────────────────────────────────────
  useEffect(() => {
    if (!usuario?.id) return;
    verificarChamadasEntrantes(); // Imediato
    pollingRef.current = setInterval(verificarChamadasEntrantes, 3000);
    return () => clearInterval(pollingRef.current);
  }, [usuario?.id, verificarChamadasEntrantes]);

  // ── Temporizador de duração ───────────────────────────────────────────────
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
    const m  = Math.floor(s / 60).toString().padStart(2, '0');
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
        <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-t-3xl shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #0d1b2a 0%, #1b3a4b 100%)' }}>

            {/* Cabeçalho */}
            <div className="flex flex-col items-center pt-10 pb-6 px-6">
              {/* Avatar com pulso */}
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-green-400/25 animate-ping" style={{ transform: 'scale(1.4)' }} />
                <div className="absolute inset-0 rounded-full bg-green-400/10 animate-ping" style={{ transform: 'scale(1.7)', animationDelay: '0.3s' }} />
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border-4 border-white/20 flex items-center justify-center text-white text-4xl font-bold shadow-2xl relative z-10">
                  {(chamadaEntrante.caller_nome || '?')[0].toUpperCase()}
                </div>
              </div>

              <p className="text-white/50 text-xs tracking-widest uppercase mb-1">
                {isVideo ? 'Videochamada interna' : 'Chamada de voz'}
              </p>
              <p className="text-white text-2xl font-bold">{chamadaEntrante.caller_nome || 'Colega'}</p>

              {/* Bolinhas animadas */}
              <div className="flex gap-1.5 mt-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-around py-8 px-10 border-t border-white/10">
              <div className="flex flex-col items-center gap-3">
                <button onClick={rejeitar}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-all active:scale-95">
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-white/50 text-xs">Recusar</span>
              </div>

              <div className="flex flex-col items-center gap-3">
                <button onClick={aceitar}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-xl transition-all active:scale-95 ring-4 ring-green-400/40 animate-pulse">
                  {isVideo
                    ? <Video className="w-7 h-7 text-white" />
                    : <Phone className="w-7 h-7 text-white" />}
                </button>
                <span className="text-white/50 text-xs">Aceitar</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}