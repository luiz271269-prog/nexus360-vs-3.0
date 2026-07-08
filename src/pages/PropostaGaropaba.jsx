import React, { useState } from 'react';
import SlideProposta from '@/components/proposta/SlideProposta';
import { slidesProposta } from '@/components/proposta/slidesProposta';

export default function PropostaGaropaba() {
  const [atual, setAtual] = useState(0);
  const total = slidesProposta.length;

  return (
    <div className="fixed inset-0 bg-[#121212] text-[#E0E0E0] flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-6xl h-full relative">
        {slidesProposta.map((slide, i) => (
          <SlideProposta key={i} slide={slide} ativo={i === atual} />
        ))}

        <div className="absolute bottom-8 right-10 z-50 flex gap-3">
          <button
            onClick={() => setAtual(a => a - 1)}
            disabled={atual === 0}
            className="px-5 py-2.5 font-mono text-sm rounded border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] transition-all disabled:border-[#555] disabled:text-[#555] disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            &lt; ANTERIOR
          </button>
          <button
            onClick={() => setAtual(a => a + 1)}
            disabled={atual === total - 1}
            className="px-5 py-2.5 font-mono text-sm rounded border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] transition-all disabled:border-[#555] disabled:text-[#555] disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            PRÓXIMO &gt;
          </button>
        </div>

        <div className="absolute bottom-9 left-10 z-50 font-mono text-xs text-[#D4AF37]/60">
          {atual + 1} / {total}
        </div>
      </div>
    </div>
  );
}