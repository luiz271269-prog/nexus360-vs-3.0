import React, { useEffect, useState } from 'react';

/**
 * Tela de abertura do app — exibe o logo animado em tela cheia
 * por uma duração fixa antes de liberar o conteúdo.
 *
 * Duração padrão: 3500ms (tempo aproximado da animação completa do GIF).
 * Ajuste `durationMs` se o GIF for mais longo/curto.
 */
export default function SplashScreen({ onFinish, durationMs = 3500 }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Inicia fade-out 400ms antes do fim
    const fadeTimer = setTimeout(() => setFading(true), Math.max(0, durationMs - 400));
    const finishTimer = setTimeout(() => onFinish?.(), durationMs);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [durationMs, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src="https://media.base44.com/images/public/69b2fc6e5d83e60566460a2d/ce8674c2c_logo_animado_final.gif"
        alt="Nexus360"
        className="w-full h-full max-w-screen max-h-screen object-contain"
      />
    </div>
  );
}