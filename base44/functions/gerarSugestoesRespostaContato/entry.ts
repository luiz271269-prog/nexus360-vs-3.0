import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
      thread_id, // ✅ NOVO: thread_id preferencial
      contact_id,
      limit = 50,
      tones = ['formal', 'amigavel', 'objetiva'], // ✅ Padronizado
      language = 'pt-BR',
      force = false
    } = body;

    // ✅ Aceita tom/idioma (legado) ou tones/language (novo)
    const tom = body.tom || tones;
    const idioma = body.idioma || language;

    const N = Math.max(30, Math.min(80, Number(limit) || 50));
    const forceRegenerate = force === true;

    // ═════════════════════════════════════════════════════════════════
    // 1️⃣ RESOLVER THREAD (otimizado com thread_id direto)
    // ═════════════════════════════════════════════════════════════════
    let thread = null;
    let contato = null;

    if (thread_id) {
      // ✅ CAMINHO RÁPIDO: thread direto + contato em paralelo (-80ms)
      const threadPromise = base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null);
      const contatoPromise = contact_id 
        ? base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null)
        : null;
      
      [thread, contato] = await Promise.all([threadPromise, contatoPromise]);
      
      // Se thread existe mas contato não veio, buscar pelo contact_id da thread
      if (thread && !contato && thread.contact_id) {
        contato = await base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null);
      }
    } else if (contact_id) {
      // ✅ FALLBACK: buscar thread canônica
      const [contatoData, threadsData] = await Promise.all([
        base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null),
        base44.asServiceRole.entities.MessageThread.filter(
          { contact_id, is_canonical: true },
          '-last_message_at',
          1
        )
      ]);
      contato = contatoData;
      thread = threadsData?.[0] || null;
    } else {
      return Response.json({ 
        success: false, 
        error: 'thread_id ou contact_id é obrigatório' 
      }, { status: 400 });
    }

    if (!thread && !contato) {
      return Response.json({ 
        success: false, 
        error: 'Thread/Contato não encontrado' 
      }, { status: 404 });
    }

    // ═════════════════════════════════════════════════════════════════
    // 2️⃣ BUSCAR ANÁLISE EM PARALELO
    // ═════════════════════════════════════════════════════════════════
    const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
      { contact_id: contato?.id || thread?.contact_id },
      '-analyzed_at',
      1
    );
    const analise = analises[0] || null;

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

    // ═════════════════════════════════════════════════════════════════
    // 3.5️⃣ SELEÇÃO INTELIGENTE DE ÚLTIMA MENSAGEM ÚTIL
    // ═════════════════════════════════════════════════════════════════
    const pickLastUseful = (msgs) => {
      const inbound = msgs.filter(x => x.direction === 'inbound').slice(-10);
      if (inbound.length === 0) return { useful: null, latest: null, is_low_signal: true };

      const scored = inbound.map(m => {
        const text = m.text.toLowerCase();
        const len = text.length;
        let score = 0;

        if (text.includes('?')) score += 3;
        if (/\b(orçamento|cotação|preço|valor|quanto|quando|prazo|entrega|estoque|nota|boleto|pix|nf)\b/i.test(text)) score += 3;
        if (/\b\d+\b/.test(text)) score += 2;
        if (len > 25) score += 2;
        if (/\b(obrigado|ok|blz|valeu|show|perfeito|certo|entendi|top|ótimo)\b/i.test(text) && len < 25) score -= 5;
        if (/\b(sim|não|tá|ok|uhum|aham)\b/i.test(text) && len < 15) score -= 3;

        return { ...m, score, is_useful: score > 0 };
      });

      scored.sort((a, b) => b.score - a.score);

      return {
        useful: scored[0],
        latest: inbound[inbound.length - 1],
        is_low_signal: scored[0].score <= 0
      };
    };

    const classifyType = (text) => {
      if (!text) return 'generico';
      const lower = text.toLowerCase();

      if (/\b(orçamento|cotação|preço|valor|quanto)\b/i.test(lower)) return 'orcamento';
      if (lower.includes('?') || /\b(conseguiu|tem|vai|quando|previsão)\b/i.test(lower)) return 'pergunta';
      if (/\b(nada ainda|alguma novidade|cadê|ficou)\b/i.test(lower)) return 'followup';
      if (/\b(problema|demora|reclamação|péssimo)\b/i.test(lower)) return 'reclamacao';
      if (/\b(obrigado|valeu|show|top)\b/i.test(lower) && lower.length < 25) return 'cortesia';

      return 'interesse';
    };

    const detectOpenLoop = (msgs) => {
      const lastOut = [...msgs].reverse().find(x => x.direction === 'outbound');
      if (!lastOut) return null;

      const hasPromise = /\b(vou|irei|já retorno|verificar|cotando|separo|confirmo|envio|mando|te retorno)\b/i.test(lastOut.text);
      if (!hasPromise) return null;

      const hoursSince = (Date.now() - new Date(lastOut.at)) / (1000 * 60 * 60);

      return {
        status: 'aguardando_acao_atendente',
        promise_text: lastOut.text,
        hours_since_promise: Math.floor(hoursSince),
        is_overdue: hoursSince > 24
      };
    };

    const lastInboundData = pickLastUseful(normalized);
    const lastInbound = lastInboundData.useful || lastInboundData.latest;
    const latestInbound = lastInboundData.latest;
    const isCourtesy = lastInboundData.is_low_signal;
    const conversationType = classifyType(lastInbound?.text || '');
    const openLoop = detectOpenLoop(normalized);
    const lastOutbound = [...normalized].reverse().find(x => x.direction === 'outbound');

    // ═════════════════════════════════════════════════════════════════
    // 🚀 CACHE DE SUGESTÕES (15min TTL) - OTIMIZAÇÃO CRÍTICA
    // ═════════════════════════════════════════════════════════════════
    if (!forceRegenerate && analise?.ai_insights?.suggestions_cached && Array.isArray(analise.ai_insights.suggestions_cached)) {
      const cacheTimestamp = analise.ai_insights.suggestions_generated_at;
      const cacheLastMsgId = analise.ai_insights.suggestions_last_message_id;
      
      if (cacheTimestamp) {
        const cacheAge = Date.now() - new Date(cacheTimestamp).getTime();
        const CACHE_VALID_MS = 15 * 60 * 1000; // 15 minutos
        
        // ✅ Cache válido SE: dentro do TTL E última mensagem não mudou
        const currentLastMsgId = latestInbound?.id;
        const cacheStillValid = cacheAge < CACHE_VALID_MS && cacheAge >= 0 && 
                                (!currentLastMsgId || cacheLastMsgId === currentLastMsgId);
        
        if (cacheStillValid) {
          console.log(`[CACHE] ✅ Hit (${Math.floor(cacheAge / 1000)}s, msg_id match)`);
          
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
              cache_hit: true,
              cache_age_seconds: Math.floor(cacheAge / 1000),
              ai: { ok: true, cached: true }
            },
            analysis: {
              ...(analise.ai_insights || {}),
              last_useful_message: lastInbound?.text || latestInbound?.text || 'N/D',
              last_customer_message: latestInbound?.text || 'N/D',
              is_latest_courtesy: isCourtesy,
              conversation_type: conversationType,
              open_loop: openLoop
            },
            suggestions: analise.ai_insights.suggestions_cached
          });
        }
        
        if (cacheLastMsgId !== currentLastMsgId) {
          console.log('[CACHE] ❌ Miss - nova mensagem detectada');
        } else {
          console.log('[CACHE] ❌ Miss - TTL expirado');
        }
      }
    }

    console.log('[CACHE] ❌ Miss - gerando novas sugestões');

    // ═════════════════════════════════════════════════════════════════
    // 4️⃣ SELEÇÃO INTELIGENTE DE MENSAGENS PARA LLM (8-12 msgs)
    // ═════════════════════════════════════════════════════════════════
    const selectRelevantMessages = (msgs) => {
      // Separar inbound/outbound
      const inbound = msgs.filter(x => x.direction === 'inbound');
      const outbound = msgs.filter(x => x.direction === 'outbound');
      
      // ✅ Priorizar mensagens úteis
      const scoredInbound = inbound.map(m => {
        const text = m.text.toLowerCase();
        let score = 0;
        
        if (text.includes('?')) score += 3;
        if (/\b(orçamento|cotação|preço|valor|quanto|prazo)\b/i.test(text)) score += 4;
        if (/\b(problema|demora|reclamação|urgente)\b/i.test(text)) score += 3;
        if (/\b\d+\b/.test(text)) score += 2;
        if (text.length > 30) score += 1;
        
        return { ...m, score };
      }).sort((a, b) => b.score - a.score);
      
      // ✅ Selecionar mensagens chave
      const selected = [];
      
      // 1. Últimas 3 inbound úteis (max score)
      selected.push(...scoredInbound.slice(0, 3));
      
      // 2. Última outbound (contexto da resposta do atendente)
      if (outbound.length > 0) {
        selected.push(outbound[outbound.length - 1]);
      }
      
      // 3. Mensagem de pedido/orçamento (se houver e não estiver nas 3 últimas)
      const orcamentoMsg = scoredInbound.find(m => 
        /\b(orçamento|cotação|preço)\b/i.test(m.text) && 
        !selected.find(s => s.id === m.id)
      );
      if (orcamentoMsg) {
        selected.push(orcamentoMsg);
        
        // Adicionar 2 msgs de contexto antes do pedido
        const idx = msgs.findIndex(m => m.id === orcamentoMsg.id);
        if (idx > 0) selected.push(msgs[idx - 1]);
        if (idx > 1) selected.push(msgs[idx - 2]);
      }
      
      // 4. Completar até 10 msgs com as mais recentes (se ainda faltar)
      const recentMsgs = msgs.slice(-10).filter(m => !selected.find(s => s.id === m.id));
      selected.push(...recentMsgs.slice(0, 10 - selected.length));
      
      // Ordenar cronologicamente
      return selected.sort((a, b) => new Date(a.at) - new Date(b.at));
    };
    
    const relevantMsgs = selectRelevantMessages(normalized);
    
    const conversationText = relevantMsgs
      .map((x) => {
        const who = x.direction === 'inbound' ? 'C' : 'A';
        const maxLen = 150;
        const text = x.text.length > maxLen ? x.text.slice(0, maxLen) + '...' : x.text;
        return `${who}: ${text}`;
      })
      .join('\n');

    // ═════════════════════════════════════════════════════════════════
    // 5️⃣ CHAMAR IA PARA ANÁLISE + SUGESTÕES
    // ═════════════════════════════════════════════════════════════════
    const systemInstruction = `Assistente comercial especializado.
Analise a conversa e retorne JSON:
1) Resumo breve do pedido
2) Intenção: orçamento/dúvida/reclamação/followup/outro
3) Urgência: baixa/media/alta
4) Próxima ação + pergunta de confirmação
5) 3 respostas CURTAS (máx 2 linhas): formal, amigável, objetiva

Regras: orientado à ação, sem inventar dados.`;

    const userPrompt = `DADOS DO CONTATO:
- Nome: ${contato.nome || 'N/D'}
- Empresa: ${contato.empresa || 'N/D'}
- Tipo: ${contato.tipo_contato || 'N/D'}

${analise ? `ANÁLISE (${analise.days_inactive_inbound || 0}d sem resposta):
Risk ${analise.ai_insights?.deal_risk || 0}% | Intent ${analise.ai_insights?.buy_intent || 0}% | Engage ${analise.ai_insights?.engagement || 0}%
` : ''}

ÚLTIMA MENSAGEM ÚTIL DO CLIENTE:
${lastInbound?.text || 'N/D'}

${isCourtesy ? `ÚLTIMA MENSAGEM (cortesia/encerramento detectado):
"${latestInbound?.text}"
⚠️ Esta é uma cortesia. Use a mensagem útil acima como base da análise.
` : ''}

TIPO DE CONVERSA DETECTADO: ${conversationType}

${openLoop ? `⚠️ PENDÊNCIA DETECTADA:
- Status: Atendente prometeu ação mas não cumpriu
- Promessa: "${openLoop.promise_text}"
- Há ${openLoop.hours_since_promise} horas
- Atrasado: ${openLoop.is_overdue ? 'SIM (>24h)' : 'NÃO'}

CRÍTICO: Cliente aguarda retorno. Suas sugestões DEVEM incluir:
1. Pedido de desculpas (se atrasado)
2. Status atualizado do que foi pedido
3. Prazo específico de entrega
4. Confirmação de escopo (quantidade/modelo)
` : ''}

CONVERSA (últimas 10):
${conversationText}

Retorne JSON estruturado com análise completa e 3 sugestões otimizadas.`;

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
            suggestions_generated_at: new Date().toISOString(),
            suggestions_last_message_id: latestInbound?.id || null // ✅ Invalidar cache em nova msg
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
      analysis: {
        ...analysis,
        last_useful_message: lastInbound?.text || latestInbound?.text || 'N/D',
        last_customer_message: latestInbound?.text || 'N/D',
        is_latest_courtesy: isCourtesy,
        conversation_type: conversationType,
        open_loop: openLoop
      },
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