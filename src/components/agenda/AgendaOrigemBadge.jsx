import React from 'react';
import { MessageSquare, Briefcase, FileText, DollarSign, Headphones, Workflow, Bot, CalendarClock, Hand, Calendar } from 'lucide-react';

const MAPA = {
  manual: { rotulo: 'Manual', icone: Hand, cor: 'bg-slate-100 text-slate-700 border-slate-200' },
  conversa: { rotulo: 'Conversa', icone: MessageSquare, cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  crm: { rotulo: 'CRM', icone: Briefcase, cor: 'bg-blue-50 text-blue-700 border-blue-200' },
  orcamento: { rotulo: 'Orçamento', icone: FileText, cor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  cobranca: { rotulo: 'Cobrança', icone: DollarSign, cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  atendimento: { rotulo: 'Atendimento', icone: Headphones, cor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  automacao: { rotulo: 'Automação', icone: Workflow, cor: 'bg-purple-50 text-purple-700 border-purple-200' },
  ia: { rotulo: 'IA', icone: Bot, cor: 'bg-violet-50 text-violet-700 border-violet-200' },
  calendario_externo: { rotulo: 'Calendário externo', icone: CalendarClock, cor: 'bg-teal-50 text-teal-700 border-teal-200' },
  agenda: { rotulo: 'Agenda', icone: Calendar, cor: 'bg-slate-100 text-slate-700 border-slate-200' }
};

export default function AgendaOrigemBadge({ item, className = '' }) {
  const cfg = MAPA[item?.origem] || MAPA.agenda;
  const Icone = cfg.icone;
  return (
    <span title={`Origem: ${cfg.rotulo}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cor} ${className}`}>
      <Icone className="h-3 w-3" />
      {cfg.rotulo}
    </span>
  );
}