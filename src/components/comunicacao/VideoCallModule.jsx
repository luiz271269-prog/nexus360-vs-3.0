import React from "react";
import { X, Phone, Video, Mic, MicOff, VideoOff, ExternalLink, Copy, Clock } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function VideoCallModule({ session, onEncerrar, onClose }) {
  const [audioMuted, setAudioMuted] = React.useState(false);
  const [videoMuted, setVideoMuted] = React.useState(false);
  const [pip, setPip] = React.useState(false);
  const [duracao, setDuracao] = React.useState(0);
  const [encerrando, setEncerrando] = React.useState(false);

  // Timer de duração
  React.useEffect(() => {
    const interval = setInterval(() => setDuracao(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatarDuracao = (seg) => {
    const m = Math.floor(seg / 60).toString().padStart(2, '0');
    const s = (seg % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCopiarLink = () => {
    navigator.clipboard.writeText(session.room_url);
    toast.success('Link copiado!');
  };

  const handleAbrirExterno = () => {
    window.open(session.room_url, '_blank');
  };

  const handleEncerrar = async () => {
    setEncerrando(true);
    try {
      await base44.functions.invoke('skillInitiateVideoCall', {
        action: 'encerrar',
        session_id: session.session_id
      });
      toast.success(`Chamada encerrada — ${formatarDuracao(duracao)}`);
      if (onEncerrar) onEncerrar(duracao);
      if (onClose) onClose();
    } catch (e) {
      toast.error('Erro ao encerrar: ' + e.message);
      if (onClose) onClose();
    } finally {
      setEncerrando(false);
    }
  };

  // Construir URL Jitsi com configurações
  const jitsiConfig = [
    session.tipo === 'audio' ? 'config.startWithVideoMuted=true' : '',
    audioMuted ? 'config.startWithAudioMuted=true' : '',
    'config.prejoinPageEnabled=false',
    'config.disableDeepLinking=true',
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
    'interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false',
  ].filter(Boolean).join('&');

  const jitsiUrl = `${session.room_url}#${jitsiConfig}`;

  if (pip) {
    return (
      <div className="fixed bottom-24 right-6 z-[100] w-72 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white text-xs font-semibold truncate max-w-[120px]">
              {session.contact_nome}
            </span>
            <span className="text-slate-400 text-xs">{formatarDuracao(duracao)}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setPip(false)} className="text-slate-400 hover:text-white p-1">
              <Video className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleEncerrar} disabled={encerrando}
              className="text-red-400 hover:text-red-300 p-1">
              <Phone className="w-3.5 h-3.5 rotate-[135deg]" />
            </button>
          </div>
        </div>
        <div className="text-center py-3 text-slate-400 text-xs">
          📹 Chamada em andamento
          <button onClick={handleAbrirExterno}
            className="block mx-auto mt-1 text-blue-400 underline text-xs">
            Abrir em nova aba
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-4xl flex flex-col overflow-hidden"
        style={{ height: 'min(85vh, 680px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              {session.tipo === 'audio'
                ? <Phone className="w-4 h-4 text-white" />
                : <Video className="w-4 h-4 text-white" />}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{session.contact_nome}</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-xs">Em chamada</span>
                <Clock className="w-3 h-3 text-slate-400 ml-1" />
                <span className="text-slate-400 text-xs">{formatarDuracao(duracao)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session.link_enviado_whatsapp && (
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded-full">
                ✅ WhatsApp notificado
              </span>
            )}
            <button onClick={handleCopiarLink}
              className="flex items-center gap-1 text-slate-300 hover:text-white text-xs px-2 py-1 bg-slate-700 rounded-lg">
              <Copy className="w-3 h-3" /> Copiar link
            </button>
            <button onClick={handleAbrirExterno}
              className="flex items-center gap-1 text-slate-300 hover:text-white text-xs px-2 py-1 bg-slate-700 rounded-lg">
              <ExternalLink className="w-3 h-3" /> Nova aba
            </button>
            <button onClick={() => setPip(true)}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700"
              title="Minimizar">
              <X className="w-4 h-4 rotate-45" />
            </button>
            <button onClick={handleEncerrar} disabled={encerrando}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              <Phone className="w-3.5 h-3.5 rotate-[135deg]" />
              {encerrando ? 'Encerrando...' : 'Encerrar'}
            </button>
          </div>
        </div>

        {/* Jitsi iframe */}
        <div className="flex-1 overflow-hidden">
          <iframe
            src={jitsiUrl}
            allow="camera; microphone; display-capture; fullscreen; autoplay"
            className="w-full h-full border-0"
            title="Videochamada Nexus360"
          />
        </div>
      </div>
    </div>
  );
}