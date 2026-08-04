export const CATEGORIAS = [
  ['solicitacao', 'Solicitação'],
  ['tarefa', 'Tarefa'],
  ['agendamento', 'Agendamento'],
  ['lembrete', 'Lembrete'],
  ['retorno', 'Retorno']
];

export const FLUXOS = {
  solicitacao: { etapas: [['nova', 'Nova'], ['triagem', 'Triagem'], ['aguardando_informacoes', 'Aguardando informações'], ['em_analise', 'Em análise']], finais: [['resolvida', 'Resolvida'], ['convertida', 'Convertida em tarefa']] },
  tarefa: { etapas: [['pendente', 'Pendente'], ['aceita', 'Aceita'], ['em_andamento', 'Em andamento'], ['aguardando_terceiro', 'Aguardando terceiro'], ['revisao', 'Revisão']], finais: [['concluida', 'Concluída']] },
  agendamento: { etapas: [['proposto', 'Proposto'], ['confirmado', 'Confirmado']], finais: [['realizado', 'Realizado'], ['nao_compareceu', 'Não compareceu'], ['cancelado', 'Cancelado']] },
  lembrete: { etapas: [['pendente', 'Pendente'], ['disparado', 'Disparado']], finais: [['confirmado', 'Confirmado'], ['adiado', 'Adiado'], ['ignorado', 'Ignorado']] },
  retorno: { etapas: [['planejado', 'Planejado'], ['tentativa_realizada', 'Tentativa realizada'], ['aguardando_resposta', 'Aguardando resposta'], ['respondido', 'Respondido']], finais: [['proximo_passo', 'Próximo passo'], ['concluido', 'Concluído']] }
};

export const ESPERA = ['aguardando_informacoes', 'aguardando_terceiro', 'aguardando_resposta'];

export const rotuloCategoria = c => (CATEGORIAS.find(([v]) => v === c) || CATEGORIAS[1])[1];

export function etapasDaCategoria(categoria) {
  const fluxo = FLUXOS[categoria] || FLUXOS.tarefa;
  return [...fluxo.etapas, ...fluxo.finais];
}

export function rotuloEtapa(categoria, etapa) {
  const par = etapasDaCategoria(categoria).find(([v]) => v === etapa);
  return par ? par[1] : etapaInicial(categoria) === etapa ? etapa : '—';
}

export const etapaInicial = categoria => (FLUXOS[categoria] || FLUXOS.tarefa).etapas[0][0];

export function proximaEtapa(categoria, etapa) {
  const fluxo = FLUXOS[categoria] || FLUXOS.tarefa;
  const i = fluxo.etapas.findIndex(([v]) => v === etapa);
  if (i === -1 || i === fluxo.etapas.length - 1) return null;
  return fluxo.etapas[i + 1];
}

export const etapasFinais = categoria => (FLUXOS[categoria] || FLUXOS.tarefa).finais;

/** Sugere a categoria a partir da origem/contexto — o usuário pode trocar. */
export function sugerirCategoria(contexto = {}) {
  const { contextType, threadId, statusOrigem, categoriaSugerida } = contexto;
  if (categoriaSugerida && FLUXOS[categoriaSugerida]) return categoriaSugerida;
  if (contextType === 'Orcamento') return ['enviado', 'negociando', 'aprovado'].includes(statusOrigem) ? 'retorno' : 'tarefa';
  if (['Cliente', 'Contact'].includes(contextType)) return 'retorno';
  if (threadId || ['MessageThread', 'Message'].includes(contextType)) return 'solicitacao';
  return 'tarefa';
}

export function categoriaDoItem(item) {
  const bruta = item?.raw?.categoria;
  if (bruta && FLUXOS[bruta]) return bruta;
  return item?.tipo === 'evento' ? 'agendamento' : 'tarefa';
}

export function etapaDoItem(item) {
  return item?.raw?.etapa || etapaInicial(categoriaDoItem(item));
}