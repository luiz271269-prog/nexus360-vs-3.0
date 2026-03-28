// ============================================================================
// SKILL 02 — INTENT ROUTER v2.2 (sticky hint para LLM)
// ============================================================================
// Objetivo: Pattern Match (0ms) → LLM (só se confidence < 0.75)
// Sticky: usa thread.sector_id anterior como hint para o LLM
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PATTERNS = [
  {
    regex: /pc\s*gam|gam(er|ing)|notebook|computador|placa\s*de\s*v|rtx|rx\s*\d|processador|ram|ssd|hd\s*externo|monitor|teclado|mouse|headset|fonte|gabinete|cooler|hardware|orcamento|cotacao|preco|quanto\s*custa|comprar|produto|estoque|disponib/i,
    setor: 'vendas', intencao: 'compra_produto', confidence: 0.95
  },
  {
    regex: /boleto|fatura|nota\s*fiscal|2[aa]\s*via|pagamento|vencimento|cobranca|debito|credito|parcelar|financ/i,
    setor: 'financeiro', intencao: 'consulta_financeira', confidence: 0.95
  },
  {
    regex: /defeito|quebrou|nao\s*liga|nao\s*funciona|conserto|reparo|assistencia|garantia|suporte\s*tec|problema|travando|lento|reiniciando|cabo\s*de\s*internet|wifi|conexao|internet\s*caiu|online|offline|nao\s*conecta|conexao\s*perdida|rede|modem|roteador/i,
    setor: 'assistencia', intencao: 'suporte_tecnico', confidence: 0.95
  },
  {
    regex: /fornec|distribu|atacado|revend|parceria|comercial|representante|catalogo|lista\s*de\s*preco/i,
    setor: 'fornecedor', intencao: 'parceria_comercial', confidence: 0.90
  }
];

async function detectarComLLM(base44, textoCompleto, setorAnterior) {
  try {
    const stickyHint = setorAnterior
      ? `\nContexto: este cliente já foi atendido anteriormente em '${setorAnterior}'. Se o assunto atual for compatível com esse setor, prefira-o.`
      : '';

    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `Classifique a intenção em JSON:\nTEXTO: "${textoCompleto.substring(0, 200)}"${stickyHint}\nRetorne: {"intencao":"string", "setor":"vendas|assistencia|financeiro|fornecedor", "confidence":0.0-1.0}`,
      response_json_schema: {
        type: 'object',
        properties: {
          intencao: { type: 'string' },
          setor: { type: 'string' },
          confidence: { type: 'number' }
        }
      }
    });

    if (llmResult && llmResult.setor) {
      return llmResult;
    }
  } catch (e) {
    console.warn('[ROUTER] LLM falhou:', e.message);
  }

  return { setor: 'vendas', intencao: 'contato_geral', confidence: 0.5 };
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const tsInicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { thread_id, contact_id, message_content } = payload;

    if (!thread_id || !contact_id || !message_content) {
      return Response.json({ success: false, error: 'Campos obrigatórios ausentes' }, { status: 400, headers });
    }

    // Guard: já roteado?
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    if (thread.routing_stage === 'ASSIGNED' || thread.routing_stage === 'COMPLETED') {
      return Response.json({ success: true, skipped: true, reason: 'already_routed' }, { headers });
    }

    // Sticky hint: setor anterior do cliente para melhorar precisão do LLM
    const setorAnterior = thread.sector_id || null;

    // Pattern Match (sem LLM)
    const textoCompleto = message_content.substring(0, 500).toLowerCase();
    let deteccao = null;
    let metodo = 'llm';

    for (const pattern of PATTERNS) {
      if (pattern.regex.test(textoCompleto)) {
        deteccao = { setor: pattern.setor, intencao: pattern.intencao, confidence: pattern.confidence };
        metodo = 'pattern_match';
        break;
      }
    }

    // LLM (só se pattern não teve confiança suficiente)
    if (!deteccao || deteccao.confidence < 0.75) {
      deteccao = await detectarComLLM(base44, message_content, setorAnterior);
      metodo = 'llm';
    }

    // Buscar threshold configurável
    let thresholdConfig = 0.65;
    try {
      const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter(
        { chave: 'ai_router_confidence_threshold' }, 'chave', 1
      );
      if (configs && configs.length > 0) thresholdConfig = configs[0].valor?.value || 0.65;
    } catch (e) {
      console.warn('[ROUTER] Erro ao buscar threshold:', e.message);
    }

    // Tipo contato
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    const tipoContato = contact.tipo_contato || 'novo';

    // Verificar atendente fidelizado para o setor detectado
    const campoFidelizado = `atendente_fidelizado_${deteccao.setor}`;
    const valorFidelizado = contact[campoFidelizado];
    const atendenteFidelizadoId = valorFidelizado && /^[a-f0-9]{24}$/i.test(String(valorFidelizado))
      ? String(valorFidelizado)
      : null;

    if (atendenteFidelizadoId) {
      console.log(`[INTENT-ROUTER] 🎯 Atendente fidelizado encontrado para setor ${deteccao.setor}: ${atendenteFidelizadoId}`);
    }

    // Registrar IntentDetection
    await base44.asServiceRole.entities.IntentDetection.create({
      thread_id, contact_id,
      mensagem_analisada: textoCompleto.substring(0, 500),
      intencao_detectada: deteccao.intencao,
      setor_detectado: deteccao.setor,
      tipo_contato_detectado: tipoContato,
      confidence: deteccao.confidence,
      modelo_usado: metodo === 'llm' ? 'gemini_3_flash' : 'pattern_match',
      metodo_deteccao: metodo,
      threshold_aplicado: thresholdConfig,
      resultado_roteamento: deteccao.confidence >= thresholdConfig ? 'auto_roteado' : 'menu_fallback',
      tempo_processamento_ms: Date.now() - tsInicio,
      setor_anterior_hint: setorAnterior
    }).catch(() => {});

    // Atualizar thread
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      sector_id: deteccao.setor,
      routing_stage: 'INTENT_DETECTED'
    }).catch(e => console.error('[INTENT-ROUTER] ❌ Erro ao atualizar thread:', e.message));

    return Response.json({
      success: true,
      setor: deteccao.setor,
      intencao: deteccao.intencao,
      confidence: deteccao.confidence,
      tipo_contato: tipoContato,
      metodo,
      setor_anterior_hint: setorAnterior,
      atendente_fidelizado_id: atendenteFidelizadoId,
      resultado_roteamento: deteccao.confidence >= thresholdConfig ? 'auto_roteado' : 'menu_fallback'
    }, { headers });

  } catch (error) {
    console.error('[ROUTER] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});