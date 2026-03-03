/**
 * CURVA ABC - ANÁLISE PARA CLIENTES E LEADS
 * 
 * ═══════════════════════════════════════════════════════════════
 * 
 * A CURVA ABC é uma técnica de classificação baseada na Regra de Pareto (80/20)
 * que ordena elementos por importância/valor.
 * 
 * ═══════════════════════════════════════════════════════════════
 * 
 * PARA CLIENTES (baseado em valor monetário):
 * ─────────────────────────────────────
 * 
 * Classe A (20% dos clientes = 80% da receita) - CRÍTICOS
 *   → Maior valor total gasto (ticket médio alto × frequência)
 *   → Maior receita recorrente mensal
 *   → Proporção: TOP 20% quando ordenados por valor_recorrente_mensal DESC
 *   → Ação: VIP, atenção personalizada, gerente dedicado, reviews periódicas
 * 
 * Classe B (30% dos clientes = 15% da receita) - IMPORTANTES
 *   → Valor médio (entre os top 20% e bottom 50%)
 *   → Potencial de crescimento
 *   → Proporção: do 21% ao 50%
 *   → Ação: Upsell, cross-sell, relacionamento regular
 * 
 * Classe C (50% dos clientes = 5% da receita) - BAIXO VALOR
 *   → Menor volume de compras
 *   → Proporção: do 51% ao 100%
 *   → Ação: Automação, auto-atendimento, reativação planejada
 * 
 * ═══════════════════════════════════════════════════════════════
 * 
 * PARA LEADS (baseado em score de qualificação):
 * ────────────────────────────────────────────
 * 
 * Classe A (20% dos leads = leads mais qualificados)
 *   → Score de qualificação: 70-100
 *   → Critérios BANT confirmados (Budget, Authority, Need, Timeline)
 *   → Engajamento alto (responded, opened, views)
 *   → Ação: Prioridade máxima, atribuir melhor vendedor, abordagem imediata
 * 
 * Classe B (30% dos leads = leads moderadamente qualificados)
 *   → Score de qualificação: 40-69
 *   → 1-2 critérios BANT parcialmente confirmados
 *   → Engajamento médio
 *   → Ação: Nurturing planejado, follow-ups, educação
 * 
 * Classe C (50% dos leads = leads pouco qualificados)
 *   → Score de qualificação: 0-39
 *   → Nenhum critério BANT confirmado
 *   → Engajamento baixo ou nenhum
 *   → Ação: Leads de base fria, campanhas automáticas, descarte após 90 dias
 * 
 * ═══════════════════════════════════════════════════════════════
 * 
 * CAMPOS PARA CÁLCULO:
 * 
 * CLIENTES:
 *   - valor_recorrente_mensal (priorário)
 *   - ticket_medio × frequencia_compra_30dias
 *   - status (Ativo = sim, Inativo = pesar menos)
 * 
 * LEADS:
 *   - score_qualificacao_lead (base)
 *   - engagement_score (comportamento)
 *   - dias_desde_primeiro_contato (recência)
 *   - resposta_taxa_ultima_semana (engajamento recente)
 * 
 * ═══════════════════════════════════════════════════════════════
 * 
 * EXEMPLO DE IMPLEMENTAÇÃO NO BD:
 * 
 * Cliente {
 *   ...
 *   valor_recorrente_mensal: 5000,     // Campo principal
 *   segmento: "A - Alto Potencial",    // Calculado
 * }
 * 
 * Lead {
 *   ...
 *   score_qualificacao_lead: 85,       // Campo principal
 *   classe_abc: "A",                    // Calculado (70-100 = A)
 *   temperatura: "quente"               // Derivado
 * }
 */

export function calcularClasseABC(registros, tipoCalculo = 'cliente') {
  if (!registros || registros.length === 0) return [];

  const registrosComScore = registros.map(r => {
    let score = 0;

    if (tipoCalculo === 'cliente') {
      // Para clientes: usar valor recorrente, ticket médio, etc
      score = r.valor_recorrente_mensal || (r.ticket_medio * r.frequencia_compra || 0);
      if (r.status !== 'Ativo') score *= 0.5; // Penalidade se inativo
    } else if (tipoCalculo === 'lead') {
      // Para leads: usar score de qualificação
      score = r.score_qualificacao_lead || 0;
    }

    return { ...r, _scoreABC: score };
  });

  // Ordenar por score DESC
  registrosComScore.sort((a, b) => b._scoreABC - a._scoreABC);

  const total = registrosComScore.length;
  const limiteA = Math.ceil(total * 0.2);  // 20% = A
  const limiteB = Math.ceil(total * 0.5);  // 30% = B (até 50%)
  // Resto = C (50%)

  return registrosComScore.map((r, idx) => ({
    ...r,
    classe_abc: idx < limiteA ? 'A' : (idx < limiteB ? 'B' : 'C'),
    posicao_abc: idx + 1,
    percentil: ((idx + 1) / total * 100).toFixed(1)
  }));
}

// Cores para visualização
export const CORES_ABC = {
  'A': '#ef4444', // Vermelho
  'B': '#f59e0b', // Âmbar
  'C': '#10b981'  // Verde
};

export const ICONES_ABC = {
  'A': '🔴',
  'B': '🟠',
  'C': '🟢'
};