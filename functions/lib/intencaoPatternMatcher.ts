// ═══════════════════════════════════════════════════════════════
// PATTERN MATCHER — Detecta intenções óbvias SEM chamar LLM
// Ganho: 50-60% redução de chamadas de IA
// ═══════════════════════════════════════════════════════════════

const PATTERNS = {
  // Vendas / Orçamento
  vendas: {
    regex: /orcamento|orçamento|cotacao|cotação|preco|preço|quanto custa|tabela|produto|comprar|vender/i,
    setor: 'vendas',
    confidence: 0.95
  },
  
  // Financeiro
  financeiro: {
    regex: /boleto|fatura|nota fiscal|nf|pagamento|cobranca|cobrança|vencimento|atrasado|dinheiro|pagou|pagar/i,
    setor: 'financeiro',
    confidence: 0.95
  },
  
  // Suporte / Assistência
  assistencia: {
    regex: /defeito|quebrou|nao funciona|não funciona|conserto|reparo|problema|bug|erro|nao liga|não liga|travado|lento/i,
    setor: 'assistencia',
    confidence: 0.95
  },
  
  // Fornecedor
  fornecedor: {
    regex: /fornecedor|fornecimento|compras|pedido|cotacao|cotação|estoque|entrega/i,
    setor: 'fornecedor',
    confidence: 0.9
  }
};

/**
 * Detecta intenção por padrão regex (sem chamar LLM)
 * @param {string} texto - Mensagem do cliente
 * @returns {Object|null} {setor, confidence} ou null
 */
function detectarPorPattern(texto) {
  if (!texto || typeof texto !== 'string') return null;
  
  const textoLower = texto.toLowerCase().trim();
  
  for (const [chave, pattern] of Object.entries(PATTERNS)) {
    if (pattern.regex.test(textoLower)) {
      return {
        setor: pattern.setor,
        confidence: pattern.confidence,
        metodo: 'pattern_match',
        pattern: chave
      };
    }
  }
  
  return null;
}

/**
 * Normaliza texto para melhor comparação
 * @param {string} texto
 * @returns {string}
 */
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

export { detectarPorPattern, normalizarTexto, PATTERNS };