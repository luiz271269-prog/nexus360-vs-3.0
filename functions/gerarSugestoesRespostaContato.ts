import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ✅ V3: Gera sugestões de resposta usando análise comportamental
 * - Prioriza ContactBehaviorAnalysis quando disponível
 * - Busca últimas mensagens para contexto
 * - Retorna 3 sugestões (formal/amigável/objetiva)
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json().catch(() => ({}));
    const {
      contact_id,
      limit = 50, // ✅ OTIMIZADO: 50 mensagens por padrão (2x mais rápido)
      tom = ['formal', 'amigavel', 'objetiva'],
      idioma = 'pt-BR',
    } = body;

    if (!contact_id) {
      return Response.json({ success: false, error: 'contact_id é obrigatório' }, { status: 400 });
    }

    const N = Math.max(30, Math.min(80, Number(limit) || 50)); // ✅ Limites ajustados

    // ═════════════════════════════════════════════════════════════════
    // 1️⃣ BUSCAR CONTATO + ANÁLISE COMPORTAMENTAL (V3)
    // ═════════════════════════════════════════════════════════════════
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null);
    if (!contato) {
      return Response.json({ success: false, error: 'Contato não encontrado' }, { status: 404 });
    }

    // Buscar última análise comportamental
    const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
      { contact_id: contact_id },
      '-analyzed_at',
      1
    );
    const analise = analises[0] || null;

    // ═════════════════════════════════════════════════════════════════
    // 2️⃣ BUSCAR THREAD CANÔNICA + MENSAGENS
    // ═════════════════════════════════════════════════════════════════
    const threads = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contact_id, is_canonical: true },
      '-last_message_at',
      1
    );
    const thread = threads?.[0] || null;

    // Buscar mensagens (DESC depois invertemos)
    const msgQuery = thread
      ? { thread_id: thread.id }
      : { contact_id: contact_id };

    const mensagensDesc = await base44.asServiceRole.entities.Message.filter(
      msgQuery,
      '-created_date',
      N
    );

    const mensagens = (mensagensDesc || []).slice().reverse(); // ASC cronológico

    // ═════════════════════════════════════════════════════════════════
    // 3️⃣ NORMALIZAR MENSAGENS (inbound/outbound)
    // ═════════════════════════════════════════════════════════════════
    const normalized = mensagens.map((m) => {
      // Identificar direção
      const isInbound = m.sender_type === 'contact';
      const direction = isInbound ? 'inbound' : 'outbound';

      // Texto
      const type = m.media_type || 'none';
      let text = (m.content || '').trim();

      if (!text) {
        if (type === 'audio') text = '[áudio]';
        else if (type === 'image') text = '[imagem]';
        else if (type === 'video') text = '[vídeo]';
        else if (type === 'document') text = '[documento]';
        else if (type === 'location') text = '[localização]';
        else text = '[sem texto]';
      }

      return {
        id: m.id,
        at: m.created_date || m.sent_at,
        direction,
        type,
        text,
      };
    });

    const hasEnoughData = normalized.length >= 5;
    const lastInbound = [...normalized].reverse().find(x => x.direction === 'inbound');
    const lastOutbound = [...normalized].reverse().find(x => x.direction === 'outbound');

    // ═════════════════════════════════════════════════════════════════
    // 4️⃣ MONTAR CONTEXTO PARA IA (OTIMIZADO)
    // ═════════════════════════════════════════════════════════════════
    const conversationText = normalized
      .slice(-15) // ✅ OTIMIZADO: 15 mensagens (era 20) - reduz tokens
      .map((x) => {
        const who = x.direction === 'inbound' ? 'CLIENTE' : 'AGENTE';
        return `${who}: ${x.text}`;
      })
      .join('\n');

    // ═════════════════════════════════════════════════════════════════
    // 5️⃣ CHAMAR IA PARA ANÁLISE + SUGESTÕES
    // ═════════════════════════════════════════════════════════════════
    const systemInstruction = `Você é um assistente comercial especializado.
Analise a conversa e gere:
1) Resumo do que o cliente quer
2) Intenção (orçamento, dúvida, reclamação, followup, outro)
3) Urgência (baixa, media, alta)
4) Objeções identificadas
5) Informações faltantes
6) Próxima ação recomendada
7) 3 sugestões de resposta (formal, amigável, objetiva)

Regras:
- Respostas CURTAS (máx 2-3 linhas)
- Orientadas à ação
- Não inventar dados
- Usar contexto da análise comportamental quando disponível`;

    const userPrompt = `DADOS DO CONTATO:
- Nome: ${contato.nome || 'N/D'}
- Empresa: ${contato.empresa || 'N/D'}
- Tipo: ${contato.tipo_contato || 'N/D'}

${analise ? `ANÁLISE COMPORTAMENTAL (última):
- Status: ${analise.status}
- Inatividade: ${analise.days_inactive_inbound || 0} dias (cliente sem responder)
- Bucket: ${analise.bucket_inactive || 'active'}
- Deal Risk: ${analise.ai_insights?.deal_risk || 0}%
- Buy Intent: ${analise.ai_insights?.buy_intent || 0}%
- Engagement: ${analise.ai_insights?.engagement || 0}%
- Sentiment: ${analise.ai_insights?.sentiment || 'neutro'}
- Próxima Ação IA: ${analise.ai_insights?.next_best_action?.action || 'N/D'}
- Sugestão de Mensagem: ${analise.ai_insights?.next_best_action?.message_suggestion || 'N/D'}
` : ''}

CONVERSA (ordem cronológica, últimas 20):
${conversationText}

ÚLTIMA MENSAGEM DO CLIENTE:
${lastInbound?.text || 'N/D'}

Retorne JSON estruturado.`;

    const schema = {
      type: "object",
      properties: {
        analysis: {
          type: "object",
          properties: {
            last_customer_message: { type: "string" },
            customer_intent: { type: "string", enum: ["orcamento", "duvida", "reclamacao", "followup", "outro"] },
            urgency: { type: "string", enum: ["baixa", "media", "alta"] },
            objections: { type: "array", items: { type: "string" } },
            missing_info: { type: "array", items: { type: "string" } },
            next_best_action: {
              type: "object",
              properties: {
                action: { type: "string" },
                why: { type: "string" },
                ask: { type: "string" }
              }
            }
          }
        },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tone: { type: "string" },
              title: { type: "string" },
              message: { type: "string" }
            }
          }
        }
      }
    };

    const aiResp = await base44.integrations.Core.InvokeLLM({
      prompt: systemInstruction + '\n\n' + userPrompt,
      response_json_schema: schema
    });

    // ═════════════════════════════════════════════════════════════════
    // 6️⃣ NORMALIZAR RESPOSTA
    // ═════════════════════════════════════════════════════════════════
    const analysis = aiResp.analysis || {};
    const suggestionsRaw = Array.isArray(aiResp.suggestions) ? aiResp.suggestions : [];

    // Garantir 3 sugestões nos tons pedidos
    const byTone = new Map(suggestionsRaw.map((s) => [s.tone, s]));
    const suggestions = tom.map((tone) => {
      const s = byTone.get(tone) || {};
      const title =
        tone === 'formal' ? '👔 formal' :
        tone === 'amigavel' ? '😊 amigável' :
        tone === 'objetiva' ? '🎯 objetiva' : tone;

      return {
        id: tone,
        tone,
        title: s.title || title,
        message: (s.message || '').trim(),
      };
    }).filter(s => s.message);

    // ═════════════════════════════════════════════════════════════════
    // 7️⃣ PERSISTIR INSIGHTS (OPCIONAL - para cache)
    // ═════════════════════════════════════════════════════════════════
    if (analise && suggestions.length > 0) {
      try {
        await base44.asServiceRole.entities.ContactBehaviorAnalysis.update(analise.id, {
          ai_insights: {
            ...analise.ai_insights,
            suggestions_cached: suggestions,
            suggestions_generated_at: new Date().toISOString()
          }
        });
      } catch (err) {
        console.warn('[SUGESTOES] Falha ao persistir cache:', err.message);
      }
    }

    // ═════════════════════════════════════════════════════════════════
    // 8️⃣ RETORNAR RESPOSTA
    // ═════════════════════════════════════════════════════════════════
    return Response.json({
      success: true,
      contact_id,
      meta: {
        limit: N,
        fetched: normalized.length,
        hasEnoughData,
        lastInboundAt: lastInbound?.at || null,
        lastOutboundAt: lastOutbound?.at || null,
        thread_id: thread?.id || null,
        has_analysis: !!analise,
        ai: { ok: true }
      },
      analysis,
      suggestions
    });

  } catch (error) {
    console.error('[GERAR_SUGESTOES] Erro:', error);
    return Response.json({ 
      success: false, 
      error: error?.message || String(error) 
    }, { status: 500 });
  }
});