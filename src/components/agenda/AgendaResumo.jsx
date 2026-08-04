import React from "react";
import { diasDeAtraso } from "./tarefaHelpers";

function Metrica({ rotulo, valor, cor }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
      <p className="text-xs text-slate-500 mt-0.5">{rotulo}</p>
    </div>
  );
}

export default function AgendaResumo({ tarefas }) {
  const criticas = tarefas.filter(t => t.prioridade === "critica").length;
  const hoje = tarefas.filter(t => diasDeAtraso(t) === 0).length;
  const atrasadas = tarefas.filter(t => diasDeAtraso(t) > 0).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metrica rotulo="Abertas" valor={tarefas.length} cor="text-slate-900" />
      <Metrica rotulo="Para hoje" valor={hoje} cor="text-blue-600" />
      <Metrica rotulo="Atrasadas" valor={atrasadas} cor="text-red-600" />
      <Metrica rotulo="Críticas" valor={criticas} cor="text-orange-600" />
    </div>
  );
}