import React from 'react';
import { CalendarPlus, ListTodo } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function EscolherAgendamentoDialog({ aberto, onFechar, onEscolher }) {
  return (
    <Dialog open={aberto} onOpenChange={v => !v && onFechar?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Agendar retorno</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => onEscolher('tarefa')} className="rounded-xl border p-5 text-left hover:border-violet-400 hover:bg-violet-50">
            <ListTodo className="mb-3 h-6 w-6 text-violet-600" />
            <strong className="block">Tarefa</strong>
            <span className="text-sm text-slate-500">Acompanhar e concluir na Agenda.</span>
          </button>
          <button onClick={() => onEscolher('evento')} className="rounded-xl border p-5 text-left hover:border-blue-400 hover:bg-blue-50">
            <CalendarPlus className="mb-3 h-6 w-6 text-blue-600" />
            <strong className="block">Evento</strong>
            <span className="text-sm text-slate-500">Reservar dia e horário no calendário.</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}