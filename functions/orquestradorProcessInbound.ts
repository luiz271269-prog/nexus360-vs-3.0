// ============================================================================
// ORQUESTRADOR — Skills de Pré-Atendimento Autônomo v2.0
// ============================================================================
// Colar este trecho NO LUGAR do bloco antigo de pré-atendimento no processInbound
// Configuração: 2 ENV vars + 2 ConfiguracaoSistema records
// ============================================================================

/**
 * BLOCO PARA COLAR NO processInbound (substitui pré-atendimento antigo)
 * 
 * Posição: Após validação de contato/thread, ANTES de qualquer automação
 * Guard: Apenas para threads externas SEM atendente
 */

// ════════════════════════════════════════════════════════════════════════════
// SKILL 01 — ACK IMEDIATO (fire-and-forget)
// ════════════════════════════════════════════════════════════════════════════

if (message?.sender_type === 'contact' && thread?.thread_type === 'contact_external') {
  // Fire-and-forget: não aguarda resposta
  base44.asServiceRole.functions.invoke('skillACKImediato', {
    thread_id: thread.id,
    contact_id: contact.id,
    integration_id: thread.whatsapp_integration_id || integration?.id
  }).then(() => {
    console.log(`[ORQUESTR] ✅ ACK Imediato enviado para ${contact?.nome}`);
    result.pipeline.push('ack_imediato_sent');
  }).catch(err => {
    console.warn(`[ORQUESTR] ⚠️ ACK Imediato falhou: ${err.message}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SKILL 02 — INTENT ROUTER (await - crítico para decisão)
// ════════════════════════════════════════════════════════════════════════════

let routerResult = null;

if (message?.sender_type === 'contact' && !thread?.assigned_user_id && thread?.thread_type === 'contact_external') {
  try {
    console.log(`[ORQUESTR] 🧠 Acionando Intent Router para thread ${thread.id}`);
    
    const respRouter = await base44.asServiceRole.functions.invoke('skillIntentRouter', {
      thread_id: thread.id,
      contact_id: contact.id,
      message_content: messageContent || ''
    });

    if (respRouter?.data?.success) {
      routerResult = respRouter.data;
      result.pipeline.push('intent_router_ok');

      console.log(`[ORQUESTR] 🎯 Intent detectado: ${routerResult.setor} (conf: ${(routerResult.confidence * 100).toFixed(0)}%)`);
    }
  } catch (err) {
    console.error(`[ORQUESTR] ❌ Intent Router falhou: ${err.message}`);
    result.pipeline.push('intent_router_failed');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DECISÃO: confidence >= threshold?
// ════════════════════════════════════════════════════════════════════════════

let shouldSkillQueue = false;
let thresholdUsado = 0.65;

if (routerResult?.confidence !== undefined) {
  // Buscar threshold do banco
  try {
    const configThreshold = await base44.asServiceRole.entities.ConfiguracaoSistema.filter(
      { chave: 'ai_router_confidence_threshold' },
      'chave',
      1
    );
    if (configThreshold?.length > 0) {
      thresholdUsado = configThreshold[0].valor?.value || 0.65;
    }
  } catch (e) {
    console.warn(`[ORQUESTR] ⚠️ Erro ao buscar threshold: ${(e as any).message}`);
  }

  shouldSkillQueue = routerResult.confidence >= thresholdUsado;

  console.log(`[ORQUESTR] 📊 Confidence ${(routerResult.confidence * 100).toFixed(0)}% >= threshold ${(thresholdUsado * 100).toFixed(0)}%? ${shouldSkillQueue ? 'SIM → SKILL 03' : 'NÃO → Menu URA'}`);
}

// ════════════════════════════════════════════════════════════════════════════
// SKILL 03 — QUEUE MANAGER (se confidence OK)
// ════════════════════════════════════════════════════════════════════════════

if (shouldSkillQueue && routerResult && !thread?.assigned_user_id) {
  try {
    console.log(`[ORQUESTR] 📋 Acionando Queue Manager para setor ${routerResult.setor}`);

    const respQueue = await base44.asServiceRole.functions.invoke('skillQueueManager', {
      thread_id: thread.id,
      contact_id: contact.id,
      integration_id: thread.whatsapp_integration_id || integration?.id,
      sector_id: routerResult.setor
    });

    if (respQueue?.data?.success) {
      const queueResult = respQueue.data;
      result.pipeline.push('queue_manager_ok');

      if (queueResult.action === 'assigned') {
        console.log(`[ORQUESTR] ✅ Atribuído para ${queueResult.atendente_nome}`);
        result.actions.push('contato_atribuido_automaticamente');
        // ✅ FIX: RETURN para evitar duplicação
        return Response.json({
          success: true,
          pipeline: result.pipeline,
          actions: result.actions,
          handled_by: 'skill_queue_assigned'
        });
      } else if (queueResult.action === 'queued') {
        console.log(`[ORQUESTR] 📋 Enfileirado em ${routerResult.setor}`);
        result.actions.push('contato_enfileirado_automaticamente');
        // ✅ FIX: RETURN para evitar duplicação
        return Response.json({
          success: true,
          pipeline: result.pipeline,
          actions: result.actions,
          handled_by: 'skill_queue_queued'
        });
      }
    }
  } catch (err) {
    console.error(`[ORQUESTR] ❌ Queue Manager falhou: ${err.message}`);
    result.pipeline.push('queue_manager_failed');
    // ✅ FIX: Continuar para fallback se falhar
  }
  }

// ════════════════════════════════════════════════════════════════════════════
// FALLBACK: Menu URA clássico (confidence < threshold)
// ════════════════════════════════════════════════════════════════════════════

if (!shouldSkillQueue || !routerResult) {
  console.log(`[ORQUESTR] 📞 Confidence baixa ou roteador falhou → acionando Menu URA clássico`);
  
  try {
    await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
      thread_id: thread.id,
      contact_id: contact.id,
      whatsapp_integration_id: thread.whatsapp_integration_id,
      user_input: { type: 'system', content: '' }
    });
    
    result.pipeline.push('pre_atendimento_menu');
    result.actions.push('menu_ura_acionado');
  } catch (err) {
    console.error(`[ORQUESTR] ❌ Menu URA falhou: ${err.message}`);
    result.actions.push('ura_fallback_failed');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FIM DO ORQUESTRADOR
// ════════════════════════════════════════════════════════════════════════════

/**
 * CONFIGURAÇÃO NECESSÁRIA:
 * 
 * 1. ENV VARS (Settings → Environment)
 *    - Opcional, para monitoramento
 * 
 * 2. ConfiguracaoSistema records (inserir no banco):
 * 
 *    {
 *      "chave": "ai_router_confidence_threshold",
 *      "categoria": "pre_atendimento",
 *      "valor": { "value": 0.65 },
 *      "descricao": "Threshold mínimo de confiança para roteamento automático (0.0-1.0)",
 *      "ativa": true
 *    }
 * 
 *    {
 *      "chave": "horario_comercial",
 *      "categoria": "pre_atendimento",
 *      "valor": { "inicio": 8, "fim": 18, "dias": [1,2,3,4,5] },
 *      "descricao": "Horário comercial (dias 0=dom, 6=sab)",
 *      "ativa": true
 *    }
 * 
 * 3. Adicionar jarvisEventLoop (já existe):
 *    a cada 5 minutos, chamar:
 * 
 *    await base44.asServiceRole.functions.invoke('skillSLAGuardian', {})
 * 
 * 4. Confirmar campos no banco:
 *    - MessageThread: routing_stage, sector_id, assigned_user_id, 
 *      entrou_na_fila_em, jarvis_next_check_after, jarvis_last_playbook
 *    - Contact: tipo_contato, is_vip, classe_abc, 
 *      atendente_fidelizado_vendas/assistencia/financeiro/fornecedor
 *    - User: attendant_sector, current_conversations_count
 */