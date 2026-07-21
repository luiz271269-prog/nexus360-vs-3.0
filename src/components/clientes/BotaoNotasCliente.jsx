import React from 'react';
import { NotebookPen } from 'lucide-react';
import ClienteHistoricoDrawer from './ClienteHistoricoDrawer';

/**
 * Botão "Notas" autocontido — abre o drawer de histórico interno do cliente.
 * Mesma ação disponível no card do kanban, agora reutilizável na lista.
 */
export default function BotaoNotasCliente({ cliente, className = '' }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Notas / histórico interno"
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-md transition-all duration-150 ${className}`}
      >
        <NotebookPen className="w-4 h-4" />
      </button>
      {open && (
        <ClienteHistoricoDrawer cliente={cliente} isOpen={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
}