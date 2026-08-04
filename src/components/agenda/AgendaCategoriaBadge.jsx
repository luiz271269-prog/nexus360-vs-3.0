import React from 'react';
import { categoriaDoItem, etapaDoItem, rotuloCategoria, rotuloEtapa, ESPERA } from './agendaFluxos';

const CORES = {
  solicitacao: 'bg-sky-50 text-sky-700 border-sky-200',
  tarefa: 'bg-violet-50 text-violet-700 border-violet-200',
  agendamento: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  lembrete: 'bg-amber-50 text-amber-700 border-amber-200',
  retorno: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export default function AgendaCategoriaBadge({ item }) {
  const categoria = categoriaDoItem(item);
  const etapa = etapaDoItem(item);
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CORES[categoria]}`}>{rotuloCategoria(categoria)}</span>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESPERA.includes(etapa) ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
        {rotuloEtapa(categoria, etapa)}
      </span>
    </span>
  );
}