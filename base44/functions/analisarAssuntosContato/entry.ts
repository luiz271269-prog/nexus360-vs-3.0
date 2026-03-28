import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOTOR B — ANÁLISE DE ASSUNTOS (Topic Analysis)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Objetivo: Organizar a conversa em ASSUNTOS e analisar cada um:
 * - Timeline (marcos do assunto)
 * - Sentimento (atual + mudanças)
 * - Pendências (open loops)
 * - Risco (devolução, perda, ruído)
 * - Contexto (história do assunto)
 * 
 * CRÍTICO: NÃO gera respostas prontas. Apenas análise de contexto.
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { contact_id, limit = 50 } = await req.json();

    if (!contact_id) {
      return Response.json({ error: 'contact_id obrigatório' }, { status: 400 });
    }

    console.log(`[MOTOR_B] 🎯 Analisando assuntos do contato: ${contact_id}`);

    // ══════════════════════════════════════════════════════════════
    // 1️⃣ BUSCAR CONTATO + THREADS + MENSAGENS
    // ══════════════════════════════════════════════════════════════
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contact) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    const threads = await base44.asServiceRole.entities.MessageThread.filter({ 
      contact_id: contact_id 
    });

    if (threads.length === 0) {
      return Response.json({
        success: true,
        skipped: true,
        reason: 'Sem conversas'
      });
    }

    const threadIds = threads.map(t => t.id);

    // ✅ Buscar últimas N mensagens COMPLETAS (ASC cronológico)
    const mensagensDesc = await base44.asServiceRole.entities.Message.filter(
      { thread_id: { $in: threadIds } },
      '-sent_at',
      limit
    );

    if (mensagensDesc.length === 0) {
      return Response.json({
        success: true,
        skipped: true,
        reason: 'Sem mensagens'
      });
    }

    const mensagens = [...mensagensDesc].reverse();
    
    console.log(`[MOTOR_B] 📊 ${mensagens.length} mensagens carregadas`);

    // ══════════════════════════════════════════════════════════════
    // 2️⃣ PREPARAR CONVERSA COMPLETA PARA IA
    // ══════════════════════════════════════════════════════════════
    const conversationText = mensagens.map(m => {
      const timestamp = new Date(m.sent_at || m.created_date).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const sender = m.sender_type === 'contact' ? 'CLIENTE' : 'VENDEDOR';
      
      let content = (m.content || '').trim();
      if (!content) {
        if (m.media_type === 'image') content = '[imagem]';
        else if (m.media_type === 'audio') content = '[áudio]';
        else if (m.media_type === 'video') content = '[vídeo]';
        else if (m.media_type === 'document') content = '[documento]';
        else content = '[sem texto]';
      }
      
      return `[${timestamp}] ${sender}: ${content}`;
    }).join('\n');

    // ══════════════════════════════════════════════════════════════
    // 3️⃣ INVOCAR IA PARA ANÁLISE DE ASSUNTOS
    // ══════════════════════════════════════════════════════════════
    const promptMotorB = `🧠 MOTOR DE ANÁLISE DE ASSUNTOS — V1.0
==========================================================================

Você é um motor de análise conversacional especializado em organizar conversas comerciais por ASSUNTOS.

📥 CONTEXTO DO CONTATO:
- Nome: ${contact.nome || 'N/A'}
- Empresa: ${contact.empresa || 'N/A'}
- Tipo: ${contact.tipo_contato || 'novo'}
- Total de mensagens analisadas: ${mensagens.length}

📱 HISTÓRICO COMPLETO (ordem cronológica):
${conversationText}

⚠️ REGRAS CRÍTICAS:
1. Identificar TODOS os assuntos/tópicos discutidos (produtos, pedidos, problemas, NF, etc.)
2. Para cada assunto, traçar LINHA DO TEMPO com marcos importantes
3. Analisar SENTIMENTO em cada fase do assunto (neutro → ansiedade → pressão → alívio)
4. Detectar MUDANÇAS DE SENTIMENTO (quando piorou/melhorou) com evidência (snippet)
5. Listar PENDÊNCIAS (open loops) com responsável (cliente/vendedor/interno/fornecedor)
6. Calcular RISCO do assunto (devolução, perda, ruído, atraso)
7. NÃO gerar mensagens prontas — apenas AÇÕES recomendadas
8. Capturar DADOS ESTRUTURADOS (valores, quantidades, prazos, condições)

🎯 SAÍDA OBRIGATÓRIA — JSON:

{
  "topics": [
    {
      "topic": "Nome do assunto (ex: SSD 500GB, Carregador Mac, Nota Fiscal ICMS)",
      "status": "aberto|andamento|fechado|perdido|ganho",
      "context_summary": "Resumo executivo do assunto (2-3 linhas)",
      
      "timeline": [
        {
          "timestamp": "DD/MM HH:MM",
          "event": "pedido_inicial|negociacao|pressao|confirmacao|perda|solucao",
          "snippet": "trecho da mensagem"
        }
      ],
      
      "sentiment_summary": {
        "current": "muito_positivo|positivo|neutro|negativo|muito_negativo",
        "trend": "melhorando|estavel|piorando",
        "intensity": 0-100
      },
      
      "sentiment_events": [
        {
          "timestamp": "DD/MM HH:MM",
          "sentiment": "humor|ansiedade|pressao|ameaca|alivio|confirmacao",
          "target": "empresa_cliente|voce_vendedor|fornecedor|situacao",
          "snippet": "trecho evidência"
        }
      ],
      
      "key_facts": [
        {
          "type": "valor|quantidade|prazo|condicao_fiscal|modelo|marca",
          "value": "valor extraído",
          "source": "cliente|vendedor"
        }
      ],
      
      "open_loops": [
        {
          "pending": "O que está pendente",
          "owner": "cliente|vendedor|interno|fornecedor",
          "since": "YYYY-MM-DDTHH:MM:SSZ"
        }
      ],
      
      "risk": {
        "level": "low|medium|high|critical",
        "reasons": ["razão 1", "razão 2"]
      },
      
      "recommended_next_steps": [
        "Ação 1 (sem mensagem pronta)",
        "Ação 2 (sem mensagem pronta)"
      ]
    }
  ],
  
  "global_sentiment": {
    "overall": "muito_positivo|positivo|neutro|negativo|muito_negativo",
    "trend": "melhorando|estavel|piorando",
    "critical_moments": [
      {
        "timestamp": "DD/MM HH:MM",
        "type": "pico_positivo|pico_negativo|virada|tensao",
        "snippet": "trecho"
      }
    ]
  }
}

Retorne OBRIGATORIAMENTE todos os campos. Seja analítico, não invente dados.`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: promptMotorB,
      response_json_schema: {
        type: "object",
        properties: {
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topic: { type: "string" },
                status: { 
                  type: "string",
                  enum: ["aberto", "andamento", "fechado", "perdido", "ganho"]
                },
                context_summary: { type: "string" },
                timeline: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      timestamp: { type: "string" },
                      event: { type: "string" },
                      snippet: { type: "string" }
                    }
                  }
                },
                sentiment_summary: {
                  type: "object",
                  properties: {
                    current: { 
                      type: "string",
                      enum: ["muito_positivo", "positivo", "neutro", "negativo", "muito_negativo"]
                    },
                    trend: { 
                      type: "string",
                      enum: ["melhorando", "estavel", "piorando"]
                    },
                    intensity: { type: "number" }
                  }
                },
                sentiment_events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      timestamp: { type: "string" },
                      sentiment: { 
                        type: "string",
                        enum: ["humor", "ansiedade", "pressao", "ameaca", "alivio", "confirmacao"]
                      },
                      target: { 
                        type: "string",
                        enum: ["empresa_cliente", "voce_vendedor", "fornecedor", "situacao"]
                      },
                      snippet: { type: "string" }
                    }
                  }
                },
                key_facts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { 
                        type: "string",
                        enum: ["valor", "quantidade", "prazo", "condicao_fiscal", "modelo", "marca"]
                      },
                      value: { type: "string" },
                      source: { type: "string" }
                    }
                  }
                },
                open_loops: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pending: { type: "string" },
                      owner: { 
                        type: "string",
                        enum: ["cliente", "vendedor", "interno", "fornecedor"]
                      },
                      since: { type: "string" }
                    }
                  }
                },
                risk: {
                  type: "object",
                  properties: {
                    level: { 
                      type: "string",
                      enum: ["low", "medium", "high", "critical"]
                    },
                    reasons: {
                      type: "array",
                      items: { type: "string" }
                    }
                  }
                },
                recommended_next_steps: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          },
          global_sentiment: {
            type: "object",
            properties: {
              overall: { 
                type: "string",
                enum: ["muito_positivo", "positivo", "neutro", "negativo", "muito_negativo"]
              },
              trend: { 
                type: "string",
                enum: ["melhorando", "estavel", "piorando"]
              },
              critical_moments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string" },
                    type: { 
                      type: "string",
                      enum: ["pico_positivo", "pico_negativo", "virada", "tensao"]
                    },
                    snippet: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`[MOTOR_B] ✅ IA retornou ${aiResponse.topics?.length || 0} assuntos`);

    // ══════════════════════════════════════════════════════════════
    // 4️⃣ PERSISTIR ANÁLISE
    // ══════════════════════════════════════════════════════════════
    const primeiraMsg = mensagens[0];
    const ultimaMsg = mensagens[mensagens.length - 1];
    
    const topicAnalysis = await base44.asServiceRole.entities.TopicAnalysis.create({
      contact_id: contact_id,
      analyzed_at: new Date().toISOString(),
      window_size: mensagens.length,
      period: {
        from: primeiraMsg.sent_at || primeiraMsg.created_date,
        to: ultimaMsg.sent_at || ultimaMsg.created_date
      },
      topics: aiResponse.topics || [],
      global_sentiment: aiResponse.global_sentiment || {
        overall: 'neutro',
        trend: 'estavel',
        critical_moments: []
      },
      meta: {
        total_topics: aiResponse.topics?.length || 0,
        open_topics: aiResponse.topics?.filter(t => t.status === 'aberto' || t.status === 'andamento').length || 0,
        critical_topics: aiResponse.topics?.filter(t => t.risk?.level === 'high' || t.risk?.level === 'critical').length || 0,
        total_open_loops: aiResponse.topics?.reduce((sum, t) => sum + (t.open_loops?.length || 0), 0) || 0
      }
    });

    console.log(`[MOTOR_B] ✅ Análise salva: ${topicAnalysis.id}`);

    return Response.json({
      success: true,
      analysis_id: topicAnalysis.id,
      summary: {
        total_topics: topicAnalysis.meta.total_topics,
        open_topics: topicAnalysis.meta.open_topics,
        critical_topics: topicAnalysis.meta.critical_topics,
        total_open_loops: topicAnalysis.meta.total_open_loops,
        global_sentiment: topicAnalysis.global_sentiment.overall
      },
      topics: aiResponse.topics
    });

  } catch (error) {
    console.error('[MOTOR_B] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});