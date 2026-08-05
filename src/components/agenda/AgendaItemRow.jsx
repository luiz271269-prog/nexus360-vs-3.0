import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Check, Clock, X, Mail, Loader2, Play, Hourglass, AlertTriangle } from 'lucide-react';
import { rotuloQuando, diasDeAtraso, nivelUrgencia } from './agendaModel';
import AgendaCategoriaBadge from './AgendaCategoriaBadge';
import AgendaChatButton from './AgendaChatButton';

const BARRA = { critica: 'bg-rose-500', alta: 'bg-amber-500', media: 'bg-sky-500', baixa: 'bg-slate-300' };

export default function AgendaItemRow({ item, ocupado, onIniciar, onAguardar, onConcluir, onAdiar, onCancelar, onAbrir }) {
  const atrasado = diasDeAtraso(item) > 0;
  const concluida = ['concluida', 'completed'].includes(item.status);
  const urgencia = nivelUrgencia(item);
  const email = item.raw?.cliente_email || item.raw?.email;
  const parar = fn => e => { e.stopPropagation(); fn(); };

  return <div className={`group flex items-stretch overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md ${concluida ? 'opacity-60' : ''} ${urgencia ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-200 hover:border-rose-400' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
    <div className={`w-1.5 flex-shrink-0 ${urgencia ? 'bg-rose-600' : (BARRA[item.prioridade] || BARRA.media)}`} />
    <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3">
      <button type="button" onClick={() => onAbrir?.(item)} className="min-w-0 text-left">
        <p className={`truncate text-sm font-semibold ${concluida ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.titulo}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          {item.contexto && <><span className="max-w-[220px] truncate">{item.contexto}</span><span>•</span></>}
          <span className={(atrasado || urgencia) && !concluida ? 'font-semibold text-rose-600' : ''}>{rotuloQuando(item)}</span>
        </div>
        {urgencia && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
          <AlertTriangle className="h-3 w-3" />
          {urgencia === 'atrasado' ? 'Vencida' : 'Vence em menos de 24h'}
        </span>}
      </button>

      <div className="flex items-center justify-between gap-2">
        <AgendaCategoriaBadge item={item} />
        <div className="flex flex-shrink-0 items-center gap-0.5">{ocupado ? <Loader2 className="mx-2 h-4 w-4 animate-spin text-slate-400" /> : <>
          {(item.threadId || item.raw?.contact_id || item.raw?.cliente_id) && <AgendaChatButton item={item} />}
          {email && <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-slate-600 hover:bg-slate-100" title="Enviar e-mail"><Link to={`/Emails?to=${encodeURIComponent(email)}`} onClick={e => e.stopPropagation()}><Mail className="h-4 w-4" /></Link></Button>}
          {!concluida && <>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-violet-600 hover:bg-violet-50" title="Iniciar" onClick={parar(() => onIniciar(item))}><Play className="h-4 w-4" /></Button>
            {item.entidade === 'ScheduleTask' && <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:bg-amber-50" title="Aguardar terceiro" onClick={parar(() => onAguardar(item))}><Hourglass className="h-4 w-4" /></Button>}
            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Concluir" onClick={parar(() => onConcluir(item))}><Check className="h-4 w-4" /></Button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:bg-slate-100" title="Reagendar" onClick={e => e.stopPropagation()}><Clock className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onAdiar(item, 1)}>Amanhã</DropdownMenuItem><DropdownMenuItem onClick={() => onAdiar(item, 3)}>Em 3 dias</DropdownMenuItem><DropdownMenuItem onClick={() => onAdiar(item, 7)}>Próxima semana</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Cancelar" onClick={parar(() => onCancelar(item))}><X className="h-4 w-4" /></Button>
          </>}
        </>}</div>
      </div>
    </div>
  </div>;
}