import React from "react";
import { Check, Clock, X, Building2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rotuloPrazo, diasDeAtraso } from "./tarefaHelpers";

const CORES_PRIORIDADE = {
  critica: "border-l-red-500 bg-red-50/60",
  alta: "border-l-orange-500 bg-orange-50/60",
  media: "border-l-amber-400 bg-amber-50/50",
  baixa: "border-l-slate-300 bg-white"
};

export default function TarefaCardCompacto({ tarefa, onConcluir, onAdiar, onCancelar, ocupada }) {
  const atrasada = diasDeAtraso(tarefa) > 0;

  return (
    <div className={`group border-l-4 rounded-lg border border-slate-200 p-3 transition-shadow hover:shadow-md ${CORES_PRIORIDADE[tarefa.prioridade] || CORES_PRIORIDADE.baixa}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 leading-snug">{tarefa.titulo}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {tarefa.cliente_nome && (
              <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                <Building2 className="w-3 h-3 shrink-0" />{tarefa.cliente_nome}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 ${atrasada ? "text-red-600 font-medium" : ""}`}>
              {atrasada ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {rotuloPrazo(tarefa)}
            </span>
            {tarefa.vendedor_responsavel && <span className="text-slate-400">{tarefa.vendedor_responsavel}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon" variant="ghost" disabled={ocupada} title="Concluir"
            onClick={() => onConcluir(tarefa)}
            className="h-8 w-8 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button
            size="icon" variant="ghost" disabled={ocupada} title="Adiar 1 dia"
            onClick={() => onAdiar(tarefa, 1)}
            className="h-8 w-8 text-slate-500 hover:bg-slate-100"
          >
            <Clock className="w-4 h-4" />
          </Button>
          <Button
            size="icon" variant="ghost" disabled={ocupada} title="Cancelar"
            onClick={() => onCancelar(tarefa)}
            className="h-8 w-8 text-slate-400 hover:bg-red-100 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}