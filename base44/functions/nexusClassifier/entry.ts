import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  NEXUS CLASSIFIER - Backend Version                           ║
 * ║  Classificação de intenção e RAG para uso em playbooks        ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { action, ...params } = payload;

    console.log('[NEXUS CLASSIFIER] 🎯 Action:', action);

    switch (action) {
      case 'classify_intention':
        return Response.json(await classifyIntention(base44, params), { headers });
      
      case 'query_rag':
        return Response.json(await queryRAG(base44, params), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[NEXUS CLASSIFIER] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

async function classifyIntention(base44, params) {
  const { mensagem, contexto = {} } = params;
  
  console.log('[NEXUS CLASSIFIER] 🔍 Classificando:', mensagem.substring(0, 50));

  try {
    // Construir prompt para classificação
    const prompt = `
Você é um classificador de intenções para um sistema de atendimento automatizado.

Mensagem do cliente: "${mensagem}"

Contexto adicional:
${JSON.stringify(contexto, null, 2)}

Classifique a INTENÇÃO da mensagem em uma das categorias:
- vendas (cliente quer comprar, pedir orçamento, saber preços)
- suporte (cliente tem problema técnico, precisa de assistência)
- financeiro (dúvidas sobre pagamento, boleto, nota fiscal)
- informacao (horário, endereço, informações gerais)
- outro (não se encaixa nas anteriores)

Retorne um JSON com:
{
  "intent": "categoria",
  "confidence": 0.0-1.0,
  "reasoning": "explicação breve",
  "entities": {
    "produto": "nome do produto mencionado (se houver)",
    "valor": "valor mencionado (se houver)",
    "urgencia": "alta|media|baixa"
  }
}
`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          intent: { type: "string" },
          confidence: { type: "number" },
          reasoning: { type: "string" },
          entities: { type: "object" }
        }
      }
    });

    console.log('[NEXUS CLASSIFIER] ✅ Intent:', response.intent, `(${Math.round(response.confidence * 100)}%)`);

    return {
      success: true,
      intent: response.intent,
      confidence: response.confidence,
      entities: response.entities,
      reasoning: response.reasoning
    };

  } catch (error) {
    console.error('[NEXUS CLASSIFIER] ❌ Erro na classificação:', error);
    
    // Fallback: classificação por palavras-chave
    return classifyByKeywords(mensagem);
  }
}

function classifyByKeywords(mensagem) {
  const msg = mensagem.toLowerCase();
  
  const keywords = {
    vendas: ['comprar', 'preço', 'quanto custa', 'orçamento', 'produto'],
    suporte: ['problema', 'não funciona', 'defeito', 'assistência', 'conserto'],
    financeiro: ['boleto', 'pagamento', 'nota fiscal', 'fatura', 'pagar'],
    informacao: ['horário', 'endereço', 'telefone', 'onde fica', 'quando abre']
  };

  let bestMatch = 'outro';
  let maxScore = 0;

  for (const [intent, words] of Object.entries(keywords)) {
    const score = words.filter(w => msg.includes(w)).length;
    if (score > maxScore) {
      maxScore = score;
      bestMatch = intent;
    }
  }

  return {
    success: true,
    intent: bestMatch,
    confidence: maxScore > 0 ? 0.7 : 0.3,
    entities: {},
    reasoning: 'Classificação por palavras-chave (fallback)'
  };
}

async function queryRAG(base44, params) {
  const { pergunta, contexto = {}, limit = 5 } = params;
  
  console.log('[NEXUS CLASSIFIER] 📚 Consultando Base de Conhecimento...');

  try {
    // Buscar conhecimentos relevantes
    const conhecimentos = await base44.asServiceRole.entities.BaseConhecimento.filter(
      { ativo: true },
      '-relevancia_score',
      50
    );

    // Calcular relevância por similaridade de texto simples
    const resultados = conhecimentos
      .map(k => {
        const score = calcularRelevancia(pergunta, k);
        return { ...k, relevancia_calculada: score };
      })
      .filter(k => k.relevancia_calculada > 0.3)
      .sort((a, b) => b.relevancia_calculada - a.relevancia_calculada)
      .slice(0, limit);

    console.log('[NEXUS CLASSIFIER] ✅ Encontrados:', resultados.length, 'conhecimentos relevantes');

    if (resultados.length === 0) {
      return {
        success: true,
        resposta: null,
        is_confident: false,
        conhecimentos: []
      };
    }

    // Montar resposta com os conhecimentos
    const contextoPrompt = resultados
      .map(k => `**${k.titulo}**\n${k.conteudo}`)
      .join('\n\n---\n\n');

    const prompt = `
Você é um assistente que responde baseado EXCLUSIVAMENTE na base de conhecimento fornecida.

Base de Conhecimento:
${contextoPrompt}

Pergunta do cliente: "${pergunta}"

Contexto adicional:
${JSON.stringify(contexto, null, 2)}

Responda de forma clara e objetiva. Se a informação não estiver na base de conhecimento, diga "Não tenho essa informação disponível no momento."
`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt
    });

    return {
      success: true,
      resposta: response,
      is_confident: resultados[0].relevancia_calculada > 0.7,
      conhecimentos: resultados.map(k => ({
        id: k.id,
        titulo: k.titulo,
        relevancia: k.relevancia_calculada
      }))
    };

  } catch (error) {
    console.error('[NEXUS CLASSIFIER] ❌ Erro no RAG:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function calcularRelevancia(pergunta, conhecimento) {
  const perguntaLower = pergunta.toLowerCase();
  const tituloLower = (conhecimento.titulo || '').toLowerCase();
  const conteudoLower = (conhecimento.conteudo || '').toLowerCase();
  const tagsLower = (conhecimento.tags || []).map(t => t.toLowerCase());

  let score = 0;

  // Título contém palavras da pergunta
  const palavrasPergunta = perguntaLower.split(/\s+/);
  palavrasPergunta.forEach(palavra => {
    if (palavra.length < 3) return;
    if (tituloLower.includes(palavra)) score += 0.3;
    if (conteudoLower.includes(palavra)) score += 0.1;
    if (tagsLower.some(tag => tag.includes(palavra))) score += 0.2;
  });

  return Math.min(score, 1.0);
}