import React from 'react';

/**
 * Fundo da identidade visual Neural/Tech:
 * Azul marinho profundo + trilhas PCB douradas nas bordas + rim light azul/dourado.
 */
export default function FundoNeural({ className = '' }) {
  return (
    <div className={`absolute inset-0 -z-10 overflow-hidden bg-[#050A14] ${className}`}>
      <img
        src="https://media.base44.com/images/public/68a7d067890527304dbe8477/7bec3b3a0_generated_image.png"
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050A14]/40 via-[#050A14]/70 to-[#050A14]/90" />
    </div>
  );
}