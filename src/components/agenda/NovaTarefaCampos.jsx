import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TASK_TYPES, PRIORITIES, REMINDERS } from './agendaTaskUtils';
import RecorrenciaCampos from './RecorrenciaCampos';

const CampoSelect = ({ label, value, onChange, options }) => <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent></Select></div>;

export default function NovaTarefaCampos({ form, alterar, usuario, usuarios }) {
  return <div className="space-y-4">
    <div className="space-y-1.5"><Label>Título</Label><Input autoFocus value={form.titulo} onChange={e => alterar('titulo', e.target.value)} placeholder="Ex: Retornar proposta da Empresa X" /></div>
    <div className="grid grid-cols-2 gap-3"><CampoSelect label="Tipo" value={form.tipo} onChange={v => alterar('tipo', v)} options={TASK_TYPES} /><CampoSelect label="Prioridade" value={form.prioridade} onChange={v => alterar('prioridade', v)} options={PRIORITIES} /></div>
    <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Prazo</Label><Input type="date" value={form.data} onChange={e => alterar('data', e.target.value)} /></div><div className="space-y-1.5"><Label>Horário</Label><Input type="time" value={form.hora} disabled={form.semHorario} onChange={e => alterar('hora', e.target.value)} /></div></div>
    <label className="flex items-center gap-2 text-sm text-slate-600"><Checkbox checked={form.semHorario} onCheckedChange={v => alterar('semHorario', Boolean(v))} />Sem horário definido</label>
    <RecorrenciaCampos frequencia={form.recorrencia} repeticoes={form.repeticoes} onFrequencia={v => alterar('recorrencia', v)} onRepeticoes={v => alterar('repeticoes', v)} />
    <div className="grid grid-cols-2 gap-3"><CampoSelect label="Lembrete" value={form.lembrete} onChange={v => alterar('lembrete', v)} options={REMINDERS} />{usuarios.length > 0 && <CampoSelect label="Responsável" value={form.responsavel} onChange={v => alterar('responsavel', v)} options={usuarios.map(u => [u.id, u.full_name || u.display_name || u.email])} />}</div>
    <div className="space-y-1.5"><Label>Descrição <span className="font-normal text-slate-400">(opcional)</span></Label><Textarea rows={3} value={form.descricao} onChange={e => alterar('descricao', e.target.value)} /></div>
  </div>;
}