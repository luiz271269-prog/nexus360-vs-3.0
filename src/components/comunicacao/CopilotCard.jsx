import React from 'react';
import { Sparkles, Send, X, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const prioridadeStyles = {
  baixa: 'bg-slate-100 text-slate-600 border-slate-200',
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  alta: 'bg-orange-50 text-orange-700 border-orange-200',
  critica: 'bg-red-50 text-red-700 border-red-200',
};

export default function CopilotCard({ card, onUse, onDismiss, compact = false }) {
  if (!card?.message) return null;

  const state = card.conversation_state || {};
  const prioridade = state.prioridade_operacional || card.priority || 'normal';
  const prioridadeClass = prioridadeStyles[prioridade] || prioridadeStyles.normal;

  return (
    <div className={cn(
      'rounded-xl border border-purple-200 bg-gradient-to-br from-white to-purple-50/70 shadow-sm overflow-hidden',
      compact ? 'p-2' : 'p-3'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-purple-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-purple-800 truncate">{card.title || 'Copilot Nexus'}</p>
          <p className="text-[11px] text-slate-500 truncate">{card.reasoning || 'Sugestão baseada no estado da conversa'}</p>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', prioridadeClass)}>
          {prioridade}
        </span>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-2">
        {card.message}
      </p>

      {state.estado_principal && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            <ShieldCheck className="w-3 h-3" /> {state.estado_principal}
          </span>
          {state.fora_horario && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <Clock className="w-3 h-3" /> fora de horário
            </span>
          )}
          {state.acoes_descartadas?.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              <AlertTriangle className="w-3 h-3" /> {state.acoes_descartadas.length} ação(ões) bloqueada(s)
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {onUse && (
          <button
            type="button"
            onClick={onUse}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
          >
            <Send className="w-3 h-3" /> Usar sugestão
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Dispensar"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}