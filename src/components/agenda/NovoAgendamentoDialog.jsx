import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CalendarPlus } from 'lucide-react';
import RecorrenciaCampos from './RecorrenciaCampos';
import { proximaOcorrencia } from './agendaTaskUtils';

const TIPOS = [
  { valor: 'compromisso', rotulo: 'Compromisso' },
  { valor: 'reuniao', rotulo: 'Reunião' },
  { valor: 'ligacao', rotulo: 'Ligação' },
  { valor: 'visita', rotulo: 'Visita' },
  { valor: 'bloco_trabalho', rotulo: 'Bloco de trabalho' }
];

const ANTECEDENCIAS = [
  { valor: '0', rotulo: 'Sem lembrete' },
  { valor: '15', rotulo: '15 min antes' },
  { valor: '60', rotulo: '1 hora antes' },
  { valor: '1440', rotulo: '1 dia antes' }
];

const agoraArredondado = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d;
};

/**
 * Diálogo único de criação de agendamento — usado em qualquer tela do app.
 * `contexto` permite pré-preencher a partir de uma conversa/cliente:
 * { titulo, descricao, threadId, contactId }
 */
export default function NovoAgendamentoDialog({ aberto, onFechar, contexto = {}, onCriado }) {
  const inicial = agoraArredondado();
  const [usuario, setUsuario] = useState(null);
  const [atendentes, setAtendentes] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    tipo: 'compromisso',
    data: inicial.toISOString().slice(0, 10),
    hora: inicial.toTimeString().slice(0, 5),
    local: '',
    notas: '',
    responsavel: '',
    antecedencia: '60',
    recorrencia: 'none',
    repeticoes: 1
  });

  useEffect(() => {
    if (!aberto) return;
    base44.auth.me().then(async u => {
      setUsuario(u);
      setForm(f => ({ ...f, responsavel: contexto.responsavelId || f.responsavel || u.id }));
      const resposta = await base44.functions.invoke('listarUsuariosParaAtribuicao', {}).catch(() => null);
      const lista = resposta?.data?.usuarios || [];
      setAtendentes(lista.length ? lista : [u]);
    }).catch(() => {});
    setForm(f => ({
      ...f,
      titulo: contexto.titulo || f.titulo,
      notas: contexto.descricao || f.notas
    }));
  }, [aberto, contexto.titulo, contexto.descricao, contexto.responsavelId]);

  const alterar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

  const salvar = async () => {
    if (!form.titulo.trim()) return toast.error('Informe o título');
    if (!form.data || !form.hora) return toast.error('Informe data e hora');

    const inicio = new Date(`${form.data}T${form.hora}:00`);
    if (isNaN(inicio.getTime())) return toast.error('Data ou hora inválida');

    setSalvando(true);
    try {
      const responsavelId = form.responsavel || usuario?.id;
      const total = form.recorrencia === 'none' ? 1 : Math.min(52, Math.max(2, Number(form.repeticoes) || 2));
      const datas = [inicio.toISOString()];
      for (let i = 1; i < total; i += 1) datas.push(proximaOcorrencia(datas[i - 1], form.recorrencia));
      const dadosEventos = datas.map(data => ({
        created_by_type: 'internal_user', organizer_id: usuario?.id, assigned_user_id: responsavelId,
        title: form.titulo.trim(), description: form.notas || undefined, start_at: data,
        end_at: new Date(new Date(data).getTime() + 60 * 60 * 1000).toISOString(), timezone: 'America/Sao_Paulo',
        status: 'scheduled', event_type: form.tipo, location: form.local || undefined,
        source_thread_id: contexto.threadId || undefined, participants_external: contexto.contactId ? [contexto.contactId] : [],
        contact_id: contexto.contactId, context_type: contexto.contextType, context_id: contexto.contextId, auto_committed: false
      }));
      const eventos = total === 1 ? [await base44.entities.ScheduleEvent.create(dadosEventos[0])] : await base44.entities.ScheduleEvent.bulkCreate(dadosEventos);
      const minutos = Number(form.antecedencia);
      if (minutos > 0) await base44.entities.ScheduleReminder.bulkCreate(eventos.map(evento => ({ event_id: evento.id, target_user_id: responsavelId, offset_minutes: minutos, send_at: new Date(new Date(evento.start_at).getTime() - minutos * 60000).toISOString(), channel: 'internal', status: 'pending', send_dedupe_key: `${evento.id}:${responsavelId}:${minutos}` })));
      await base44.entities.ScheduleActivityLog.bulkCreate(eventos.map(evento => ({ event_id: evento.id, acao: 'criada', usuario_id: usuario.id, data_em: new Date().toISOString(), origem: 'usuario', visible_user_ids: [responsavelId, usuario.id] })));
      toast.success(total === 1 ? 'Evento criado' : `${total} eventos criados`);
      window.dispatchEvent(new CustomEvent('nexus:agendamento-criado', { detail: eventos[0] }));
      onCriado?.(eventos[0]);
      onFechar?.();
      setForm(f => ({ ...f, titulo: '', local: '', notas: '', recorrencia: 'none', repeticoes: 1 }));
    } catch (e) {
      console.error('[AGENDAMENTO] erro ao criar:', e);
      toast.error('Não foi possível criar o agendamento');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-slate-900" />
            Novo evento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={form.titulo}
              onChange={e => alterar('titulo', e.target.value)}
              placeholder="Ex: Reunião com Pamplona Alimentos"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => alterar('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lembrete</Label>
              <Select value={form.antecedencia} onValueChange={v => alterar('antecedencia', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANTECEDENCIAS.map(a => <SelectItem key={a.valor} value={a.valor}>{a.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => alterar('data', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input type="time" value={form.hora} onChange={e => alterar('hora', e.target.value)} />
            </div>
          </div>

          <RecorrenciaCampos frequencia={form.recorrencia} repeticoes={form.repeticoes} onFrequencia={v => alterar('recorrencia', v)} onRepeticoes={v => alterar('repeticoes', v)} />

          {atendentes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={form.responsavel} onValueChange={v => alterar('responsavel', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {atendentes.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name || a.display_name || a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Local <span className="text-slate-400 font-normal">(opcional)</span></Label>
            <Input value={form.local} onChange={e => alterar('local', e.target.value)} placeholder="Escritório, Google Meet..." />
          </div>

          <div className="space-y-1.5">
            <Label>Notas <span className="text-slate-400 font-normal">(opcional)</span></Label>
            <Textarea rows={3} value={form.notas} onChange={e => alterar('notas', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="bg-slate-900 hover:bg-slate-800 text-white">
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
            Criar evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}