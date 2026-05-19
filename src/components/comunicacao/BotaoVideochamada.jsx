import React from "react";
import { Video, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import VideoCallModule from "./VideoCallModule";
import WhatsAppCallOverlay from "./WhatsAppCallOverlay";

/**
 * Dois botões estilo WhatsApp: câmera (vídeo) + telefone (voz).
 * Threads internas → WebRTC direto.
 * Threads externas → Jitsi via link WhatsApp.
 */
export default function BotaoVideochamada({ contato, thread, usuario, integracoes = [] }) {
  const [sessaoExterna, setSessaoExterna] = React.useState(null);
  const [sessaoInterna, setSessaoInterna] = React.useState(null); // { sessionId, tipo }
  const [duracaoInterna, setDuracaoInterna] = React.useState(0);
  const [iniciando, setIniciando] = React.useState(false);
  const duracaoTimer = React.useRef(null);

  const isThreadInterna =
    thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';

  // Temporizador
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
    if (iniciando || sessaoInterna) return;
    setIniciando(true);
    try {
      const outroParticipante = thread?.participants?.find(id => id !== usuario?.id) || null;
      if (!outroParticipante) throw new Error('Participante não encontrado na thread');

      let calleeNome = 'Colega';
      try {
        const users = await base44.entities.User.list();
        calleeNome = users.find(u => u.id === outroParticipante)?.full_name || 'Colega';
      } catch (_) {}

      const session = await base44.entities.CallSession.create({
        modo: 'interno_webrtc',
        tipo,
        status: 'iniciando', // Muda para 'chamando' após o offer ser salvo pelo WebRTCCallManager
        caller_id: usuario.id,
        caller_nome: usuario.full_name || 'Eu',
        callee_id: outroParticipante,
        callee_nome: calleeNome,
        thread_id: thread.id,
        iniciado_por: usuario.email || usuario.id,
        iniciado_em: new Date().toISOString()
      });

      setSessaoInterna({ sessionId: session.id, tipo, peerNome: calleeNome });
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
    if (iniciando) return;
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
        toast.success(`Link enviado via WhatsApp para ${resultado.data.contact_nome}`);
      }
    } catch (e) {
      toast.error('Erro ao iniciar chamada: ' + e.message);
    } finally {
      setIniciando(false);
    }
  };

  const iniciarChamada = (tipo) => {
    if (isThreadInterna) iniciarChamadaInterna(tipo);
    else iniciarChamadaExterna(tipo);
  };

  return (
    <>
      {/* Overlay estilo WhatsApp (áudio ou vídeo) — já inclui o WebRTCCallManager internamente */}
      {sessaoInterna && (
        <WhatsAppCallOverlay
          tipo={sessaoInterna.tipo}
          peerNome={sessaoInterna.peerNome}
          sessionId={sessaoInterna.sessionId}
          duracao={duracaoInterna}
          formatDuracao={formatDuracao}
          isCaller={true}
          onEncerrar={encerrarChamadaInterna}
        />
      )}

      {/* Dois botões estilo WhatsApp */}
      <div className="flex items-center gap-1">
        {/* Botão Vídeo */}
        <button
          onClick={() => iniciarChamada('video')}
          disabled={iniciando || !!sessaoInterna}
          title="Videochamada"
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40"
        >
          {iniciando
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Video className="w-5 h-5" />}
        </button>

        {/* Botão Voz */}
        <button
          onClick={() => iniciarChamada('audio')}
          disabled={iniciando || !!sessaoInterna}
          title="Chamada de voz"
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40"
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>

      {/* Overlay Jitsi (chamadas externas) */}
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