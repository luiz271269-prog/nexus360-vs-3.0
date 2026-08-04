import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const inicial = () => {
  const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
  return { titulo: '', descricao: '', tipo: 'tarefa', prioridade: 'media', data: d.toISOString().slice(0, 10), hora: d.toTimeString().slice(0, 5), semHorario: false, responsavel: '', recorrencia: 'none', repeticoes: 1, lembrete: '60' };
};

export default function useNovaTarefa(aberto, contexto, onCriado, onFechar) {
  const [form, setForm] = useState(inicial);
  const [usuario, setUsuario] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    base44.auth.me().then(async u => {
      setUsuario(u);
      setForm(f => ({ ...f, responsavel: contexto.responsavelId || f.responsavel || u.id, titulo: contexto.titulo || f.titulo, descricao: contexto.descricao || f.descricao }));
      const resposta = await base44.functions.invoke('listarUsuariosParaAtribuicao', {}).catch(() => null);
      const lista = resposta?.data?.usuarios || [];
      setUsuarios(lista.length ? lista : [u]);
    });
  }, [aberto, contexto.titulo, contexto.descricao, contexto.responsavelId]);
  const alterar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));
  const salvar = async () => {
    if (!form.titulo.trim()) return toast.error('Informe o título');
    const prazo = new Date(`${form.data}T${form.semHorario ? '12:00' : form.hora}:00`);
    if (isNaN(prazo.getTime())) return toast.error('Informe data e hora válidas');
    setSalvando(true);
    try {
      let recurrenceId;
      if (form.recorrencia !== 'none') recurrenceId = (await base44.entities.ScheduleRecurrence.create({ frequencia: form.recorrencia, intervalo: 1, inicio_em: prazo.toISOString(), quantidade_ocorrencias: Number(form.repeticoes) || 2, timezone: 'America/Sao_Paulo' })).id;
      const responsavel = form.responsavel || usuario.id;
      const task = await base44.entities.ScheduleTask.create({ titulo: form.titulo.trim(), descricao: form.descricao || undefined, tipo_atividade: form.tipo, prioridade: form.prioridade, responsavel_id: responsavel, prazo_em: prazo.toISOString(), dia_inteiro: form.semHorario, recorrencia_id: recurrenceId, origem: contexto.threadId ? 'conversa' : 'manual', context_type: contexto.contextType || (contexto.threadId ? 'MessageThread' : undefined), context_id: contexto.contextId || contexto.threadId, thread_id: contexto.threadId, contact_id: contexto.contactId, cliente_id: contexto.clienteId, orcamento_id: contexto.orcamentoId });
      await base44.entities.ScheduleActivityLog.create({ task_id: task.id, acao: 'criada', usuario_id: usuario.id, data_em: new Date().toISOString(), origem: 'usuario', visible_user_ids: [responsavel, usuario.id] });
      const minutos = Number(form.lembrete);
      if (minutos > 0) await base44.entities.ScheduleReminder.create({ task_id: task.id, target_user_id: responsavel, offset_minutes: minutos, send_at: new Date(prazo.getTime() - minutos * 60000).toISOString(), channel: 'app', send_dedupe_key: `${task.id}:${responsavel}:${minutos}` });
      toast.success('Tarefa criada'); window.dispatchEvent(new CustomEvent('nexus:agendamento-criado', { detail: task })); onCriado?.(task); onFechar?.(); setForm(inicial());
    } catch (e) { console.error('[NOVA TAREFA]', e); toast.error('Não foi possível criar a tarefa'); }
    finally { setSalvando(false); }
  };
  return { form, alterar, usuario, usuarios, salvando, salvar };
}