// Modelo unificado da Agenda — funções puras, sem React.
// Tarefas da IA (TarefaInteligente) e compromissos (ScheduleEvent) viram um único "item".

import { chavesIdentidade, isMinhaTarefa, PRIORIDADE_ORDEM } from './tarefaHelpers';

export { chavesIdentidade, isMinhaTarefa, PRIORIDADE_ORDEM };

const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function normalizarTarefa(t) {
  return {
    id: t.id,
    tipo: 'tarefa',
    titulo: (t.titulo || 'Tarefa').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Tarefa',
    contexto: t.cliente_nome || '',
    quando: t.data_prazo || null,
    prioridade: t.prioridade || 'media',
    responsavel: t.vendedor_responsavel || '',
    threadId: t.thread_id || null,
    motivo: t.contexto_ia?.motivo_criacao || '',
    sugestao: t.contexto_ia?.sugestoes_abordagem?.[0] || '',
    raw: t
  };
}

export function normalizarEvento(e) {
  return {
    id: e.id,
    tipo: 'evento',
    titulo: e.title || 'Compromisso',
    contexto: e.description || '',
    quando: e.start_at || null,
    prioridade: e.status === 'pending_review' ? 'alta' : 'media',
    responsavel: '',
    threadId: e.thread_id || null,
    precisaRevisao: e.status === 'pending_review',
    motivo: '',
    sugestao: '',
    raw: e
  };
}

/** Dias de diferença: negativo = futuro, 0 = hoje, positivo = atrasado. */
export function diasDeAtraso(item) {
  if (!item?.quando) return 0;
  return Math.round((inicioDoDia(new Date()) - inicioDoDia(item.quando)) / 86400000);
}

export function rotuloQuando(item) {
  if (!item?.quando) return 'Sem data';
  const d = diasDeAtraso(item);
  const hora = new Date(item.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d === 0) return `Hoje, ${hora}`;
  if (d === 1) return 'Ontem';
  if (d === -1) return `Amanhã, ${hora}`;
  if (d > 1) return `${d} dias em atraso`;
  return new Date(item.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function ordenar(itens) {
  return [...itens].sort((a, b) => {
    const dif = (PRIORIDADE_ORDEM[b.prioridade] || 0) - (PRIORIDADE_ORDEM[a.prioridade] || 0);
    if (dif !== 0) return dif;
    return new Date(a.quando || 0) - new Date(b.quando || 0);
  });
}

/**
 * Agrupa em faixas temporais. "Depois" absorve tudo além de 7 dias e o que não tem data —
 * é o backlog que fica recolhido para não competir com o que importa agora.
 */
export function agruparPorFaixa(itens) {
  const faixas = { atrasados: [], hoje: [], proximos: [], depois: [] };
  ordenar(itens).forEach(item => {
    const d = diasDeAtraso(item);
    if (!item.quando) faixas.depois.push(item);
    else if (d > 0) faixas.atrasados.push(item);
    else if (d === 0) faixas.hoje.push(item);
    else if (d >= -7) faixas.proximos.push(item);
    else faixas.depois.push(item);
  });
  return faixas;
}

export function resumo(itens) {
  return {
    total: itens.length,
    hoje: itens.filter(i => diasDeAtraso(i) === 0 && i.quando).length,
    atrasados: itens.filter(i => diasDeAtraso(i) > 0).length,
    criticos: itens.filter(i => i.prioridade === 'critica').length,
    compromissos: itens.filter(i => i.tipo === 'evento').length
  };
}