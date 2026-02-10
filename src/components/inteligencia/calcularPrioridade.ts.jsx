/**
 * Calcula prioridade científica baseada em scores de comportamento
 * Fórmula: 0.4*deal_risk + 0.25*(100-buy_intent) + 0.2*(100-engagement) + 0.15*min(days_stalled*5,15)
 * 
 * @param cliente - Objeto com scores e stage do ContactBehaviorAnalysis
 * @returns { prioridadeScore: number, prioridadeLabel: string }
 */

export interface ClienteAnalise {
  deal_risk?: number;
  buy_intent?: number;
  engagement?: number;
  health?: number;
  days_stalled?: number;
}

export interface PrioridadeResult {
  prioridadeScore: number;
  prioridadeLabel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';
}

export function calcularPrioridade(cliente: ClienteAnalise): PrioridadeResult {
  const dealRisk = cliente.deal_risk || 0;
  const buyIntent = cliente.buy_intent || 0;
  const engagement = cliente.engagement || 0;
  const daysStalled = cliente.days_stalled || 0;
  
  // Fórmula ponderada (total: 100 pontos)
  let score = 0;
  
  // 1. Risco de perda (40% do peso)
  score += dealRisk * 0.4;
  
  // 2. Intenção de compra invertida (25% do peso)
  // Menos intenção = maior urgência
  score += (100 - buyIntent) * 0.25;
  
  // 3. Engajamento invertido (20% do peso)
  // Menos engajamento = maior urgência
  score += (100 - engagement) * 0.2;
  
  // 4. Dias parado (15% do peso, cap em 15 pontos)
  // Cada dia parado = +5 pontos, máximo 15 (3 dias)
  score += Math.min(daysStalled * 5, 15) * 1;
  
  const prioridadeScore = Math.round(score);
  
  // Determinar label por thresholds
  let prioridadeLabel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';
  
  if (prioridadeScore >= 75) {
    prioridadeLabel = 'CRITICO';
  } else if (prioridadeScore >= 55) {
    prioridadeLabel = 'ALTO';
  } else if (prioridadeScore >= 35) {
    prioridadeLabel = 'MEDIO';
  } else {
    prioridadeLabel = 'BAIXO';
  }
  
  return { prioridadeScore, prioridadeLabel };
}

/**
 * Versão batch para calcular prioridades de múltiplos clientes
 */
export function calcularPrioridadeLote(clientes: ClienteAnalise[]): PrioridadeResult[] {
  return clientes.map(calcularPrioridade);
}

/**
 * Filtrar apenas urgentes (CRITICO ou ALTO)
 */
export function filtrarUrgentes(clientes: (ClienteAnalise & PrioridadeResult)[]): typeof clientes {
  return clientes.filter(c => c.prioridadeLabel === 'CRITICO' || c.prioridadeLabel === 'ALTO');
}

/**
 * Ordenar por prioridade (maior score primeiro)
 */
export function ordenarPorPrioridade(
  clientes: (ClienteAnalise & PrioridadeResult)[]
): typeof clientes {
  return [...clientes].sort((a, b) => b.prioridadeScore - a.prioridadeScore);
}