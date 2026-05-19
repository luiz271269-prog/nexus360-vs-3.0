import { useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import WebRTCCallManager from './WebRTCCallManager';

/**
 * Overlay de chamada estilo WhatsApp.
 * Funciona para áudio e vídeo.
 * Usado tanto pelo caller (BotaoVideochamada) quanto pelo callee (IncomingCallAlert).
 * 
 * IMPORTANTE: Sempre monta UMA única instância do WebRTCCallManager aqui.
 * O BotaoVideochamada NÃO deve montar outro WebRTCCallManager em paralelo.
 */
export default function WhatsAppCallOverlay({
  tipo,
  peerNome,
  sessionId,
  duracao,
  formatDuracao,
  isCaller,
  onEncerrar,
  onConnected
}) {
  const isVideo = tipo === 'video';
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null); // stream local compartilhado com toggleMic/Cam

  const [micMutado, setMicMutado]     = useState(false);
  const [camDesligada, setCamDesligada] = useState(false);
  const [speaker, setSpeaker]         = useState(true);
  const [conectado, setConectado]     = useState(false);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (stream) stream.getAudioTracks().forEach(t => { t.enabled = micMutado; }); // micMutado=true → enable (desmutar), false → disable (mutar)
    setMicMutado(m => !m);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (stream) stream.getVideoTracks().forEach(t => { t.enabled = camDesligada; }); // camDesligada=true → enable (ligar), false → disable (desligar)
    setCamDesligada(c => !c);
  };

  const statusLabel = conectado
    ? formatDuracao(duracao)
    : isCaller ? 'Chamando...' : 'Conectando...';

  if (isVideo) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col">
        <WebRTCCallManager
          sessionId={sessionId}
          isCaller={isCaller}
          tipo="video"
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStreamRef={localStreamRef}
          onConnected={() => { setConectado(true); onConnected?.(); }}
          onEnded={onEncerrar}
          onError={onEncerrar}
        />

        {/* Vídeo remoto — fundo */}
        <video ref={remoteVideoRef} autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover bg-slate-900" />

        {/* Overlay escuro no topo */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent z-10" />

        {/* Nome + status */}
        <div className="absolute top-12 left-0 right-0 flex flex-col items-center z-20">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-xl">
            {(peerNome || '?')[0].toUpperCase()}
          </div>
          <p className="text-white text-xl font-semibold drop-shadow">{peerNome || 'Colega'}</p>
          <p className="text-white/70 text-sm mt-1">{statusLabel}</p>
        </div>

        {/* Vídeo local — canto inferior direito */}
        <video ref={localVideoRef} autoPlay playsInline muted
          className="absolute bottom-28 right-4 w-28 h-36 rounded-2xl object-cover border-2 border-white/20 shadow-2xl z-20" />

        {/* Gradiente no rodapé */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent z-10" />

        {/* Controles */}
        <div className="absolute bottom-8 left-0 right-0 z-20 flex items-center justify-center gap-6">
          <CallButton onClick={toggleMic} active={micMutado} icon={micMutado ? MicOff : Mic} label={micMutado ? 'Ativar mic' : 'Silenciar'} />
          <button onClick={onEncerrar}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl transition-all active:scale-95">
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <CallButton onClick={toggleCam} active={camDesligada} icon={camDesligada ? VideoOff : Video} label={camDesligada ? 'Ligar câm.' : 'Desl. câm.'} />
        </div>
      </div>
    );
  }

  // ── ÁUDIO ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-between pb-10 pt-20"
      style={{ background: 'linear-gradient(160deg, #075e54 0%, #128c7e 60%, #25d366 100%)' }}>

      {/* Motor WebRTC — único, tanto para caller quanto callee */}
      <WebRTCCallManager
        sessionId={sessionId}
        isCaller={isCaller}
        tipo="audio"
        localStreamRef={localStreamRef}
        onConnected={() => { setConectado(true); onConnected?.(); }}
        onEnded={onEncerrar}
        onError={onEncerrar}
      />

      {/* Avatar + nome */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-28 h-28 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center text-white text-5xl font-bold shadow-2xl">
          {(peerNome || '?')[0].toUpperCase()}
        </div>
        <p className="text-white text-2xl font-semibold">{peerNome || 'Colega'}</p>
        <p className="text-white/80 text-base">{statusLabel}</p>
      </div>

      {/* Pulso animado enquanto conectando */}
      {!conectado && (
        <div className="flex gap-2 items-center">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-white/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}

      {/* Controles */}
      <div className="flex items-center gap-8">
        <CallButton onClick={toggleMic} active={micMutado} icon={micMutado ? MicOff : Mic} label={micMutado ? 'Ativar mic' : 'Mudo'} light />
        <button onClick={onEncerrar}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl transition-all active:scale-95">
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
        <CallButton onClick={() => setSpeaker(s => !s)} active={!speaker} icon={speaker ? Volume2 : VolumeX} label="Alto-fal." light />
      </div>
    </div>
  );
}

function CallButton({ onClick, active, icon: Icon, label, light }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button onClick={onClick}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95
          ${active
            ? 'bg-white/30 text-white'
            : light
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'bg-slate-800/70 text-white hover:bg-slate-700/80'
          }`}>
        <Icon className="w-5 h-5" />
      </button>
      <span className={`text-xs ${light ? 'text-white/70' : 'text-slate-300'}`}>{label}</span>
    </div>
  );
}