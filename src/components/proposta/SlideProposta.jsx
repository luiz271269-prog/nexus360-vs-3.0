import React from 'react';

const Painel = ({ children, className = '' }) => (
  <div className={`bg-[#1e1e1e] border border-[#D4AF37] rounded-lg p-6 md:p-8 my-3 shadow-[0_4px_15px_rgba(212,175,55,0.1)] ${className}`}>
    {children}
  </div>
);

const TechData = ({ linhas, className = '' }) => (
  <div className={`font-mono text-[#F3E5AB] bg-black p-4 border-l-4 border-[#D4AF37] my-2 leading-relaxed ${className}`}>
    {linhas.map((l, i) => <div key={i}>&gt; {l}</div>)}
  </div>
);

export default function SlideProposta({ slide, ativo }) {
  return (
    <div className={`absolute inset-0 p-6 md:p-10 flex flex-col justify-center transition-opacity duration-500 overflow-y-auto ${ativo ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
      {slide.titulo && (
        <h1 className={`text-[#D4AF37] uppercase tracking-widest mb-5 font-bold ${slide.capa ? 'text-3xl md:text-4xl border-b border-[#D4AF37] pb-3' : 'text-2xl md:text-3xl'}`}>
          {slide.titulo}
        </h1>
      )}

      {slide.blocos.map((bloco, i) => {
        if (bloco.tipo === 'tech') return <Painel key={i}>{bloco.tech && <TechData linhas={bloco.tech} />}{bloco.texto && <p className="text-lg mt-4 text-justify">{bloco.texto}</p>}{bloco.lista && <Lista itens={bloco.lista} />}</Painel>;
        if (bloco.tipo === 'grid') return (
          <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bloco.colunas.map((col, j) => (
              <Painel key={j}>
                {col.subtitulo && <h3 className="text-[#D4AF37] uppercase tracking-wider text-lg font-semibold mb-3">{col.subtitulo}</h3>}
                {col.tech && <TechData linhas={col.tech} />}
                {col.texto && <p className="text-lg text-justify" dangerouslySetInnerHTML={{ __html: col.texto }} />}
                {col.lista && <Lista itens={col.lista} />}
              </Painel>
            ))}
          </div>
        );
        if (bloco.tipo === 'destaque') return (
          <Painel key={i} className="text-center">
            <h3 className="text-[#D4AF37] uppercase tracking-wider text-lg font-semibold mb-2">{bloco.subtitulo}</h3>
            <div className="font-mono text-[#F3E5AB] text-4xl md:text-5xl">{bloco.valor}</div>
          </Painel>
        );
        if (bloco.tipo === 'alerta') return (
          <div key={i} className="bg-[#D4AF37]/10 border border-dashed border-[#D4AF37] p-4 text-center text-lg mt-4">
            {bloco.texto}
          </div>
        );
        return null;
      })}
    </div>
  );
}

const Lista = ({ itens }) => (
  <ul className="list-none space-y-3 text-lg leading-relaxed">
    {itens.map((item, i) => (
      <li key={i} className="pl-5 relative">
        <span className="absolute left-0 text-[#D4AF37]">■</span>
        <span dangerouslySetInnerHTML={{ __html: item }} />
      </li>
    ))}
  </ul>
);