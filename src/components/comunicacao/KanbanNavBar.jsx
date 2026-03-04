import React from "react";
import { Pause, Users, Columns, Zap, AlertTriangle, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function KanbanNavBar({
  kanbanMode,
  onModeChange,
  threadCount,
  unassignedCount,
  modoSelecaoMultipla,
  onModoSelecaoMultiplaChange,
  onOpenKanbanNaoAtribuidos,
}) {
  return (
    <div className="flex items-center gap-1 p-2 bg-white border-b border-slate-200 flex-wrap">
      {/* Parados */}
      <button
        onClick={() => onModeChange('parados')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'parados' ? 'bg-yellow-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200'}`}
      >
        <Pause className="w-3 h-3" />Parados
      </button>

      {/* Atendente */}
      <button
        onClick={() => onModeChange('usuario')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'usuario' ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200'}`}
      >
        <Users className="w-3 h-3" />Atendente
      </button>

      {/* Canal */}
      <button
        onClick={() => onModeChange('integracao')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'integracao' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200'}`}
      >
        <Columns className="w-3 h-3" />Canal
      </button>

      {/* Urgentes */}
      <button
        onClick={() => onModeChange('urgentes')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'urgentes' ? 'bg-purple-600 text-white shadow' : 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'}`}
      >
        <Zap className="w-3.5 h-3.5 flex-shrink-0" />Urgentes
      </button>

      {/* Não Atribuídos */}
      {onOpenKanbanNaoAtribuidos && (
        <button
          onClick={onOpenKanbanNaoAtribuidos}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all border ${unassignedCount > 0 ? 'bg-red-500 text-white border-red-500 shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white border-slate-200'}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Não Atribuídos
          {unassignedCount > 0 && (
            <Badge className="bg-white text-red-600 text-[9px] font-bold px-1 h-4 min-w-4 flex items-center justify-center rounded-full ml-0.5">
              {unassignedCount}
            </Badge>
          )}
        </button>
      )}

      {/* Selecionar */}
      {onModoSelecaoMultiplaChange && (
        <button
          onClick={() => onModoSelecaoMultiplaChange(!modoSelecaoMultipla)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all border ${modoSelecaoMultipla ? 'bg-orange-500 text-white border-orange-500 shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white border-slate-200'}`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          Selecionar
        </button>
      )}
    </div>
  );
}