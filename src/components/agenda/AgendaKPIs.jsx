import React from 'react';

function Kpi({ valor, rotulo, cor, ativo, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-4 py-3 transition-all ${
        ativo ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <p className={`text-2xl font-bold leading-none ${ativo ? 'text-white' : cor}`}>{valor}</p>
      <p className={`text-xs mt-1 ${ativo ? 'text-slate-300' : 'text-slate-500'}`}>{rotulo}</p>
    </button>
  );
}

export default function AgendaKPIs({ resumo, filtro, onFiltrar }) {
  const card = (chave, rotulo, cor) => <Kpi valor={resumo[chave]} rotulo={rotulo} cor={cor} ativo={filtro === chave} onClick={() => onFiltrar(filtro === chave ? null : chave)} />;
  return <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
    {card('atrasados', 'Atrasadas', 'text-rose-600')}
    {card('hoje', 'Para hoje', 'text-sky-600')}
    {card('compromissos', 'Eventos', 'text-violet-600')}
    {card('aguardando', 'Aguardando', 'text-amber-600')}
    {card('concluidas', 'Concluídas', 'text-emerald-600')}
  </div>;
}