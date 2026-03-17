import React from 'react';
import { MessageSquare, Pencil, History, ExternalLink } from 'lucide-react';

/**
 * Rodapé padrão para cards Kanban da Central de Comunicação.
 * Exibe botões: Msg · Editar · Histórico  com gradiente profissional.
 */
export default function KanbanCardFooter({ onMsg, onEdit, onHistorico, small = false }) {
  const base = small
    ? 'flex items-center justify-end gap-1 px-2 py-1 border-t border-black/5'
    : 'flex items-center justify-end gap-1.5 px-2.5 py-1.5 border-t border-black/5';

  const btnBase = small
    ? 'flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all active:scale-95 shadow-sm select-none'
    : 'flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all active:scale-95 shadow-sm select-none';

  const iconSize = small ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div className={base}>
      {onMsg && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMsg(); }}
          className={`${btnBase} bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white`}
          title="Abrir conversa"
        >
          <MessageSquare className={iconSize} />
          Msg
        </button>
      )}

      {onEdit && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit(); }}
          className={`${btnBase} bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white`}
          title="Editar contato"
        >
          <Pencil className={iconSize} />
          Editar
        </button>
      )}

      {onHistorico && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onHistorico(); }}
          className={`${btnBase} bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800 text-white`}
          title="Ver histórico"
        >
          <History className={iconSize} />
          Hist.
        </button>
      )}
    </div>
  );
}