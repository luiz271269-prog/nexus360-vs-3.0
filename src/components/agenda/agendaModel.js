import { chavesIdentidade, isMinhaTarefa, PRIORIDADE_ORDEM } from './tarefaHelpers';

export { chavesIdentidade, isMinhaTarefa, PRIORIDADE_ORDEM };
const inicioDoDia = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const limparTitulo = titulo => (titulo || 'Tarefa').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Tarefa';

export const normalizarScheduleTask = t => ({ id: t.id, tipo: 'tarefa', entidade: 'ScheduleTask', titulo: limparTitulo(t.titulo), contexto: t.descricao || '', quando: t.prazo_em || null, semHorario: Boolean(t.dia_inteiro), prioridade: t.prioridade || 'media', status: t.status, responsavelId: t.responsavel_id, threadId: t.thread_id || null, raw: t });
export const normalizarTarefa = t => ({ id: t.id, tipo: 'tarefa', entidade: 'TarefaInteligente', titulo: limparTitulo(t.titulo), contexto: t.cliente_nome || '', quando: t.data_prazo || null, prioridade: t.prioridade || 'media', status: t.status, responsavel: t.vendedor_responsavel || '', threadId: t.thread_id || null, raw: t });
export const normalizarEvento = e => ({ id: e.id, tipo: 'evento', entidade: 'ScheduleEvent', titulo: e.title || 'Compromisso', contexto: e.description || '', quando: e.start_at || null, prioridade: e.status === 'pending_review' ? 'alta' : 'media', status: e.status, responsavelId: e.assigned_user_id, threadId: e.source_thread_id || null, raw: e });

export function diasDeAtraso(item) {
  if (!item?.quando) return 0;
  return Math.round((inicioDoDia(new Date()) - inicioDoDia(item.quando)) / 86400000);
}

// Urgência visual: item não concluído que vence nas próximas 24h ou já venceu
export function nivelUrgencia(item) {
  if (!item?.quando || ['concluida', 'completed', 'cancelada', 'cancelled'].includes(item.status)) return null;
  const restanteMs = new Date(item.quando).getTime() - Date.now();
  if (restanteMs < 0) return 'atrasado';
  if (restanteMs <= 24 * 3600 * 1000) return 'urgente';
  return null;
}

export function rotuloQuando(item) {
  if (!item?.quando) return 'Sem horário';
  if (item.semHorario) return new Date(item.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const d = diasDeAtraso(item);
  const hora = new Date(item.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d === 0) return `Hoje, ${hora}`;
  if (d === 1) return 'Ontem';
  if (d === -1) return `Amanhã, ${hora}`;
  if (d > 1) return `${d} dias em atraso`;
  return new Date(item.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export const ordenar = itens => [...itens].sort((a, b) => ((PRIORIDADE_ORDEM[b.prioridade] || 0) - (PRIORIDADE_ORDEM[a.prioridade] || 0)) || (new Date(a.quando || 0) - new Date(b.quando || 0)));
const concluida = i => ['concluida', 'completed'].includes(i.status);

export function agruparPorFaixa(itens) {
  const faixas = { atrasados: [], hoje: [], proximos: [], semHorario: [], concluidas: [] };
  ordenar(itens).forEach(item => {
    const d = diasDeAtraso(item);
    if (concluida(item)) faixas.concluidas.push(item);
    else if (!item.quando || item.semHorario) faixas.semHorario.push(item);
    else if (d > 0) faixas.atrasados.push(item);
    else if (d === 0) faixas.hoje.push(item);
    else faixas.proximos.push(item);
  });
  return faixas;
}

export function resumo(itens) {
  return {
    hoje: itens.filter(i => !concluida(i) && diasDeAtraso(i) === 0 && i.quando).length,
    atrasados: itens.filter(i => !concluida(i) && diasDeAtraso(i) > 0).length,
    compromissos: itens.filter(i => i.tipo === 'evento' && !concluida(i)).length,
    aguardando: itens.filter(i => i.status === 'aguardando_terceiro').length,
    concluidas: itens.filter(concluida).length
  };
}