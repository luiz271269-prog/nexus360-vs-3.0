import { useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import WebRTCCallManager from './WebRTCCallManager';

/**
 * Overlay de videochamada WebRTC para o CALLER (quem inicia).
 * O callee usa o overlay dentro do IncomingCallAlert.
 */
export default function VideoCallWebRTC({ sessionId, duracao, onEncerrar, formatDuracao }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [micMutado, setMicMutado] = useState(false);
  const [camDesligada, setCamDesligada] = useState(false);

  const toggleMic = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) stream.getAudioTracks().forEach(t => { t.enabled = micMutado; });
    setMicMutado(m => !m);
  };

  const toggleCam = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) stream.getVideoTracks().forEach(t => { t.enabled = camDesligada; });
    setCamDesligada(c => !c);
  };

  return (
    <div className="fixed inset-0 z-[99] bg-black flex flex-col">
      <WebRTCCallManager
        sessionId={sessionId}
        isCaller={true}
        tipo="video"
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        onConnected={() => {}}
        onEnded={onEncerrar}
        onError={onEncerrar}
      />

      {/* Vídeo remoto (tela cheia) */}
      <video ref={remoteVideoRef} autoPlay playsInline className="flex-1 w-full object-cover" />

      {/* Vídeo local (canto) */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute bottom-24 right-4 w-36 h-28 rounded-xl object-cover border-2 border-white/30 shadow-xl"
      />

      {/* Duração */}
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
          onClick={onEncerrar}
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
  );
}