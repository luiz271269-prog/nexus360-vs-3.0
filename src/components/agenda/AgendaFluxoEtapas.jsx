import React from 'react';
import { ChevronRight } from 'lucide-react';
import { FLUXOS, etapasFinais, rotuloEtapa } from './agendaFluxos';

export default function AgendaFluxoEtapas({ categoria, etapa, onSelecionar, desabilitado }) {
  const etapas = (FLUXOS[categoria] || FLUXOS.tarefa).etapas;
  const finais = etapasFinais(categoria);

  const Pill = ([valor, rotulo], final) => {
    const ativa = valor === etapa;
    const base = ativa
      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
      : final
        ? 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700';
    return (
      <button key={valor} type="button" disabled={desabilitado} onClick={() => onSelecionar?.(valor)}
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${base}`}>
        {rotulo || rotuloEtapa(categoria, valor)}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Fluxo de trabalho</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {etapas.map((e, i) => (
          <React.Fragment key={e[0]}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
            {Pill(e, false)}
          </React.Fragment>
        ))}
      </div>
      {finais.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2">
          <span className="mr-1 text-xs text-slate-400">Encerrar como:</span>
          {finais.map(e => Pill(e, true))}
        </div>
      )}
    </div>
  );
}