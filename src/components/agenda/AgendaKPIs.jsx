import React from 'react';

function Kpi({ valor, rotulo, cor, ativo, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-20 rounded-xl border px-4 py-3 text-left backdrop-blur-xl transition-all ${
        ativo
          ? 'border-agenda-accent bg-agenda-accent/25 shadow-lg shadow-violet-600/30'
          : 'border-agenda-border bg-agenda-panel/55 shadow-lg shadow-slate-950/20 hover:border-agenda-accent/60 hover:bg-agenda-panel/75'
      }`}
    >
      <p className={`text-2xl font-bold leading-none ${cor}`}>{valor}</p>
      <p className="mt-2 text-xs text-agenda-text">{rotulo}</p>
    </button>
  );
}

export default function AgendaKPIs({ resumo, filtro, onFiltrar }) {
  const card = (chave, rotulo, cor) => <Kpi valor={resumo[chave]} rotulo={rotulo} cor={cor} ativo={filtro === chave} onClick={() => onFiltrar(filtro === chave ? null : chave)} />;
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
    {card('atrasados', 'Atrasadas', 'text-rose-400')}
    {card('hoje', 'Para hoje', 'text-sky-400')}
    {card('compromissos', 'Eventos', 'text-violet-400')}
    {card('aguardando', 'Aguardando', 'text-amber-400')}
    {card('concluidas', 'Concluídas', 'text-emerald-400')}
  </div>;
}