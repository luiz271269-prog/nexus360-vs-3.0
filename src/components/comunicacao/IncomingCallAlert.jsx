import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Phone, PhoneOff, Video } from 'lucide-react';
import WhatsAppCallOverlay from './WhatsAppCallOverlay';

/**
 * Detecta chamadas entrantes via POLLING a cada 2s.
 * Busca CallSession com status='chamando' e filtra pelo callee_id no cliente.
 * Não depende de subscribe (que só funciona para o criador do registro).
 */
export default function IncomingCallAlert({ usuario: usuarioProp }) {
  const [usuarioId, setUsuarioId]         = useState(usuarioProp?.id || null);
  const [chamadaEntrante, setChamadaEntrante] = useState(null);
  const [chamadaAtiva, setChamadaAtiva]   = useState(null);
  const [duracao, setDuracao]             = useState(0);

  const chamadaEntranteRef = useRef(null);
  const chamadaAtivaRef    = useRef(null);
  const duracaoRef         = useRef(null);
  const pollingRef         = useRef(null);
  const jaVistosRef        = useRef(new Set());
  const usuarioIdRef       = useRef(usuarioId);

  // Atualiza refs ao mudar state
  useEffect(() => { chamadaEntranteRef.current = chamadaEntrante; }, [chamadaEntrante]);
  useEffect(() => { chamadaAtivaRef.current    = chamadaAtiva;    }, [chamadaAtiva]);
  useEffect(() => { usuarioIdRef.current       = usuarioId;       }, [usuarioId]);

  // Se não recebeu usuário via prop, busca autonomamente
  useEffect(() => {
    if (usuarioProp?.id) { setUsuarioId(usuarioProp.id); return; }
    base44.auth.me().then(u => { if (u?.id) setUsuarioId(u.id); }).catch(() => {});
  }, [usuarioProp?.id]);

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

  // ── Polling: usa backend function com service role para bypassar RLS ──────
  const poll = useCallback(async () => {
    const uid = usuarioIdRef.current;
    if (!uid) return;

    try {
      // Usa backend function que roda como service role — bypassa RLS do Base44
      const resultado = await base44.functions.invoke('buscarChamadasEntrantes', {});
      const sessoes = resultado?.data?.sessoes || [];

      for (const s of sessoes) {
        // Já tratei?
        if (jaVistosRef.current.has(s.id)) continue;
        // Não sobrepor chamada ativa
        if (chamadaAtivaRef.current) { jaVistosRef.current.add(s.id); continue; }
        // Chamada expirada (> 60s)
        const t = new Date(s.iniciado_em || s.created_date).getTime();
        if (Date.now() - t > 60000) { jaVistosRef.current.add(s.id); continue; }

        // ✅ Nova chamada para mim!
        jaVistosRef.current.add(s.id);
        setChamadaEntrante(s);
        chamadaEntranteRef.current = s;
        break;
      }

      // Verificar se chamada entrante atual foi encerrada/rejeitada remotamente
      const entrante = chamadaEntranteRef.current;
      if (entrante) {
        const atualizada = sessoes.find(s => s.id === entrante.id);
        if (atualizada && ['encerrada', 'rejeitada', 'perdida'].includes(atualizada.status)) {
          setChamadaEntrante(null);
          chamadaEntranteRef.current = null;
        }
        // Se não aparece mais na lista (deletado ou mudou status)
        if (!atualizada) {
          // Buscar diretamente para confirmar
          try {
            const check = await base44.entities.CallSession.get(entrante.id);
            if (!check || ['encerrada', 'rejeitada', 'perdida'].includes(check.status)) {
              setChamadaEntrante(null);
              chamadaEntranteRef.current = null;
            }
          } catch (_) {
            setChamadaEntrante(null);
            chamadaEntranteRef.current = null;
          }
        }
      }

      // Verificar se chamada ativa foi encerrada remotamente
      const ativa = chamadaAtivaRef.current;
      if (ativa) {
        try {
          const check = await base44.entities.CallSession.get(ativa.sessionId);
          if (!check || check.status === 'encerrada') {
            setChamadaAtiva(null);
            chamadaAtivaRef.current = null;
          }
        } catch (_) {}
      }
    } catch (_) {}
  }, []);

  // ── Iniciar polling ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!usuarioId) return;
    poll(); // Imediato
    pollingRef.current = setInterval(poll, 2000); // A cada 2s
    return () => clearInterval(pollingRef.current);
  }, [usuarioId, poll]);

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

  const aceitar = useCallback(async () => {
    const chamada = chamadaEntranteRef.current;
    if (!chamada) return;
    // NÃO mudar status aqui — o WebRTCCallManager (startAsCallee) muda para 'ativa'
    // após criar o answer. Mudar antes quebraria o handshake do caller.
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

      {/* Alerta flutuante de chamada entrante — canto inferior direito, não bloqueia a tela */}
      {chamadaEntrante && !chamadaAtiva && (
        <div className="fixed bottom-24 right-5 z-[210] w-80 rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f2027 0%, #1a3a4a 60%, #0f4c35 100%)' }}>

          {/* Barra pulsante no topo */}
          <div className="h-1 w-full bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 animate-pulse" />

          <div className="p-4 flex items-center gap-4">
            {/* Avatar com pulso */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 border-2 border-white/20 flex items-center justify-center text-white text-xl font-bold relative z-10">
                {(chamadaEntrante.caller_nome || '?')[0].toUpperCase()}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white/60 text-[10px] tracking-widest uppercase">
                {isVideo ? '📹 Videochamada' : '📞 Chamada de voz'}
              </p>
              <p className="text-white font-semibold text-sm truncate">{chamadaEntrante.caller_nome || 'Colega'}</p>
              {/* Bolinhas animadas */}
              <div className="flex gap-1 mt-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex border-t border-white/10">
            <button onClick={rejeitar}
              className="flex-1 flex flex-col items-center gap-1 py-3 hover:bg-red-500/20 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-red-500 group-hover:bg-red-600 flex items-center justify-center shadow-lg transition-colors">
                <PhoneOff className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/50 text-[10px]">Recusar</span>
            </button>

            <div className="w-px bg-white/10" />

            <button onClick={aceitar}
              className="flex-1 flex flex-col items-center gap-1 py-3 hover:bg-green-500/20 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-green-500 group-hover:bg-green-600 flex items-center justify-center shadow-lg ring-2 ring-green-400/50 animate-pulse transition-colors">
                {isVideo ? <Video className="w-5 h-5 text-white" /> : <Phone className="w-5 h-5 text-white" />}
              </div>
              <span className="text-white/50 text-[10px]">Aceitar</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}