import React from "react";
import { Flame, CheckCircle2, Loader2 } from "lucide-react";
import TarefaCardCompacto from "./TarefaCardCompacto";

export default function AgendaHoje({ tarefas, carregando, ocupadaId, onConcluir, onAdiar, onCancelar }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
      <header className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-500" />
        <h2 className="text-base font-bold text-slate-900">Para agora</h2>
        {!carregando && tarefas.length > 0 && (
          <span className="ml-auto text-xs font-semibold text-slate-500">{tarefas.length} tarefa(s)</span>
        )}
      </header>

      {carregando ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : tarefas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
          <p className="text-sm font-semibold text-slate-700">Nada urgente agora</p>
          <p className="text-xs text-slate-500 mt-1">Sua fila prioritária está limpa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tarefas.map(t => (
            <TarefaCardCompacto
              key={t.id}
              tarefa={t}
              ocupada={ocupadaId === t.id}
              onConcluir={onConcluir}
              onAdiar={onAdiar}
              onCancelar={onCancelar}
            />
          ))}
        </div>
      )}
    </section>
  );
}