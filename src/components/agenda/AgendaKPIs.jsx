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
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi valor={resumo.hoje} rotulo="Para hoje" cor="text-sky-600" ativo={filtro === 'hoje'} onClick={() => onFiltrar(filtro === 'hoje' ? null : 'hoje')} />
      <Kpi valor={resumo.atrasados} rotulo="Em atraso" cor="text-rose-600" ativo={filtro === 'atrasados'} onClick={() => onFiltrar(filtro === 'atrasados' ? null : 'atrasados')} />
      <Kpi valor={resumo.criticos} rotulo="Críticas" cor="text-amber-600" ativo={filtro === 'criticos'} onClick={() => onFiltrar(filtro === 'criticos' ? null : 'criticos')} />
      <Kpi valor={resumo.compromissos} rotulo="Compromissos" cor="text-violet-600" ativo={filtro === 'compromissos'} onClick={() => onFiltrar(filtro === 'compromissos' ? null : 'compromissos')} />
    </div>
  );
}