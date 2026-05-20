import React from "react";
import { Video, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import VideoCallModule from "./VideoCallModule";
import WhatsAppCallOverlay from "./WhatsAppCallOverlay";

/**
 * 🔒 FASE 0 — Proxy fino para a skill `skillInitiateVideoCall`.
 *
 * Este componente NÃO decide nada sobre transporte de mídia, NÃO cria
 * CallSession, NÃO resolve nomes, NÃO envia mensagens. Toda lógica vive
 * em `functions/skillInitiateVideoCall.js`.
 *
 * Responsabilidades aqui:
 *   1. Coletar contexto (thread, contato, integração)
 *   2. Invocar a skill
 *   3. Renderizar overlay com base em `overlay_type` retornado:
 *        - 'webrtc' → <WhatsAppCallOverlay>  (1:1 interno)
 *        - 'jitsi'  → <VideoCallModule>      (grupo interno ou externo)
 */
export default function BotaoVideochamada({ contato, thread, usuario, integracoes = [] }) {
  const [sessaoJitsi, setSessaoJitsi] = React.useState(null);     // overlay_type='jitsi'
  const [sessaoWebRTC, setSessaoWebRTC] = React.useState(null);   // overlay_type='webrtc'
  const [duracaoWebRTC, setDuracaoWebRTC] = React.useState(0);
  const [iniciando, setIniciando] = React.useState(false);
  const duracaoTimer = React.useRef(null);

  const isThreadInterna =
    thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';

  // Temporizador da chamada WebRTC (visual)
  React.useEffect(() => {
    if (sessaoWebRTC) {
      setDuracaoWebRTC(0);
      duracaoTimer.current = setInterval(() => setDuracaoWebRTC(d => d + 1), 1000);
    } else {
      clearInterval(duracaoTimer.current);
    }
    return () => clearInterval(duracaoTimer.current);
  }, [sessaoWebRTC?.sessionId]);

  const formatDuracao = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  };

  /**
   * Dispara a skill — único caminho para iniciar chamadas.
   */
  const iniciarChamada = async (tipo) => {
    if (iniciando || sessaoWebRTC || sessaoJitsi) return;
    setIniciando(true);
    try {
      // Monta payload mínimo. A skill decide tudo a partir daqui.
      let payload;

      if (isThreadInterna) {
        const outros = (thread?.participants || []).filter(id => id !== usuario?.id);
        if (!outros.length) throw new Error('Nenhum participante na thread');
        payload = {
          modo: 'interno',
          tipo,
          thread_id: thread.id,
          user_ids_destino: outros
        };
      } else {
        const integracaoAtiva = integracoes.find(i => i.status === 'conectado') || null;
        if (!contato?.id) throw new Error('Contato não informado');
        payload = {
          modo: 'externo',
          tipo,
          contact_id: contato.id,
          thread_id: thread?.id || null,
          integration_id: integracaoAtiva?.id || null
        };
      }

      const resultado = await base44.functions.invoke('skillInitiateVideoCall', payload);
      const data = resultado?.data;
      if (!data?.success) throw new Error(data?.error || 'Falha ao iniciar chamada');

      // Render condicional pelo overlay_type retornado pela skill
      if (data.overlay_type === 'webrtc') {
        setSessaoWebRTC({
          sessionId: data.session_id,
          tipo: data.tipo,
          peerNome: data.peer_nome || 'Colega'
        });
      } else if (data.overlay_type === 'jitsi') {
        setSessaoJitsi({
          session_id: data.session_id,
          room_url: data.room_url,
          room_name: data.room_name,
          tipo: data.tipo,
          contact_nome: data.contact_nome,
          link_enviado_whatsapp: data.link_enviado_whatsapp,
          link_enviado_interno: data.link_enviado_interno
        });
        if (data.link_enviado_whatsapp) {
          toast.success(`Link enviado via WhatsApp para ${data.contact_nome}`);
        } else if (data.link_enviado_interno) {
          toast.success('Reunião criada e link postado no chat');
        }
      } else {
        throw new Error('overlay_type desconhecido retornado pela skill');
      }
    } catch (e) {
      toast.error('Erro ao iniciar chamada: ' + e.message);
    } finally {
      setIniciando(false);
    }
  };

  /**
   * Encerra chamada WebRTC delegando à skill (não toca em CallSession direto).
   */
  const encerrarChamadaWebRTC = async () => {
    if (!sessaoWebRTC) return;
    try {
      await base44.functions.invoke('skillInitiateVideoCall', {
        action: 'encerrar',
        session_id: sessaoWebRTC.sessionId
      });
    } catch (_) {}
    setSessaoWebRTC(null);
  };

  const encerrarChamadaJitsi = async () => {
    if (!sessaoJitsi) return;
    try {
      await base44.functions.invoke('skillInitiateVideoCall', {
        action: 'encerrar',
        session_id: sessaoJitsi.session_id
      });
    } catch (_) {}
    setSessaoJitsi(null);
  };

  return (
    <>
      {/* Overlay WebRTC P2P (1:1 interno) */}
      {sessaoWebRTC && (
        <WhatsAppCallOverlay
          tipo={sessaoWebRTC.tipo}
          peerNome={sessaoWebRTC.peerNome}
          sessionId={sessaoWebRTC.sessionId}
          duracao={duracaoWebRTC}
          formatDuracao={formatDuracao}
          isCaller={true}
          onEncerrar={encerrarChamadaWebRTC}
        />
      )}

      {/* Dois botões estilo WhatsApp */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => iniciarChamada('video')}
          disabled={iniciando || !!sessaoWebRTC || !!sessaoJitsi}
          title="Videochamada"
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40"
        >
          {iniciando
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Video className="w-5 h-5" />}
        </button>

        <button
          onClick={() => iniciarChamada('audio')}
          disabled={iniciando || !!sessaoWebRTC || !!sessaoJitsi}
          title="Chamada de voz"
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40"
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>

      {/* Overlay Jitsi (grupo interno ou externo) */}
      {sessaoJitsi && (
        <VideoCallModule
          session={sessaoJitsi}
          onEncerrar={encerrarChamadaJitsi}
          onClose={encerrarChamadaJitsi}
        />
      )}
    </>
  );
}