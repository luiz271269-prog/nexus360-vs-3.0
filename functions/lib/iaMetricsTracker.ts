/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  IA METRICS TRACKER                                            ║
 * ║  Rastreador automático de uso e custo de IA                   ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export async function trackIAUsage(base44, config) {
  const {
    funcao,
    modelo_usado = 'gpt-4o-mini',
    prompt,
    resposta,
    tokens_prompt,
    tokens_completion,
    tempo_resposta_ms,
    sucesso = true,
    erro = null,
    contexto = {}
  } = config;

  try {
    const tokens_total = (tokens_prompt || 0) + (tokens_completion || 0);
    
    // Calcular custo baseado no modelo
    const custo = calcularCusto(modelo_usado, tokens_prompt, tokens_completion);

    await base44.asServiceRole.entities.IAUsageMetric.create({
      timestamp: new Date().toISOString(),
      funcao,
      modelo_usado,
      tokens_prompt,
      tokens_completion,
      tokens_total,
      custo_estimado_usd: custo,
      tempo_resposta_ms,
      sucesso,
      erro,
      contexto,
      prompt_resumo: prompt ? prompt.substring(0, 200) : null,
      resposta_resumo: resposta ? (typeof resposta === 'string' ? resposta.substring(0, 200) : JSON.stringify(resposta).substring(0, 200)) : null
    });

    console.log(`[IA METRICS] 📊 Registrado: ${funcao} | ${tokens_total} tokens | $${custo.toFixed(4)}`);
  } catch (error) {
    console.error('[IA METRICS] Erro ao registrar métrica:', error);
  }
}

function calcularCusto(modelo, tokensPrompt, tokensCompletion) {
  // Preços por 1M tokens (atualizar conforme OpenAI)
  const precos = {
    'gpt-4o': {
      prompt: 5.00 / 1000000,
      completion: 15.00 / 1000000
    },
    'gpt-4o-mini': {
      prompt: 0.150 / 1000000,
      completion: 0.600 / 1000000
    },
    'gpt-4-turbo': {
      prompt: 10.00 / 1000000,
      completion: 30.00 / 1000000
    },
    'gpt-3.5-turbo': {
      prompt: 0.500 / 1000000,
      completion: 1.500 / 1000000
    }
  };

  const preco = precos[modelo] || precos['gpt-4o-mini'];
  
  const custoPrompt = (tokensPrompt || 0) * preco.prompt;
  const custoCompletion = (tokensCompletion || 0) * preco.completion;

  return custoPrompt + custoCompletion;
}

export function estimarTokens(texto) {
  // Estimativa aproximada: 1 token ≈ 4 caracteres
  if (!texto) return 0;
  return Math.ceil(texto.length / 4);
}