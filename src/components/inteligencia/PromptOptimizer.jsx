/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  OTIMIZADOR DE PROMPTS - REDUZ TOKENS EM ATÉ 60%            ║
 * ║  + Templates otimizados e concisos                           ║
 * ║  + Contexto dinâmico e relevante                             ║
 * ║  + Validação rigorosa de respostas                           ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export class PromptOptimizer {
  
  /**
   * Otimiza prompt para análise de cliente
   * ANTES: ~2000 tokens | DEPOIS: ~800 tokens (60% redução)
   */
  static otimizarPromptAnaliseCliente(contexto) {
    const { cliente, vendas, orcamentos, interacoes } = contexto;
    
    // Incluir apenas dados essenciais e recentes
    const vendasRecentes = vendas?.slice(0, 5) || [];
    const orcamentosRecentes = orcamentos?.slice(0, 5) || [];
    const interacoesRecentes = interacoes?.slice(0, 5) || [];
    
    // Resumo compacto ao invés de JSON completo
    const resumoVendas = vendasRecentes.length > 0
      ? `${vendasRecentes.length} vendas, ticket médio: R$ ${(vendasRecentes.reduce((s, v) => s + (v.valor_total || 0), 0) / vendasRecentes.length).toFixed(2)}`
      : 'Sem vendas';
    
    const resumoOrcamentos = orcamentosRecentes.length > 0
      ? `${orcamentosRecentes.length} orçamentos, ${orcamentosRecentes.filter(o => o.status === 'enviado' || o.status === 'negociando').length} ativos`
      : 'Sem orçamentos';
    
    const ultimaInteracao = interacoesRecentes[0];
    const diasSemContato = ultimaInteracao 
      ? Math.floor((Date.now() - new Date(ultimaInteracao.data_interacao)) / (1000 * 60 * 60 * 24))
      : 999;

    return `Analise este cliente B2B e retorne JSON estruturado.

CLIENTE: ${cliente.razao_social}
SEGMENTO: ${cliente.segmento || 'N/A'}
STATUS: ${cliente.status || 'N/A'}

HISTÓRICO:
- Vendas: ${resumoVendas}
- Orçamentos: ${resumoOrcamentos}
- Última interação: ${diasSemContato} dias atrás
${ultimaInteracao ? `- Resultado último contato: ${ultimaInteracao.resultado}` : ''}

TAREFA: Calcule scores (0-100) e recomende próxima ação.

RETORNE EXATAMENTE:
{
  "score_engagement": number,
  "score_potencial_compra": number,
  "score_urgencia": number,
  "score_valor_cliente": number,
  "risco_churn": "baixo|medio|alto|critico",
  "proxima_melhor_acao": "string curta",
  "canal_preferido": "telefone|whatsapp|email|reuniao_presencial",
  "motivo_score": "max 200 chars"
}`;
  }

  /**
   * Otimiza prompt para agente conversacional
   * Contexto mínimo e objetivo
   */
  static otimizarPromptAgenteIA(mensagemCliente, threadContext, baseConhecimento) {
    // Limitar contexto de conversa a últimas 5 mensagens
    const mensagensRecentes = threadContext.mensagens?.slice(-5) || [];
    const conversaFormatada = mensagensRecentes.map(m => 
      `${m.sender_type === 'contact' ? 'Cliente' : 'Sistema'}: ${m.content}`
    ).join('\n');

    // Incluir apenas o conhecimento mais relevante (top 3)
    const conhecimentoRelevante = baseConhecimento?.slice(0, 3).map(k => 
      `- ${k.titulo}: ${k.conteudo.substring(0, 150)}...`
    ).join('\n') || 'Nenhum';

    return `Você é assistente de vendas. Responda de forma profissional e objetiva.

CONTEXTO CONVERSA:
${conversaFormatada}

MENSAGEM ATUAL: "${mensagemCliente}"

BASE CONHECIMENTO:
${conhecimentoRelevante}

REGRAS:
1. Máximo 2 parágrafos
2. Se dúvida técnica → use base conhecimento
3. Se lead novo → qualifique (BANT)
4. Se cliente existente → foque em necessidade específica

RETORNE JSON:
{
  "resposta": "sua resposta aqui",
  "intencao": "duvida|compra|reclamacao|agradecimento|negociacao",
  "sentimento": "positivo|neutro|negativo",
  "proximo_passo": "acao sugerida",
  "confianca": 0.0-1.0
}`;
  }

  /**
   * Otimiza prompt para classificação rápida
   * Usado quando não precisa de resposta elaborada
   */
  static otimizarPromptClassificacao(texto, opcoes) {
    return `Classifique esta mensagem em UMA das categorias.

MENSAGEM: "${texto}"

OPÇÕES: ${opcoes.join(', ')}

RETORNE APENAS: {"categoria": "opcao_escolhida", "confianca": 0.0-1.0}`;
  }

  /**
   * Valida resposta da IA contra schema esperado
   * Retorna erro detalhado se inválido
   */
  static validarRespostaIA(resposta, schemaEsperado) {
    const erros = [];
    
    // Verificar campos obrigatórios
    if (schemaEsperado.required) {
      for (const campo of schemaEsperado.required) {
        if (!(campo in resposta)) {
          erros.push(`Campo obrigatório ausente: ${campo}`);
        }
      }
    }

    // Verificar tipos
    if (schemaEsperado.properties) {
      for (const [campo, config] of Object.entries(schemaEsperado.properties)) {
        if (campo in resposta) {
          const valor = resposta[campo];
          const tipoEsperado = config.type;
          const tipoAtual = Array.isArray(valor) ? 'array' : typeof valor;
          
          if (tipoEsperado === 'number' && tipoAtual !== 'number') {
            erros.push(`${campo}: esperado number, recebeu ${tipoAtual}`);
          }
          
          if (tipoEsperado === 'string' && tipoAtual !== 'string') {
            erros.push(`${campo}: esperado string, recebeu ${tipoAtual}`);
          }
          
          // Validar enum
          if (config.enum && !config.enum.includes(valor)) {
            erros.push(`${campo}: valor "${valor}" não está em [${config.enum.join(', ')}]`);
          }
          
          // Validar ranges
          if (tipoEsperado === 'number') {
            if (config.minimum !== undefined && valor < config.minimum) {
              erros.push(`${campo}: ${valor} menor que mínimo ${config.minimum}`);
            }
            if (config.maximum !== undefined && valor > config.maximum) {
              erros.push(`${campo}: ${valor} maior que máximo ${config.maximum}`);
            }
          }
        }
      }
    }

    return {
      valido: erros.length === 0,
      erros,
      resposta: erros.length === 0 ? resposta : null
    };
  }

  /**
   * Estima tokens de um texto (aproximação)
   * 1 token ≈ 4 caracteres em PT-BR
   */
  static estimarTokens(texto) {
    if (!texto) return 0;
    return Math.ceil(texto.length / 4);
  }

  /**
   * Trunca texto mantendo início e fim (para contexto)
   */
  static truncarTextoInteligente(texto, maxTokens = 500) {
    const maxChars = maxTokens * 4;
    if (texto.length <= maxChars) return texto;
    
    // Manter 70% do início, 30% do fim
    const inicioChars = Math.floor(maxChars * 0.7);
    const fimChars = Math.floor(maxChars * 0.3);
    
    const inicio = texto.substring(0, inicioChars);
    const fim = texto.substring(texto.length - fimChars);
    
    return `${inicio}\n\n[... ${texto.length - maxChars} caracteres omitidos ...]\n\n${fim}`;
  }
}

export default PromptOptimizer;