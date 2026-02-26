/**
 * Utilitário para cálculo da Curva ABC de Contatos
 * Fonte única de regras de qualificação ABC
 *
 * Regras:
 * - Score = soma dos peso_qualificacao das etiquetas aplicadas (pode ser negativo)
 * - A: score >= 70
 * - B: 30 <= score < 70
 * - C: score < 30
 * - none: contato sem nenhuma etiqueta que participa do ABC
 */

/**
 * Calcula o score e a classe ABC de um contato
 * @param {string[]} tags - array de slugs de etiquetas do contato (contact.tags)
 * @param {Object[]} etiquetasDB - lista de EtiquetaContato do banco
 * @returns {{ score: number, classe: 'A'|'B'|'C'|'none' }}
 */
export function calcularAbcContato(tags = [], etiquetasDB = []) {
  if (!tags || tags.length === 0) {
    return { score: 0, classe: 'none' };
  }

  const etiquetasAbc = etiquetasDB.filter(e => e.participa_abc === true);
  if (etiquetasAbc.length === 0) {
    return { score: 0, classe: 'none' };
  }

  let score = 0;
  let temEtiquetaAbc = false;

  for (const slug of tags) {
    const etq = etiquetasAbc.find(e => e.nome === slug);
    if (etq) {
      score += etq.peso_qualificacao ?? 0;
      temEtiquetaAbc = true;
    }
  }

  if (!temEtiquetaAbc) {
    return { score: 0, classe: 'none' };
  }

  const classe = score >= 70 ? 'A' : score >= 30 ? 'B' : 'C';

  return { score, classe };
}

/**
 * Retorna config visual do badge ABC
 */
export function getAbcBadgeConfig(classe) {
  switch (classe) {
    case 'A': return { label: 'A', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-100', description: 'Alto Valor' };
    case 'B': return { label: 'B', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-100', description: 'Médio Valor' };
    case 'C': return { label: 'C', color: 'bg-slate-400', textColor: 'text-slate-600', bgLight: 'bg-slate-100', description: 'Baixo Valor' };
    default:  return { label: '—', color: 'bg-slate-200', textColor: 'text-slate-400', bgLight: 'bg-slate-50', description: 'Sem classificação' };
  }
}