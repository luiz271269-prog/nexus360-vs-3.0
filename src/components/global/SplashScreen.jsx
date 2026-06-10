import React, { useEffect, useRef, useState } from 'react';

const VIDEO_URL = 'https://media.base44.com/videos/public/68a7d067890527304dbe8477/0c1c98f84_VID-20260610-WA0073.mp4';

/**
 * Tela de abertura do app — vídeo de inicialização em tela cheia, com som.
 * Browsers bloqueiam autoplay COM som sem interação: tentamos com áudio;
 * se bloqueado, reproduz mudo automaticamente.
 * Encerra quando o vídeo termina (ou no timeout de segurança).
 */
export default function SplashScreen({ onFinish, durationMs = 8000 }) {
  const videoRef = useRef(null);
  const [fading, setFading] = useState(false);

  const finalizar = () => {
    setFading(true);
    setTimeout(() => onFinish?.(), 500);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.play().catch(() => {
        // Autoplay com som bloqueado pelo browser → tenta mudo
        video.muted = true;
        video.play().catch(() => finalizar());
      });
    }
    // Timeout de segurança caso o vídeo não carregue/termine
    const safety = setTimeout(finalizar, durationMs);
    return () => clearTimeout(safety);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        playsInline
        onEnded={finalizar}
        onError={finalizar}
        className="w-full h-full object-contain"
      />
    </div>
  );
}