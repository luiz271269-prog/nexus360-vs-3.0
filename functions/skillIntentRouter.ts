// ============================================================================
// SKILL 2 — INTENT ROUTER v2.0
// Objetivo: Detectar intencao + rotear para setor correto
// Hibrido: Pattern Match (0ms) -> LLM (so se confidence < 0.75)
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const base44 = createClientFromRequest(req);
  const startTime = Date.now();
  const payload = await req.json().catch(() => ({}));
  const { thread, contact, mensagem } = payload;

  try {
    // Guard: ja roteado
    if (thread.routing_stage === 'ASSIGNED' || thread.routing_stage === 'COMPLETED') {
      return Response.json({ success: true, skipped: true, reason: 'ja_roteado' });
    }

    // Coletar contexto
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { thread_id: thread.id, sender_type: 'contact' },
      'created_date',
      10
    ).catch(() => []);

    const textoCompleto = (mensagens
      .map(m => m.content)
      .filter(Boolean)
      .join(' ') || mensagem || '').slice(-500);

    if (!textoCompleto.trim()) {
      return Response.json({ success: false, error: 'sem_texto' }, { status: 400 });
    }

    // Pattern Match (sem LLM, confidence alta)
    const PATTERNS = [
      {
        regex: /pc\s*gam|gam(er|ing)|notebook|computador|placa\s*de\s*v|rtx|rx\s*\d|processador|ram|ssd|hd\s*externo|monitor|teclado|mouse|headset|fonte|gabinete|cooler|hardware|orcamento|cotacao|preco|quanto\s*custa|comprar|produto|estoque|disponib/i,
        setor: 'vendas',
        intencao: 'compra_produto',
        confidence: 0.95
      },
      {
        regex: /boleto|fatura|nota\s*fiscal|2[aa]\s*via|pagamento|vencimento|cobranca|debito|credito|parcelar|financ/i,
        setor: 'financeiro',
        intencao: 'consulta_financeira',
        confidence: 0.95
      },
      {
        regex: /defeito|quebrou|nao\s*liga|nao\s*funciona|conserto|reparo|assistencia|garantia|suporte\s*tec|problema|travando|lento|reiniciando/i,
        setor: 'assistencia',
        intencao: 'suporte_tecnico',
        confidence: 0.95
      },
      {
        regex: /fornec|distribu|atacado|revend|parceria|comercial|representante|catalogo|lista\s*de\s*preco/i,
        setor: 'fornecedor',
        intencao: 'parceria_comercial',
        confidence: 0.90
      }
    ];

    let deteccao = null;
    let metodo = 'llm';

    for (const pattern of PATTERNS) {
      if (pattern.regex.test(textoCompleto)) {
        deteccao = {
          setor: pattern.setor,
          intencao: pattern.intencao,
          confidence: pattern.confidence
        };
        metodo = 'pattern_match';
        break;
      }
    }

    // LLM (so se pattern <0.75)
    if (!deteccao || deteccao.confidence < 0.75) {
      try {
        const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Classifique a intencao em JSON:
TEXTO: ${textoCompleto}
Retorne: {"intencao":"string", "setor":"vendas|assistencia|financeiro|fornecedor", "confidence":0.0-1.0}`,
          response_json_schema: {
            type: 'object',
            properties: {
              intencao: { type: 'string' },
              setor: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        });

        if (llmResult?.setor) {
          deteccao = llmResult;
          metodo = 'llm';
        }
      } catch (e) {
        console.warn('[ROUTER] LLM falhou:', e.message);
      }
    }

    // Fallback
    if (!deteccao) {
      deteccao = { setor: 'vendas', intencao: 'contato_geral', confidence: 0.5 };
      metodo = 'keywords';
    }

    // Tipo contato
    let tipoContato = contact.tipo_contato || 'novo';
    if (mensagens.length === 1 && contact.tipo_contato === 'novo') {
      tipoContato = 'lead';
    }

    // Atualizar thread
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      sector_id: deteccao.setor,
      routing_stage: 'INTENT_DETECTED',
      pre_atendimento_completed_at: new Date().toISOString()
    });

    // Atualizar tipo contato
    if (tipoContato !== contact.tipo_contato) {
      await base44.asServiceRole.entities.Contact.update(contact.id, {
        tipo_contato: tipoContato
      }).catch(() => null);
    }

    // Registrar IntentDetection
    await base44.asServiceRole.entities.IntentDetection.create({
      thread_id: thread.id,
      contact_id: contact.id,
      mensagem_analisada: textoCompleto,
      intencao_detectada: deteccao.intencao,
      setor_detectado: deteccao.setor,
      tipo_contato_detectado: tipoContato,
      confidence: deteccao.confidence,
      modelo_usado: metodo === 'llm' ? 'gemini_3_flash' : 'pattern_match',
      metodo_deteccao: metodo,
      tempo_processamento_ms: Date.now() - startTime
    }).catch(() => null);

    // Log
    await base44.asServiceRole.entities.SkillExecution.create({
      skill_name: 'skillIntentRouter',
      triggered_by: 'processInbound',
      execution_mode: 'autonomous_safe',
      success: true,
      duration_ms: Date.now() - startTime,
      metricas: { metodo, confidence: deteccao.confidence, sector: deteccao.setor }
    }).catch(() => null);

    return Response.json({
      success: true,
      setor: deteccao.setor,
      intencao: deteccao.intencao,
      confidence: deteccao.confidence,
      tipo_contato: tipoContato,
      metodo
    });

  } catch (error) {
    console.error('[ROUTER] Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});