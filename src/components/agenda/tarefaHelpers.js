// Helpers puros da Agenda de Tarefas — sem React, testáveis isoladamente.

export const PRIORIDADE_ORDEM = { critica: 4, alta: 3, media: 2, baixa: 1 };

/**
 * Chaves de identidade que podem estar gravadas em TarefaInteligente.vendedor_responsavel.
 * O campo é uma STRING livre no schema — na base real ele guarda o full_name
 * (ex: "vendas1"), mas também pode conter e-mail ou o prefixo do e-mail.
 */
export function chavesIdentidade(usuario) {
  if (!usuario) return [];
  const chaves = new Set();
  if (usuario.full_name) chaves.add(usuario.full_name);
  if (usuario.email) {
    chaves.add(usuario.email);
    chaves.add(usuario.email.split('@')[0]);
  }
  return [...chaves];
}

export function isMinhaTarefa(tarefa, chaves, usuarioId) {
  if (tarefa?.contexto_ia?.atendente_user_id === usuarioId) return true;
  return chaves.includes(tarefa?.vendedor_responsavel);
}

const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Dias de atraso em relação ao prazo (negativo = ainda no prazo). */
export function diasDeAtraso(tarefa) {
  if (!tarefa?.data_prazo) return 0;
  const hoje = inicioDoDia(new Date());
  const prazo = inicioDoDia(tarefa.data_prazo);
  return Math.round((hoje - prazo) / 86400000);
}

export function rotuloPrazo(tarefa) {
  if (!tarefa?.data_prazo) return 'Sem prazo';
  const d = diasDeAtraso(tarefa);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Ontem';
  if (d === -1) return 'Amanhã';
  if (d > 1) return `${d} dias atrasada`;
  return `Em ${Math.abs(d)} dias`;
}

/** Ordena por prioridade e, dentro dela, pelo prazo mais antigo. */
export function ordenarPorUrgencia(tarefas) {
  return [...tarefas].sort((a, b) => {
    const dif = (PRIORIDADE_ORDEM[b.prioridade] || 0) - (PRIORIDADE_ORDEM[a.prioridade] || 0);
    if (dif !== 0) return dif;
    return new Date(a.data_prazo || 0) - new Date(b.data_prazo || 0);
  });
}

/**
 * Separa o que exige ação AGORA do resto.
 * "Hoje" = críticas + vencidas/vencendo hoje, limitado a `limite` itens.
 * Princípio de mercado (Todoist/Linear): uma lista de hoje longa demais é ignorada.
 */
export function separarHojeEBacklog(tarefas, limite = 10) {
  const ordenadas = ordenarPorUrgencia(tarefas);
  const urgentes = ordenadas.filter(t => t.prioridade === 'critica' || diasDeAtraso(t) >= 0);
  const hoje = urgentes.slice(0, limite);
  const idsHoje = new Set(hoje.map(t => t.id));
  return { hoje, backlog: ordenadas.filter(t => !idsHoje.has(t.id)) };
}