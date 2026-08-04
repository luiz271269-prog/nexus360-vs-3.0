export const TASK_TYPES = [
  ['tarefa', 'Tarefa'], ['follow_up', 'Follow-up'], ['ligacao', 'Ligação'],
  ['visita', 'Visita'], ['cobranca', 'Cobrança'], ['orcamento', 'Orçamento'],
  ['atendimento', 'Atendimento'], ['documento', 'Documento'], ['atividade_interna', 'Atividade interna']
];

export const PRIORITIES = [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta'], ['critica', 'Crítica']];
export const RECURRENCES = [['none', 'Não repetir'], ['diaria', 'Diariamente'], ['dias_uteis', 'Dias úteis'], ['semanal', 'Semanalmente'], ['mensal', 'Mensalmente']];
export const REMINDERS = [['0', 'Sem lembrete'], ['15', '15 min antes'], ['60', '1 hora antes'], ['1440', '1 dia antes']];

export function proximaOcorrencia(data, frequencia) {
  const proxima = new Date(data);
  if (frequencia === 'diaria') proxima.setDate(proxima.getDate() + 1);
  if (frequencia === 'dias_uteis') {
    do proxima.setDate(proxima.getDate() + 1); while ([0, 6].includes(proxima.getDay()));
  }
  if (frequencia === 'semanal') proxima.setDate(proxima.getDate() + 7);
  if (frequencia === 'mensal') proxima.setMonth(proxima.getMonth() + 1);
  return proxima.toISOString();
}