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
    <div className="flex items-center gap-2 p-2 bg-white border-b border-slate-200 rounded-t-lg flex-wrap">
      {/* Toggle 3 visualizações */}
      <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
        <button
          onClick={() => onModeChange('parados')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'parados' ? 'bg-yellow-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}
        >
          <Pause className="w-3 h-3" />Parados
        </button>
        <button
          onClick={() => onModeChange('usuario')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'usuario' ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}
        >
          <Users className="w-3 h-3" />Atendente
        </button>
        <button
          onClick={() => onModeChange('integracao')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'integracao' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}
        >
          <Columns className="w-3 h-3" />Canal
        </button>
      </div>

      {/* Urgentes */}
      <button
        onClick={() => onModeChange('urgentes')}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'urgentes' ? 'bg-purple-600 text-white shadow' : 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'}`}
      >
        <Zap className="w-3.5 h-3.5 flex-shrink-0" />Urgentes
      </button>

      <div className="h-5 w-px bg-slate-200" />

      {/* Não Atribuídos */}
      {onOpenKanbanNaoAtribuidos && (
        <Button
          onClick={onOpenKanbanNaoAtribuidos}
          size="sm"
          className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white border-0 h-8 text-xs px-2.5 flex items-center gap-1 font-semibold shadow-sm"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Não Atribuídos
          {unassignedCount > 0 && (
            <Badge className="bg-white text-red-600 text-[9px] font-bold px-1 h-4 min-w-4 flex items-center justify-center rounded-full ml-0.5">
              {unassignedCount}
            </Badge>
          )}
        </Button>
      )}

      {/* Seleção múltipla */}
      {onModoSelecaoMultiplaChange && (
        <button
          onClick={() => onModoSelecaoMultiplaChange(!modoSelecaoMultipla)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all border ${modoSelecaoMultipla ? 'bg-orange-500 text-white border-orange-500 shadow' : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
          title="Selecionar múltiplos para envio em massa"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          Selecionar
        </button>
      )}
    </div>
  );
}