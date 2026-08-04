import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { chavesIdentidade, isMinhaTarefa, normalizarTarefa, normalizarEvento } from './agendaModel';

const TAREFAS_ABERTAS = ['pendente', 'em_andamento', 'adiada'];
const EVENTOS_ABERTOS = ['scheduled', 'pending_review'];

/**
 * Fonte única da Agenda: tarefas da IA + compromissos agendados, normalizados
 * em um só stream. Admin vê a fila inteira; atendente vê apenas o que é seu.
 */
export default function useAgendaUnificada(usuario) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupadoId, setOcupadoId] = useState(null);

  const chaves = useMemo(() => chavesIdentidade(usuario), [usuario]);

  const carregar = useCallback(async () => {
    if (!usuario) return;
    setCarregando(true);
    try {
      const [tarefas, eventos] = await Promise.all([
        base44.entities.TarefaInteligente.filter(
          { status: { $in: TAREFAS_ABERTAS } }, 'data_prazo', 300
        ).catch(() => []),
        base44.entities.ScheduleEvent.filter(
          { assigned_user_id: usuario.id, status: { $in: EVENTOS_ABERTOS } }, 'start_at', 100
        ).catch(() => [])
      ]);

      const minhasTarefas = usuario.role === 'admin'
        ? tarefas
        : tarefas.filter(t => isMinhaTarefa(t, chaves, usuario.id));

      setItens([
        ...minhasTarefas.map(normalizarTarefa),
        ...eventos.map(normalizarEvento)
      ]);
    } catch (e) {
      console.error('[AGENDA] erro ao carregar:', e);
      toast.error('Não foi possível carregar a agenda');
    } finally {
      setCarregando(false);
    }
  }, [usuario, chaves]);

  useEffect(() => { carregar(); }, [carregar]);

  const aplicar = useCallback(async (item, dados, mensagem, manter = false) => {
    setOcupadoId(item.id);
    const anterior = itens;
    if (!manter) setItens(prev => prev.filter(i => i.id !== item.id));
    try {
      const entidade = item.tipo === 'tarefa'
        ? base44.entities.TarefaInteligente
        : base44.entities.ScheduleEvent;
      await entidade.update(item.id, dados);
      toast.success(mensagem);
      if (manter) await carregar();
    } catch (e) {
      console.error('[AGENDA] erro ao atualizar:', e);
      setItens(anterior);
      toast.error('Não foi possível atualizar');
    } finally {
      setOcupadoId(null);
    }
  }, [itens, carregar]);

  const concluir = useCallback((item) => aplicar(item, item.tipo === 'tarefa'
    ? { status: 'concluida', resultado_execucao: { sucesso: true, resultado: 'conversao', data_execucao: new Date().toISOString() } }
    : { status: 'completed', completed_at: new Date().toISOString() },
    'Concluído'), [aplicar]);

  const cancelar = useCallback((item) => aplicar(item, item.tipo === 'tarefa'
    ? { status: 'cancelada' }
    : { status: 'cancelled', cancelled_at: new Date().toISOString() },
    'Removido da agenda'), [aplicar]);

  const adiar = useCallback((item, dias) => {
    const base = item.quando && new Date(item.quando) > new Date() ? new Date(item.quando) : new Date();
    base.setDate(base.getDate() + dias);
    const rotulo = base.toLocaleDateString('pt-BR');
    return aplicar(item, item.tipo === 'tarefa'
      ? { status: 'adiada', data_prazo: base.toISOString() }
      : { start_at: base.toISOString() },
      `Reagendado para ${rotulo}`, true);
  }, [aplicar]);

  return { itens, carregando, ocupadoId, recarregar: carregar, concluir, cancelar, adiar };
}