import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Check, Clock, X, MessageSquare, CalendarDays, Zap, Loader2, Play, Hourglass } from 'lucide-react';
import { rotuloQuando, diasDeAtraso } from './agendaModel';

const BARRA = { critica: 'bg-rose-500', alta: 'bg-amber-500', media: 'bg-sky-500', baixa: 'bg-slate-300' };

export default function AgendaItemRow({ item, ocupado, onIniciar, onAguardar, onConcluir, onAdiar, onCancelar }) {
  const atrasado = diasDeAtraso(item) > 0;
  const concluida = ['concluida', 'completed'].includes(item.status);
  const Icone = item.tipo === 'evento' ? CalendarDays : Zap;
  return <div className={`group flex items-stretch rounded-xl border bg-white overflow-hidden hover:shadow-md ${concluida ? 'opacity-60' : 'border-slate-200'}`}>
    <div className={`w-1.5 flex-shrink-0 ${BARRA[item.prioridade] || BARRA.media}`} />
    <div className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3"><Icone className={`w-4 h-4 flex-shrink-0 ${item.tipo === 'evento' ? 'text-violet-500' : 'text-amber-500'}`} />
      <div className="min-w-0 flex-1"><p className={`text-sm font-semibold truncate ${concluida ? 'line-through text-slate-500' : 'text-slate-900'}`}>{item.titulo}</p><div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">{item.contexto && <><span className="truncate max-w-[220px]">{item.contexto}</span><span>•</span></>}<span className={atrasado && !concluida ? 'text-rose-600 font-medium' : ''}>{rotuloQuando(item)}</span></div></div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-70 group-hover:opacity-100">{ocupado ? <Loader2 className="w-4 h-4 animate-spin mx-2" /> : <>
        {item.threadId && <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-sky-600" title="Abrir contexto"><Link to={`/Comunicacao?thread=${item.threadId}`}><MessageSquare className="w-4 h-4" /></Link></Button>}
        {!concluida && <><Button size="icon" variant="ghost" className="h-8 w-8 text-violet-600" title="Iniciar" onClick={() => onIniciar(item)}><Play className="w-4 h-4" /></Button>{item.tipo === 'tarefa' && item.entidade === 'ScheduleTask' && <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" title="Aguardar terceiro" onClick={() => onAguardar(item)}><Hourglass className="w-4 h-4" /></Button>}<Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" title="Concluir" onClick={() => onConcluir(item)}><Check className="w-4 h-4" /></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" title="Reagendar"><Clock className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onAdiar(item, 1)}>Amanhã</DropdownMenuItem><DropdownMenuItem onClick={() => onAdiar(item, 3)}>Em 3 dias</DropdownMenuItem><DropdownMenuItem onClick={() => onAdiar(item, 7)}>Próxima semana</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-600" title="Cancelar" onClick={() => onCancelar(item)}><X className="w-4 h-4" /></Button></>}
      </>}</div>
    </div>
  </div>;
}