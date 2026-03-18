// ============================================================================
// SKILL 02: INTENT ROUTER v1.0.0
// ============================================================================
// Objetivo: Roteamento limpo e responsabilidade única
// Função: Detecta intenção → define setor → atribui atendente OU enfileira
// NÃO envia boas-vindas (fica pro skill 3 ou para atendente)
// Prioriza: Pattern Match → LLM → Keywords → Fallback
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PATTERNS_RAPIDOS = {
  vendas: /orcamento|orçamento|cotacao|cotação|preco|preço|quanto custa|tabela|produto|comprar|vender|gamer|notebook|pc|processador|placa|memoria|memoria|ram/i,
  financeiro: /boleto|fatura|nota fiscal|nf|pagamento|cobranca|cobrança|vencimento|atrasado|dinheiro|pagou|pagar|débito/i,
  assistencia: /defeito|quebrou|nao funciona|não funciona|conserto|reparo|problema|bug|erro|nao liga|não liga|travado|lento|suporte|help/i,
  fornecedor: /fornecedor|fornecimento|compras|pedido|cotacao|cotação|estoque|entrega|pedido/i
};

async function buscarAtendenteOtimizado(base44, setor) {
  try {
    // Ordenar por CARGA ASC (menor carregado) + TEMPO DESC (quem esperou mais)
    const usuarios = await base44.asServiceRole.entities.User.filter({
      attendant_sector: setor,
      is_whatsapp_attendant: true,
      availability_status: { $in: ['online', 'disponível'] }
    }, 'current_conversations_count', 15);

    if (!usuarios || usuarios.length === 0) {
      console.log(`[SKILL-ROUTER] ⚠️ Nenhum atendente em ${setor} — tentando 'geral'`);
      const usuariosGeral = await base44.asServiceRole.entities.User.filter({
        attendant_sector: 'geral',
        is_whatsapp_attendant: true,
        availability_status: { $in: ['online', 'disponível'] }
      }, 'current_conversations_count', 15);
      if (usuariosGeral && usuariosGeral.length > 0) {
        return { atendente: usuariosGeral[0], setorUsado: 'geral', setorSolicitado: setor };
      }
      return null;
    }

    // Ordenar: carga ASC (menos ocupado primeiro)
    const sorted = usuarios.sort((a, b) => {
      const cargaA = a.current_conversations_count || 0;
      const cargaB = b.current_conversations_count || 0;
      if (cargaA !== cargaB) return cargaA - cargaB;
      // Desempate: quem ficou mais tempo sem atender
      const tempoA = (a.last_assigned_at ? new Date(a.last_assigned_at).getTime() : Infinity);
      const tempoB = (b.last_assigned_at ? new Date(b.last_assigned_at).getTime() : Infinity);
      return tempoA - tempoB;
    });

    return { atendente: sorted[0], setorUsado: setor, setorSolicitado: setor };
  } catch (e) {
    console.warn('[SKILL-ROUTER] Erro buscar atendente:', e.message);
    return null;
  }
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const tsInicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const { thread_id, contact_id } = payload;

    if (!thread_id || !contact_id) {
      return Response.json(
        { success: false, error: 'thread_id e contact_id obrigatórios' },
        { status: 400, headers }
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 1: Buscar contexto
    // ══════════════════════════════════════════════════════════════════
    const [thread, contact, mensagens] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.get(thread_id),
      base44.asServiceRole.entities.Contact.get(contact_id),
      base44.asServiceRole.entities.Message.filter(
        { thread_id, sender_type: 'contact' },
        '-created_date',
        10
      ).catch(() => [])
    ]);

    // Texto completo (últimos 500 chars)
    let textoCompleto = (mensagens || [])
      .map(m => m.content)
      .filter(Boolean)
      .join(' ');
    if (textoCompleto.length > 500) {
      textoCompleto = textoCompleto.slice(-500);
    }

    console.log(`[SKILL-ROUTER] 🎯 Analisando intenção: ${textoCompleto.substring(0, 50)}...`);

    // ══════════════════════════════════════════════════════════════════
    // STEP 2: Pattern Match (prioridade 1)
    // ══════════════════════════════════════════════════════════════════
    let setorDetectado = null;
    let metodo = 'fallback';
    let confidence = 0.5;

    for (const [setor, regex] of Object.entries(PATTERNS_RAPIDOS)) {
      if (regex.test(textoCompleto)) {
        setorDetectado = setor;
        metodo = 'pattern_match';
        confidence = 0.95;
        console.log(`[SKILL-ROUTER] 🎯 Pattern Match: ${setor} (0.95)`);
        break;
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 3: LLM (prioridade 2) — só se pattern não detectou
    // ══════════════════════════════════════════════════════════════════
    if (!setorDetectado || confidence < 0.75) {
      try {
        const respLLM = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: 'gemini_3_flash',
          prompt: `Classifique em 1 palavra qual é o setor:

MENSAGEM: "${textoCompleto}"
TIPO CONTATO: ${contact.tipo_contato || 'novo'}

Setor: vendas | assistencia | financeiro | fornecedor
Confidence: 0.0 a 1.0`,
          response_json_schema: {
            type: 'object',
            properties: {
              setor: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        });

        if (respLLM?.setor) {
          setorDetectado = respLLM.setor;
          confidence = respLLM.confidence || 0.75;
          metodo = 'llm';
          console.log(`[SKILL-ROUTER] 🧠 LLM: ${setor} (${confidence})`);
        }
      } catch (e) {
        console.warn('[SKILL-ROUTER] ⚠️ LLM falhou:', e.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 4: Fallback final
    // ══════════════════════════════════════════════════════════════════
    if (!setorDetectado) {
      setorDetectado = 'vendas';
      confidence = 0.5;
      metodo = 'fallback';
    }

    console.log(`[SKILL-ROUTER] ✅ Setor final: ${setorDetectado} (${(confidence * 100).toFixed(0)}%)`);

    // ══════════════════════════════════════════════════════════════════
    // STEP 5: Buscar atendente + rotear
    // ══════════════════════════════════════════════════════════════════
    const atendenteInfo = await buscarAtendenteOtimizado(base44, setorDetectado);

    if (atendenteInfo?.atendente) {
      // Atribuir
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        assigned_user_id: atendenteInfo.atendente.id,
        sector_id: atendenteInfo.setorUsado,
        routing_stage: 'COMPLETED',
        pre_atendimento_state: 'COMPLETED',
        pre_atendimento_ativo: false
      });

      console.log(`[SKILL-ROUTER] ✅ Atribuído para ${atendenteInfo.atendente.full_name} (${atendenteInfo.setorUsado})`);

      return Response.json({
        success: true,
        action: 'atribuido',
        setor: atendenteInfo.setorUsado,
        atendente: atendenteInfo.atendente.full_name,
        metodo,
        confidence,
        duration_ms: Date.now() - tsInicio
      }, { headers });
    } else {
      // Enfileirar
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id,
        thread_id,
        tipo: 'manual',
        reason: 'sem_atendente',
        severity: 'high',
        status: 'open',
        notes: `Router detectou: ${setorDetectado}. Sem atendente disponível.`
      });

      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        sector_id: setorDetectado,
        routing_stage: 'ROUTED',
        pre_atendimento_state: 'WAITING_ATTENDANT_CHOICE'
      });

      console.log(`[SKILL-ROUTER] 📋 Enfileirado: setor ${setorDetectado}`);

      // Disparar skill 3 (Queue Manager) para manter conversa ativa
      base44.asServiceRole.functions.invoke('skill_03_queue_manager', {
        thread_id,
        contact_id,
        setor: setorDetectado
      }).catch(e => console.warn('[SKILL-ROUTER] ⚠️ Queue Manager falhou:', e.message));

      return Response.json({
        success: true,
        action: 'enfileirado',
        setor: setorDetectado,
        metodo,
        confidence,
        queue_manager_triggered: true,
        duration_ms: Date.now() - tsInicio
      }, { headers });
    }

  } catch (error) {
    console.error('[SKILL-ROUTER] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});