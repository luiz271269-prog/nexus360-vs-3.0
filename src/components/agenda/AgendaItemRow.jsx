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
  return <div className={`group flex items-stretch overflow-hidden rounded-xl border border-agenda-border bg-agenda-panel/45 transition-all hover:border-agenda-accent/50 hover:bg-agenda-panel/70 ${concluida ? 'opacity-60' : ''}`}>
    <div className={`w-1 flex-shrink-0 ${BARRA[item.prioridade] || BARRA.media}`} />
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3"><Icone className={`h-4 w-4 flex-shrink-0 ${item.tipo === 'evento' ? 'text-violet-300' : 'text-amber-300'}`} />
      <div className="min-w-0 flex-1"><p className={`truncate text-sm font-medium ${concluida ? 'text-agenda-muted line-through' : 'text-agenda-text'}`}>{item.titulo}</p><div className="mt-1 flex items-center gap-2 text-xs text-agenda-muted">{item.contexto && <><span className="max-w-[220px] truncate">{item.contexto}</span><span>•</span></>}<span className={atrasado && !concluida ? 'font-medium text-rose-300' : ''}>{rotuloQuando(item)}</span></div></div>
      <div className="flex flex-shrink-0 items-center gap-1 opacity-70 group-hover:opacity-100">{ocupado ? <Loader2 className="mx-2 h-4 w-4 animate-spin" /> : <>
        {item.threadId && <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-sky-300 hover:bg-agenda-panel" title="Abrir contexto"><Link to={`/Comunicacao?thread=${item.threadId}`}><MessageSquare className="h-4 w-4" /></Link></Button>}
        {!concluida && <><Button size="icon" variant="ghost" className="h-8 w-8 text-violet-300 hover:bg-agenda-panel" title="Iniciar" onClick={() => onIniciar(item)}><Play className="h-4 w-4" /></Button>{item.tipo === 'tarefa' && item.entidade === 'ScheduleTask' && <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-300 hover:bg-agenda-panel" title="Aguardar terceiro" onClick={() => onAguardar(item)}><Hourglass className="h-4 w-4" /></Button>}<Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-300 hover:bg-agenda-panel" title="Concluir" onClick={() => onConcluir(item)}><Check className="h-4 w-4" /></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-agenda-muted hover:bg-agenda-panel hover:text-agenda-text" title="Reagendar"><Clock className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onAdiar(item, 1)}>Amanhã</DropdownMenuItem><DropdownMenuItem onClick={() => onAdiar(item, 3)}>Em 3 dias</DropdownMenuItem><DropdownMenuItem onClick={() => onAdiar(item, 7)}>Próxima semana</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-agenda-muted hover:bg-agenda-panel hover:text-rose-300" title="Cancelar" onClick={() => onCancelar(item)}><X className="h-4 w-4" /></Button></>}
      </>}</div>
    </div>
  </div>;
}