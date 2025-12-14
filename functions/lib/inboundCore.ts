// ============================================================================
// NÚCLEO ÚNICO DE PROCESSAMENTO INBOUND - v9.0.0
// ============================================================================
// Pipeline imutável usado por Z-API e W-API
// ============================================================================

/**
 * Detecta se é um novo ciclo de conversa (abertura de ciclo)
 * Critério único: gap >= 12h desde última inbound
 */
export function detectNovoCiclo(lastInboundAt, now) {
  if (!lastInboundAt) return true; // Primeira mensagem sempre é novo ciclo
  
  const lastDate = new Date(lastInboundAt);
  const hoursGap = (now - lastDate) / (1000 * 60 * 60);
  
  return hoursGap >= 12;
}

/**
 * Verifica se humano está ativo (não stale)
 */
export function humanoAtivo(thread, horasStale = 8) {
  if (!thread.assigned_user_id) return false;
  if (!thread.last_message_at) return false;
  
  const lastMessageDate = new Date(thread.last_message_at);
  const now = new Date();
  const hoursGap = (now - lastMessageDate) / (1000 * 60 * 60);
  
  return hoursGap < horasStale;
}

/**
 * Pipeline único e imutável de processamento inbound
 */
export async function processInboundEvent(params) {
  const { 
    base44, 
    contact, 
    thread, 
    message, 
    integration,
    provider,
    messageContent 
  } = params;
  
  const now = new Date();
  const result = {
    pipeline: [],
    actions: []
  };
  
  // ============================================================================
  // ORDEM IMUTÁVEL DO PIPELINE
  // ============================================================================
  
  // (1) MICRO-URA: Processar resposta 1/2 se pendente
  result.pipeline.push('micro_ura_check');
  if (thread.transfer_pending) {
    const { pedidoExpirou } = await import('./detectorPedidoTransferencia.js');
    
    if (pedidoExpirou(thread)) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        transfer_pending: false,
        transfer_requested_sector_id: null,
        transfer_requested_user_id: null,
        transfer_confirmed: false,
        transfer_expires_at: null
      });
      result.actions.push('micro_ura_expired');
    } else {
      const resposta = messageContent?.trim();
      
      if (resposta === '1' || resposta.toLowerCase().includes('sim')) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          transfer_confirmed: true
        });
        result.actions.push('micro_ura_confirmed');
        return { ...result, consumed: true, action: 'micro_ura_confirmed' };
      }
      
      if (resposta === '2' || resposta.toLowerCase().includes('nao') || resposta.toLowerCase().includes('não')) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          transfer_pending: false,
          transfer_requested_sector_id: null,
          transfer_requested_user_id: null,
          transfer_confirmed: false,
          transfer_expires_at: null
        });
        result.actions.push('micro_ura_cancelled');
        return { ...result, consumed: true, action: 'micro_ura_cancelled' };
      }
    }
  }
  
  // (2) ATUALIZAR ENGAGEMENT STATE (pausar ciclos automáticos)
  result.pipeline.push('update_engagement_state');
  try {
    const existingStates = await base44.asServiceRole.entities.ContactEngagementState.filter({
      contact_id: contact.id,
      status: 'active'
    }, '-created_date', 1);
    
    if (existingStates.length > 0) {
      await base44.asServiceRole.entities.ContactEngagementState.update(existingStates[0].id, {
        status: 'paused',
        last_inbound_at: now.toISOString(),
        last_thread_id: thread.id
      });
      result.actions.push('engagement_paused');
    }
  } catch (e) {
    console.error('[CORE] Erro ao atualizar engagement:', e.message);
  }
  
  // (3) HARD-STOP: Humano ativo (não stale)
  result.pipeline.push('human_check');
  if (humanoAtivo(thread)) {
    result.actions.push('human_active_stop');
    
    // Detectar novo pedido de transferência
    const { detectarPedidoTransferencia, podeEnviarPergunta } = await import('./detectorPedidoTransferencia.js');
    
    if (!thread.transfer_pending && podeEnviarPergunta(thread)) {
      let todosAtendentes = [];
      try {
        const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 100);
        todosAtendentes = usuarios.filter(u => u.full_name && (u.attendant_sector || u.setores_atendidos_ids?.length > 0));
      } catch (e) {}
      
      const deteccao = detectarPedidoTransferencia(messageContent, todosAtendentes);
      
      if (deteccao.solicitou) {
        result.actions.push('new_transfer_detected');
        
        const atendenteAtual = todosAtendentes.find(a => a.id === thread.assigned_user_id);
        const nomeAtendente = atendenteAtual?.full_name || 'seu atendente atual';
        
        let pergunta = `Você quer que eu transfira `;
        if (deteccao.setor) pergunta += `para *${deteccao.setor.charAt(0).toUpperCase() + deteccao.setor.slice(1)}*`;
        if (deteccao.nome_atendente) pergunta += ` (*${deteccao.nome_atendente}*)`;
        pergunta += ` agora?\n\n1️⃣ Sim, transferir\n2️⃣ Não, continuar com ${nomeAtendente}`;
        
        // Enviar micro-URA
        await enviarMensagem({ base44, integration, contact, message: pergunta, provider });
        
        const expiraEm = new Date();
        expiraEm.setMinutes(expiraEm.getMinutes() + 5);
        
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          transfer_pending: true,
          transfer_requested_sector_id: deteccao.setor,
          transfer_requested_user_id: deteccao.atendente_id,
          transfer_requested_text: deteccao.texto_original,
          transfer_requested_at: now.toISOString(),
          transfer_confirmed: false,
          transfer_expires_at: expiraEm.toISOString(),
          transfer_last_prompt_at: now.toISOString()
        });
      }
    }
    
    return { ...result, stop: true, reason: 'human_active' };
  }
  
  // (4) DETECTOR DE CICLO (independente de URA/saudação)
  result.pipeline.push('cycle_detection');
  const novoCiclo = detectNovoCiclo(thread.last_message_at, now);
  result.novoCiclo = novoCiclo;
  
  if (novoCiclo) {
    result.actions.push('new_cycle_detected');
  }
  
  // (5) PROMOÇÕES (se novo ciclo, ANTES de sticky/URA)
  result.pipeline.push('promotions');
  if (novoCiclo) {
    try {
      const { maybeSendPromotions } = await import('./promotionEngine.js');
      const promoResult = await maybeSendPromotions({
        base44,
        contact,
        thread,
        integration,
        now,
        provider
      });
      
      if (promoResult.sent) {
        result.actions.push('promotion_sent');
      }
    } catch (e) {
      console.error('[CORE] Erro ao processar promoções:', e.message);
    }
  }
  
  // (6) GUARDAS DE ROTEAMENTO
  result.pipeline.push('routing_guards');
  
  // 6.1 Fornecedor/Compras
  const { ehFornecedorOuCompras } = await import('./roteadorCentral.js');
  if (ehFornecedorOuCompras(contact, thread)) {
    result.actions.push('routing_fornecedor');
    const { aplicarRoteamentoFornecedor } = await import('./roteadorCentral.js');
    await aplicarRoteamentoFornecedor(base44, thread, contact);
    return { ...result, routed: true, to: 'fornecedor' };
  }
  
  // 6.2 Fidelizado
  const { classificarContato } = await import('./roteadorCentral.js');
  const classificacao = classificarContato(contact);
  
  if (classificacao.fidelizado) {
    result.actions.push('routing_fidelizado');
    const { aplicarRoteamentoFidelizado } = await import('./roteadorCentral.js');
    await aplicarRoteamentoFidelizado(base44, thread, contact);
    return { ...result, routed: true, to: 'fidelizado' };
  }
  
  // (7) URA ATIVA: Processar resposta
  result.pipeline.push('ura_active_check');
  if (thread.pre_atendimento_ativo === true) {
    result.actions.push('ura_processing_response');
    
    const { processarURA } = await import('./uraProcessor.js');
    await processarURA({
      base44,
      action: 'processar_resposta',
      thread_id: thread.id,
      contact_id: contact.id,
      integration_id: integration?.id,
      resposta_usuario: messageContent,
      provider
    });
    
    return { ...result, ura_processed: true };
  }
  
  // (8) REABERTURA: Decidir modo (sticky, mini, full)
  result.pipeline.push('reopening_decision');
  
  const SAUDACOES = [
    'oi', 'olá', 'ola', 'oie', 'oii', 'oiii',
    'bom dia', 'boa tarde', 'boa noite',
    'bomdia', 'boatarde', 'boanoite',
    'hey', 'hello', 'hi',
    'e aí', 'e ai', 'eai', 'eae',
    'tudo bem', 'tudo bom', 'como vai',
    'opa', 'fala', 'salve'
  ];
  
  const mensagemLower = (messageContent || '').toLowerCase().trim();
  const isSaudacao = SAUDACOES.some(s => 
    mensagemLower === s || 
    mensagemLower.startsWith(s + ' ') || 
    mensagemLower.startsWith(s + ',') || 
    mensagemLower.startsWith(s + '!')
  );
  
  if (novoCiclo && isSaudacao) {
    const { decidirReabertura } = await import('./roteadorCentral.js');
    const decisao = decidirReabertura(thread, now, 12);
    result.actions.push(`reopening_${decisao.modo}`);
    
    // STICKY SETOR
    if (decisao.modo === 'sticky' && thread.sector_id) {
      const { aplicarStickySetor } = await import('./uraProcessor.js');
      await aplicarStickySetor(base44, thread, contact, integration?.id, provider);
      return { ...result, reopened: true, mode: 'sticky' };
    }
    
    // MINI-URA (TODO: Fase 2)
    if (decisao.modo === 'mini') {
      // Por enquanto, fallback para sticky
      if (thread.sector_id) {
        const { aplicarStickySetor } = await import('./uraProcessor.js');
        await aplicarStickySetor(base44, thread, contact, integration?.id, provider);
        return { ...result, reopened: true, mode: 'mini_fallback_sticky' };
      }
    }
    
    // FULL URA
    if (decisao.modo === 'full') {
      result.actions.push('starting_full_ura');
      const { processarURA } = await import('./uraProcessor.js');
      await processarURA({
        base44,
        action: 'iniciar',
        thread_id: thread.id,
        contact_id: contact.id,
        integration_id: integration?.id,
        provider
      });
      return { ...result, ura_started: true };
    }
  }
  
  // (9) MENSAGEM NORMAL
  result.pipeline.push('normal_message');
  result.actions.push('message_normal');
  
  return result;
}

