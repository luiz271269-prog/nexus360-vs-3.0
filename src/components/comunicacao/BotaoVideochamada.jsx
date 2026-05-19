import React from "react";
import { Video, Phone, Loader2, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import VideoCallModule from "./VideoCallModule";
import WebRTCCallManager from "./WebRTCCallManager";
import VideoCallWebRTC from "./VideoCallWebRTC";

export default function BotaoVideochamada({ contato, thread, usuario, integracoes = [] }) {
  const [sessaoExterna, setSessaoExterna] = React.useState(null); // Jitsi (externo)
  const [sessaoInterna, setSessaoInterna] = React.useState(null); // WebRTC (interno) { sessionId }
  const [duracaoInterna, setDuracaoInterna] = React.useState(0);
  const [iniciando, setIniciando] = React.useState(false);
  const [menuAberto, setMenuAberto] = React.useState(false);
  const menuRef = React.useRef(null);
  const duracaoTimer = React.useRef(null);

  const isThreadInterna =
    thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';

  // Fechar menu ao clicar fora
  React.useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Temporizador da chamada interna
  React.useEffect(() => {
    if (sessaoInterna) {
      setDuracaoInterna(0);
      duracaoTimer.current = setInterval(() => setDuracaoInterna(d => d + 1), 1000);
    } else {
      clearInterval(duracaoTimer.current);
    }
    return () => clearInterval(duracaoTimer.current);
  }, [sessaoInterna?.sessionId]);

  const formatDuracao = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  };

  const iniciarChamadaInterna = async (tipo) => {
    setMenuAberto(false);
    setIniciando(true);
    try {
      const outroParticipante = thread?.participants?.find(id => id !== usuario?.id) || null;
      if (!outroParticipante) throw new Error('Participante não encontrado na thread');

      // Buscar nome do destinatário
      let calleeNome = 'Colega';
      try {
        const users = await base44.entities.User.list();
        calleeNome = users.find(u => u.id === outroParticipante)?.full_name || 'Colega';
      } catch (_) {}

      // Criar sessão de sinalização no banco
      const session = await base44.entities.CallSession.create({
        modo: 'interno_webrtc',
        tipo,
        status: 'chamando',
        caller_id: usuario.id,
        caller_nome: usuario.full_name || 'Eu',
        callee_id: outroParticipante,
        callee_nome: calleeNome,
        thread_id: thread.id,
        iniciado_por: usuario.email || usuario.id,
        iniciado_em: new Date().toISOString()
      });

      setSessaoInterna({ sessionId: session.id, tipo });
      toast.success(`📞 Chamando ${calleeNome}...`);
    } catch (e) {
      toast.error('Erro ao iniciar chamada: ' + e.message);
    } finally {
      setIniciando(false);
    }
  };

  const encerrarChamadaInterna = async () => {
    if (!sessaoInterna) return;
    try {
      await base44.entities.CallSession.update(sessaoInterna.sessionId, {
        status: 'encerrada',
        encerrado_em: new Date().toISOString(),
        duracao_segundos: duracaoInterna
      });
    } catch (_) {}
    setSessaoInterna(null);
  };

  const iniciarChamadaExterna = async (tipo) => {
    setMenuAberto(false);
    setIniciando(true);
    try {
      const integracaoAtiva = integracoes.find(i => i.status === 'conectado') || null;
      const resultado = await base44.functions.invoke('skillInitiateVideoCall', {
        modo: 'externo',
        contact_id: contato.id,
        thread_id: thread?.id || null,
        integration_id: integracaoAtiva?.id || null,
        tipo
      });

      if (!resultado?.data?.success) throw new Error(resultado?.data?.error || 'Falha ao iniciar chamada');

      setSessaoExterna({
        session_id: resultado.data.session_id,
        room_url: resultado.data.room_url,
        room_name: resultado.data.room_name,
        tipo,
        contact_nome: resultado.data.contact_nome,
        link_enviado_whatsapp: resultado.data.link_enviado_whatsapp
      });

      if (resultado.data.link_enviado_whatsapp) {
        toast.success(`📹 Link enviado via WhatsApp para ${resultado.data.contact_nome}`);
      } else {
        toast.success(`📹 Sala criada! Copie o link para compartilhar.`);
      }
    } catch (e) {
      toast.error('Erro ao iniciar chamada: ' + e.message);
    } finally {
      setIniciando(false);
    }
  };

  const iniciarChamada = (tipo) => {
    if (isThreadInterna) {
      iniciarChamadaInterna(tipo);
    } else {
      iniciarChamadaExterna(tipo);
    }
  };

  return (
    <>
      {/* Motor WebRTC invisível (áudio) ou overlay vídeo (gerenciado pelo IncomingCallAlert no lado do callee) */}
      {sessaoInterna && sessaoInterna.tipo === 'audio' && (
        <WebRTCCallManager
          sessionId={sessaoInterna.sessionId}
          isCaller={true}
          tipo="audio"
          onConnected={() => toast.success('📞 Conectado!')}
          onEnded={() => setSessaoInterna(null)}
          onError={(msg) => { toast.error('Erro na chamada: ' + msg); setSessaoInterna(null); }}
        />
      )}

      {/* Overlay de videochamada ativa (caller) */}
      {sessaoInterna && sessaoInterna.tipo === 'video' && (
        <VideoCallWebRTC
          sessionId={sessaoInterna.sessionId}
          duracao={duracaoInterna}
          onEncerrar={encerrarChamadaInterna}
          formatDuracao={formatDuracao}
        />
      )}

      {/* Barra de chamada de áudio ativa */}
      {sessaoInterna && sessaoInterna.tipo === 'audio' && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-green-700 flex items-center justify-between px-6 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            Chamando... {formatDuracao(duracaoInterna)}
          </div>
          <button
            onClick={encerrarChamadaInterna}
            className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1 text-xs flex items-center gap-1"
          >
            <PhoneOff className="w-3 h-3" /> Encerrar
          </button>
        </div>
      )}

      {/* Botão dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuAberto(prev => !prev)}
          disabled={iniciando || !!sessaoInterna}
          className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-lg p-1.5 shadow-md flex items-center justify-center hover:from-green-600 hover:to-emerald-700 hover:shadow-lg transition-all disabled:opacity-50"
          title="Iniciar chamada"
        >
          {iniciando
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Phone className="w-3.5 h-3.5" />}
        </button>

        {menuAberto && !iniciando && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[160px]">
            <button
              onClick={() => iniciarChamada('video')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-purple-50 text-slate-700 text-sm transition-colors"
            >
              <Video className="w-4 h-4 text-purple-600" />
              Videochamada
            </button>
            <button
              onClick={() => iniciarChamada('audio')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-50 text-slate-700 text-sm transition-colors border-t border-slate-100"
            >
              <Phone className="w-4 h-4 text-blue-600" />
              Chamada de voz
            </button>
          </div>
        )}
      </div>

      {/* Overlay Jitsi — só para chamadas externas */}
      {sessaoExterna && (
        <VideoCallModule
          session={sessaoExterna}
          onEncerrar={() => setSessaoExterna(null)}
          onClose={() => setSessaoExterna(null)}
        />
      )}
    </>
  );
}