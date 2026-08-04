import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ArrowRight } from 'lucide-react';
import { PRIORITIES } from './agendaTaskUtils';
import { CATEGORIAS, categoriaDoItem, etapaDoItem, etapasDaCategoria, proximaEtapa, etapasFinais, etapaInicial } from './agendaFluxos';

const paraLocal = valor => {
  if (!valor) return { data: '', hora: '' };
  const d = new Date(valor);
  return { data: d.toISOString().slice(0, 10), hora: d.toTimeString().slice(0, 5) };
};

export default function AgendaDetalhePanel({ item, onFechar, onAtualizado }) {
  const inicial = paraLocal(item?.quando);
  const [form, setForm] = useState({
    titulo: item?.titulo || '',
    descricao: item?.raw?.descricao || item?.raw?.description || '',
    prioridade: item?.prioridade || 'media',
    categoria: categoriaDoItem(item),
    etapa: etapaDoItem(item),
    data: inicial.data,
    hora: inicial.hora
  });
  const [salvando, setSalvando] = useState(false);
  const eTarefa = item?.entidade === 'ScheduleTask';
  const eEvento = item?.entidade === 'ScheduleEvent';
  const editavel = eTarefa || eEvento;
  const alterar = (campo, valor) => setForm(f => ({
    ...f,
    [campo]: valor,
    ...(campo === 'categoria' ? { etapa: etapaInicial(valor) } : {})
  }));

  const salvar = async () => {
    if (!form.titulo.trim()) return toast.error('Informe o título');
    const quando = form.data ? new Date(`${form.data}T${form.hora || '12:00'}:00`) : null;
    setSalvando(true);
    try {
      if (eTarefa) {
        await base44.entities.ScheduleTask.update(item.id, {
          titulo: form.titulo.trim(), descricao: form.descricao || undefined, prioridade: form.prioridade,
          categoria: form.categoria, etapa: form.etapa, ...(quando ? { prazo_em: quando.toISOString() } : {})
        });
      } else if (eEvento) {
        await base44.entities.ScheduleEvent.update(item.id, {
          title: form.titulo.trim(), description: form.descricao || undefined,
          categoria: form.categoria, etapa: form.etapa, ...(quando ? { start_at: quando.toISOString() } : {})
        });
      }
      toast.success('Alterações salvas');
      onAtualizado?.();
      onFechar?.();
    } catch (e) { console.error('[AGENDA DETALHE]', e); toast.error('Não foi possível salvar'); }
    finally { setSalvando(false); }
  };

  const seguinte = proximaEtapa(form.categoria, form.etapa);

  return (
    <Dialog open={Boolean(item)} onOpenChange={v => !v && onFechar?.()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Detalhes do item</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Título</Label><Input value={form.titulo} onChange={e => alterar('titulo', e.target.value)} disabled={!editavel} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => alterar('categoria', v)} disabled={!editavel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Etapa</Label>
              <Select value={form.etapa} onValueChange={v => alterar('etapa', v)} disabled={!editavel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{etapasDaCategoria(form.categoria).map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {seguinte && editavel && (
            <Button variant="outline" size="sm" onClick={() => alterar('etapa', seguinte[0])}>
              <ArrowRight className="mr-2 h-4 w-4" />Avançar para {seguinte[1]}
            </Button>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={form.data} onChange={e => alterar('data', e.target.value)} disabled={!editavel} /></div>
            <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={form.hora} onChange={e => alterar('hora', e.target.value)} disabled={!editavel} /></div>
            <div className="space-y-1.5"><Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => alterar('prioridade', v)} disabled={!eTarefa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={4} value={form.descricao} onChange={e => alterar('descricao', e.target.value)} disabled={!editavel} /></div>

          {!editavel && <p className="text-xs text-slate-500">Este item é de origem legada e não pode ser editado aqui.</p>}
          <p className="text-xs text-slate-500">Encerramentos disponíveis: {etapasFinais(form.categoria).map(([, r]) => r).join(', ')}.</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Fechar</Button>
          <Button onClick={salvar} disabled={salvando || !editavel} className="bg-slate-900 text-white">
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}