/**
 * Helper para enviar mensagens
 */
async function enviarMensagem(params) {
  const { base44, integration, contact, message, provider } = params;
  
  if (!integration) return;
  
  try {
    if (provider === 'z_api') {
      const zapiUrl = `${integration.base_url_provider}/instances/${integration.instance_id_provider}/token/${integration.api_key_provider}/send-text`;
      const zapiHeaders = { 'Content-Type': 'application/json' };
      if (integration.security_client_token_header) {
        zapiHeaders['Client-Token'] = integration.security_client_token_header;
      }
      
      await fetch(zapiUrl, {
        method: 'POST',
        headers: zapiHeaders,
        body: JSON.stringify({ phone: contact.telefone, message })
      });
      
    } else if (provider === 'w_api') {
      const wapiUrl = `${integration.base_url_provider}/messages/send/text`;
      const wapiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.api_key_provider}`
      };
      
      await fetch(wapiUrl, {
        method: 'POST',
        headers: wapiHeaders,
        body: JSON.stringify({
          instanceId: integration.instance_id_provider,
          number: contact.telefone,
          text: message
        })
      });
    }
    
    // Registrar mensagem
    await base44.asServiceRole.entities.Message.create({
      thread_id: params.thread?.id,
      sender_id: 'system',
      sender_type: 'user',
      content: message,
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      metadata: {
        whatsapp_integration_id: integration.id,
        is_system_message: true,
        sent_by_core: true
      }
    });
  } catch (e) {
    console.error('[CORE] Erro ao enviar mensagem:', e.message);
  }
}