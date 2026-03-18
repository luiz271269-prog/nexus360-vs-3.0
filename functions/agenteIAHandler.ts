import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { RetryHandler } from './lib/retryHandler.js';
import { ErrorHandler } from './lib/errorHandler.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AGENTE IA HANDLER - OTIMIZADO                              ║
 * ║  ✅ Prompts otimizados                                      ║
 * ║  ✅ Retry automático                                        ║
 * ║  ✅ Validação rigorosa                                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const { mensagem, threadId, contactId } = await req.json();

    console.log('[AGENTE IA] 🤖 Processando mensagem:', mensagem.substring(0, 50));

    // ═══════════════════════════════════════════════════════════
    // 1. BUSCAR CONTEXTO (últimas 5 mensagens)
    // ═══════════════════════════════════════════════════════════
    
    const mensagensRecentes = await base44.asServiceRole.entities.Message.filter(
      { thread_id: threadId },
      '-created_date',
      5
    );

    // ═══════════════════════════════════════════════════════════
    // 2. BUSCAR BASE DE CONHECIMENTO (top 3)
    // ═══════════════════════════════════════════════════════════
    
    const conhecimento = await base44.asServiceRole.entities.BaseConhecimento.filter(
      { 
        categoria: 'faq',
        aprovado: true
      },
      '-relevancia_score',
      3
    );

    // ═══════════════════════════════════════════════════════════
    // 3. CRIAR PROMPT OTIMIZADO
    // ═══════════════════════════════════════════════════════════
    
    const conversaFormatada = mensagensRecentes
      .slice(-5)
      .map(m => `${m.sender_type === 'contact' ? 'Cliente' : 'Sistema'}: ${m.content}`)
      .join('\n');

    const conhecimentoRelevante = conhecimento
      .map(k => `- ${k.titulo}: ${k.conteudo.substring(0, 150)}`)
      .join('\n') || 'Nenhum';

    const promptOtimizado = `Você é assistente de vendas. Responda objetivamente.

CONTEXTO:
${conversaFormatada}

MENSAGEM ATUAL: "${mensagem}"

BASE CONHECIMENTO:
${conhecimentoRelevante}

REGRAS:
1. Máximo 2 parágrafos
2. Use base conhecimento se houver
3. Se lead novo → qualifique
4. Seja profissional

RETORNE JSON:
{
  "resposta": "sua resposta",
  "intencao": "duvida|compra|reclamacao|negociacao",
  "sentimento": "positivo|neutro|negativo",
  "confianca": 0.0-1.0
}`;

    // ═══════════════════════════════════════════════════════════
    // 4. INVOCAR LLM COM RETRY
    // ═══════════════════════════════════════════════════════════
    
    const schema = {
      type: "object",
      properties: {
        resposta: { type: "string" },
        intencao: { type: "string" },
        sentimento: { type: "string" },
        confianca: { type: "number" }
      },
      required: ["resposta", "intencao", "confianca"]
    };

    let llmResponse;
    
    try {
      llmResponse = await RetryHandler.executeWithRetry(
        async () => {
          return await base44.integrations.Core.InvokeLLM({
            prompt: promptOtimizado,
            response_json_schema: schema
          });
        },
        {
          maxRetries: 2,
          initialDelayMs: 1000
        }
      );
    } catch (error) {
      console.error('[AGENTE IA] ❌ Erro ao invocar LLM:', error);
      // Fallback
      llmResponse = {
        resposta: "Desculpe, estou com dificuldades no momento. Um atendente humano irá te ajudar em breve.",
        intencao: "outro",
        sentimento: "neutro",
        confianca: 0
      };
    }

    // ═══════════════════════════════════════════════════════════
    // 5. SALVAR MENSAGEM COM RETRY
    // ═══════════════════════════════════════════════════════════
    
    await RetryHandler.executeWithRetry(
      async () => {
        await base44.asServiceRole.entities.Message.create({
          thread_id: threadId,
          sender_id: 'ia_nexus',
          sender_type: 'user',
          recipient_id: contactId,
          recipient_type: 'contact',
          content: llmResponse.resposta,
          channel: 'interno',
          status: 'enviada',
          metadata: {
            ia_generated: true,
            intencao: llmResponse.intencao,
            sentimento: llmResponse.sentimento,
            confianca: llmResponse.confianca
          }
        });
      },
      {
        maxRetries: 2,
        initialDelayMs: 300
      }
    );

    const processingTime = Date.now() - startTime;
    console.log(`[AGENTE IA] ✅ Processado em ${processingTime}ms`);

    return Response.json(
      {
        success: true,
        resposta: llmResponse.resposta,
        metadata: {
          intencao: llmResponse.intencao,
          sentimento: llmResponse.sentimento,
          confianca: llmResponse.confianca,
          processingTime
        }
      },
      { status: 200, headers }
    );

  } catch (error) {
    const errorInfo = ErrorHandler.handle(error, {
      function: 'agenteIAHandler'
    });

    console.error('[AGENTE IA] ❌ Erro:', errorInfo);

    return Response.json(
      {
        success: false,
        error: errorInfo.userMessage,
        resposta: "Desculpe, não consegui processar sua mensagem. Um atendente irá te ajudar."
      },
      { 
        status: errorInfo.retryable ? 503 : 500,
        headers 
      }
    );
  }
});