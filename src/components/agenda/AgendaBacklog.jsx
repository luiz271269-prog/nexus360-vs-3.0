import React, { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import TarefaCardCompacto from "./TarefaCardCompacto";

const PAGINA = 20;

export default function AgendaBacklog({ tarefas, ocupadaId, onConcluir, onAdiar, onCancelar }) {
  const [aberto, setAberto] = useState(false);
  const [visiveis, setVisiveis] = useState(PAGINA);

  if (tarefas.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50 rounded-2xl transition-colors"
      >
        {aberto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <Layers className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">Backlog</span>
        <span className="ml-auto text-xs font-semibold text-slate-500">{tarefas.length}</span>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-2">
          {tarefas.slice(0, visiveis).map(t => (
            <TarefaCardCompacto
              key={t.id}
              tarefa={t}
              ocupada={ocupadaId === t.id}
              onConcluir={onConcluir}
              onAdiar={onAdiar}
              onCancelar={onCancelar}
            />
          ))}
          {visiveis < tarefas.length && (
            <button
              onClick={() => setVisiveis(v => v + PAGINA)}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Mostrar mais ({tarefas.length - visiveis} restantes)
            </button>
          )}
        </div>
      )}
    </section>
  );
}