import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { chavesIdentidade, isMinhaTarefa, normalizarTarefa, normalizarEvento, normalizarScheduleTask } from './agendaModel';
import { proximaOcorrencia } from './agendaTaskUtils';

const LEGADAS_ABERTAS = ['pendente', 'em_andamento', 'adiada'];
const TASK_STATUS = ['pendente', 'confirmada', 'em_andamento', 'aguardando_terceiro', 'adiada', 'vencida', 'concluida'];
const EVENT_STATUS = ['scheduled', 'pending_review', 'confirmed', 'completed'];
const hoje = valor => valor && new Date(valor).toDateString() === new Date().toDateString();

export default function useAgendaUnificada(usuario) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupadoId, setOcupadoId] = useState(null);
  const chaves = useMemo(() => chavesIdentidade(usuario), [usuario]);

  const carregar = useCallback(async () => {
    if (!usuario) return;
    setCarregando(true);
    try {
      const [novas, legadas, eventos] = await Promise.all([
        base44.entities.ScheduleTask.filter({ status: { $in: TASK_STATUS } }, 'prazo_em', 500).catch(() => []),
        base44.entities.TarefaInteligente.filter({ status: { $in: LEGADAS_ABERTAS } }, 'data_prazo', 300).catch(() => []),
        base44.entities.ScheduleEvent.filter({ status: { $in: EVENT_STATUS } }, 'start_at', 300).catch(() => [])
      ]);
      const novasVisiveis = novas.filter(t => t.status !== 'concluida' || hoje(t.concluido_em));
      const eventosVisiveis = eventos.filter(e => e.status !== 'completed' || hoje(e.completed_at));
      const legadasVisiveis = usuario.role === 'admin' ? legadas : legadas.filter(t => isMinhaTarefa(t, chaves, usuario.id));
      setItens([...novasVisiveis.map(normalizarScheduleTask), ...legadasVisiveis.map(normalizarTarefa), ...eventosVisiveis.map(normalizarEvento)]);
    } catch (e) { console.error('[AGENDA] erro ao carregar:', e); toast.error('Não foi possível carregar a agenda'); }
    finally { setCarregando(false); }
  }, [usuario, chaves]);

  useEffect(() => { carregar(); }, [carregar]);

  const logar = useCallback(async (item, acao, antes, depois) => {
    if (item.entidade === 'TarefaInteligente') return;
    await base44.entities.ScheduleActivityLog.create({ task_id: item.tipo === 'tarefa' ? item.id : undefined, event_id: item.tipo === 'evento' ? item.id : undefined, acao, usuario_id: usuario.id, data_em: new Date().toISOString(), dados_anteriores: antes, dados_novos: depois, origem: 'usuario', visible_user_ids: [item.responsavelId, usuario.id].filter(Boolean) });
  }, [usuario]);

  const aplicar = useCallback(async (item, dados, acao, mensagem, manter = false) => {
    setOcupadoId(item.id); const anterior = itens; if (!manter) setItens(prev => prev.filter(i => i.id !== item.id));
    try {
      const entidade = item.entidade === 'ScheduleTask' ? base44.entities.ScheduleTask : item.entidade === 'TarefaInteligente' ? base44.entities.TarefaInteligente : base44.entities.ScheduleEvent;
      await entidade.update(item.id, dados); await logar(item, acao, item.raw, dados); toast.success(mensagem); if (manter) await carregar();
    } catch (e) { console.error('[AGENDA] erro ao atualizar:', e); setItens(anterior); toast.error('Não foi possível atualizar'); throw e; }
    finally { setOcupadoId(null); }
  }, [itens, carregar, logar]);

  const iniciar = useCallback(item => aplicar(item, item.entidade === 'ScheduleTask'
    ? { status: 'em_andamento', iniciada_em: new Date().toISOString() }
    : { status: item.tipo === 'evento' ? 'confirmed' : 'em_andamento' },
    'iniciada', 'Atividade iniciada', true), [aplicar]);
  const aguardar = useCallback(item => aplicar(item, { status: 'aguardando_terceiro' }, 'aguardando_terceiro', 'Marcada como aguardando terceiro', true), [aplicar]);
  const concluir = useCallback(async item => {
    const dados = item.entidade === 'TarefaInteligente' ? { status: 'concluida', resultado_execucao: { sucesso: true, data_execucao: new Date().toISOString() } } : item.tipo === 'tarefa' ? { status: 'concluida', concluido_em: new Date().toISOString() } : { status: 'completed', completed_at: new Date().toISOString() };
    await aplicar(item, dados, 'concluida', 'Concluído', true);
    if (item.entidade === 'ScheduleTask' && item.raw.recorrencia_id) {
      const regra = await base44.entities.ScheduleRecurrence.get(item.raw.recorrencia_id);
      if (regra?.ativo) {
        const nextDue = proximaOcorrencia(item.raw.prazo_em, regra.frequencia);
        const nextTask = await base44.entities.ScheduleTask.create({
          titulo: item.raw.titulo,
          descricao: item.raw.descricao,
          status: 'pendente',
          prioridade: item.raw.prioridade,
          tipo_atividade: item.raw.tipo_atividade,
          origem: item.raw.origem,
          responsavel_id: item.raw.responsavel_id,
          setor_id: item.raw.setor_id,
          participantes_ids: item.raw.participantes_ids || [],
          prazo_em: nextDue,
          dia_inteiro: item.raw.dia_inteiro,
          recorrencia_id: item.raw.recorrencia_id,
          context_type: item.raw.context_type,
          context_id: item.raw.context_id,
          thread_id: item.raw.thread_id,
          contact_id: item.raw.contact_id
        });
        const reminders = await base44.entities.ScheduleReminder.filter({ task_id: item.id }, 'send_at', 20);
        if (reminders.length) await base44.entities.ScheduleReminder.bulkCreate(reminders.map(r => ({
          task_id: nextTask.id,
          target_user_id: nextTask.responsavel_id,
          offset_minutes: r.offset_minutes,
          send_at: new Date(new Date(nextDue).getTime() - (r.offset_minutes || 0) * 60000).toISOString(),
          channel: r.channel,
          send_dedupe_key: `${nextTask.id}:${nextTask.responsavel_id}:${r.offset_minutes || 0}`
        })));
      }
      await carregar();
    }
  }, [aplicar, carregar]);
  const cancelar = useCallback(item => aplicar(item, item.tipo === 'tarefa' ? { status: 'cancelada', cancelado_em: new Date().toISOString() } : { status: 'cancelled', cancelled_at: new Date().toISOString() }, 'cancelada', 'Cancelado'), [aplicar]);
  const adiar = useCallback((item, dias) => { const base = item.quando && new Date(item.quando) > new Date() ? new Date(item.quando) : new Date(); base.setDate(base.getDate() + dias); const campo = item.entidade === 'ScheduleTask' ? { status: 'adiada', adiado_de: item.quando, adiado_em: new Date().toISOString(), prazo_em: base.toISOString() } : item.entidade === 'TarefaInteligente' ? { status: 'adiada', data_prazo: base.toISOString() } : { start_at: base.toISOString() }; return aplicar(item, campo, 'reagendada', `Reagendado para ${base.toLocaleDateString('pt-BR')}`, true); }, [aplicar]);

  return { itens, carregando, ocupadoId, recarregar: carregar, iniciar, aguardar, concluir, cancelar, adiar };
}