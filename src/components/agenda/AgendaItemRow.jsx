import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Check, Clock, X, MessageSquare, CalendarDays, Zap, Loader2 } from 'lucide-react';
import { rotuloQuando, diasDeAtraso } from './agendaModel';

const BARRA = {
  critica: 'bg-rose-500',
  alta: 'bg-amber-500',
  media: 'bg-sky-500',
  baixa: 'bg-slate-300'
};

export default function AgendaItemRow({ item, ocupado, onConcluir, onAdiar, onCancelar }) {
  const atrasado = diasDeAtraso(item) > 0;
  const Icone = item.tipo === 'evento' ? CalendarDays : Zap;

  return (
    <div className="group flex items-stretch gap-0 rounded-xl border border-slate-200 bg-white overflow-hidden transition-shadow hover:shadow-md">
      <div className={`w-1.5 flex-shrink-0 ${BARRA[item.prioridade] || BARRA.media}`} />

      <div className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3">
        <Icone className={`w-4 h-4 flex-shrink-0 ${item.tipo === 'evento' ? 'text-violet-500' : 'text-amber-500'}`} />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{item.titulo}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            {item.contexto && <span className="truncate max-w-[220px]">{item.contexto}</span>}
            {item.contexto && <span className="text-slate-300">•</span>}
            <span className={atrasado ? 'text-rose-600 font-medium' : ''}>{rotuloQuando(item)}</span>
            {item.responsavel && <><span className="text-slate-300">•</span><span>{item.responsavel}</span></>}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          {ocupado ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400 mx-2" />
          ) : (
            <>
              {item.threadId && (
                <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-sky-600 hover:bg-sky-50" title="Abrir conversa">
                  <Link to={`/Comunicacao?thread=${item.threadId}`}><MessageSquare className="w-4 h-4" /></Link>
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Concluir" onClick={() => onConcluir(item)}>
                <Check className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:bg-slate-100" title="Adiar">
                    <Clock className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onAdiar(item, 1)}>Amanhã</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAdiar(item, 3)}>Em 3 dias</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAdiar(item, 7)}>Próxima semana</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Remover" onClick={() => onCancelar(item)}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}