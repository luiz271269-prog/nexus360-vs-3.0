// ============================================================================
// NÚCLEO ÚNICO DE PROCESSAMENTO INBOUND - v10.0.0 LINHA IMUTÁVEL
// ============================================================================
// Pipeline imutável: Webhook → Core → (Guardas) → PreAtendimentoHandler
// ============================================================================

const VERSION = 'v10.0.0-IMMUTABLE-LINE';

// =================================================================
// 🛡️ HELPERS DE DECISÃO
// =================================================================

/**
 * Normaliza a entrada de qualquer provedor para um contrato único
 */
function normalizarEntrada(payload, messageContent) {
  let input = { type: 'text', content: messageContent || '', id: null };

  // Detectar botões (Cloud API, Z-API, W-API)
  if (payload.type === 'button_reply' || (payload.message && payload.message.type === 'button')) {
    input.type = 'button';
    input.id = payload.button_id || payload.selectedId || payload.button_reply?.id;
    input.content = payload.button_reply?.title || payload.button_reply?.text || input.content;
  } else if (payload.list_reply) {
    input.type = 'list';
    input.id = payload.list_reply.id;
    input.content = payload.list_reply.title;
  }
  
  return input;
}

/**
 * Detecta se é um novo ciclo de conversa (Gap >= 12h desde última inbound)
 */
export function detectNovoCiclo(lastInboundAt, now) {
  if (!lastInboundAt) return true;
  const lastDate = new Date(lastInboundAt);
  const hoursGap = (now - lastDate) / (1000 * 60 * 60);
  return hoursGap >= 12;
}

/**
 * Verifica se humano está ativo (não stale)
 * FONTE DE VERDADE: last_human_message_at (ignora mensagens automáticas e do cliente)
 */
export function humanoAtivo(thread, horasStale = 2) {
  // Se não tem ninguém atribuído, não há humano ativo
  if (!thread.assigned_user_id) return false;
  
  // URA explicitamente ativa bloqueia a percepção de "humano no controle"
  if (thread.pre_atendimento_ativo) return false;
  
  // Se nunca houve uma mensagem humana nesta thread
  if (!thread.last_human_message_at) return false;
  
  const lastHumanDate = new Date(thread.last_human_message_at);
  const now = new Date();
  const hoursGap = (now - lastHumanDate) / (1000 * 60 * 60);
  
  // Humano ativo apenas se falou nas últimas 2h (ou janela configurada)
  return hoursGap < horasStale;
}

// =================================================================
// 🚀 PIPELINE IMUTÁVEL DE PROCESSAMENTO (THE CORE)
// =================================================================

export async function processInboundEvent(params) {
  const { 
    base44, 
    contact, 
    thread, 
    message, 
    integration,
    provider,
    messageContent,
    rawPayload
  } = params;
  
  const now = new Date();
  const result = {
    pipeline: [],
    actions: []
  };
  
  // 1. NORMALIZAÇÃO DE INPUT (Contrato Único)
  const userInput = normalizarEntrada(rawPayload || {}, messageContent);
  result.pipeline.push('input_normalized');
  
  // ============================================================================
  // 🛡️ IDEMPOTÊNCIA CRÍTICA - Proteção contra duplicação (REPLAY SAFE)
  // ============================================================================
  result.pipeline.push('idempotency_check');
  
  if (message.whatsapp_message_id && integration?.id) {
    try {
      const existingMsg = await base44.asServiceRole.entities.Message.filter({
        whatsapp_message_id: message.whatsapp_message_id,
        'metadata.whatsapp_integration_id': integration.id
      }, '-created_date', 1);
      
      if (existingMsg && existingMsg.length > 0) {
        console.log(`[CORE] ⏭️ DUPLICATA DETECTADA: ${message.whatsapp_message_id} (já existe: ${existingMsg[0].id})`);
        result.actions.push('skipped_duplicate');
        return {
          ...result,
          status: 'skipped',
          skipped: true,
          reason: 'duplicate_whatsapp_message_id',
          existing_message_id: existingMsg[0].id
        };
      }
      console.log(`[CORE] ✅ Idempotência OK: ${message.whatsapp_message_id} (nova mensagem)`);
    } catch (e) {
      console.warn('[CORE] ⚠️ Erro ao verificar duplicata:', e.message);
    }
  }
  
  // ============================================================================
  // 🛑 KILL SWITCH - RESET DO FUNIL DE PROMOÇÕES (PRIORIDADE MÁXIMA)
  // ============================================================================
  if (message.sender_type === 'contact') {
    result.pipeline.push('promotion_reset');
    
    if (thread.autoboost_stage || thread.last_boost_at || thread.promo_cooldown_expires_at) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        autoboost_stage: null,
        last_boost_at: null,
        promo_cooldown_expires_at: null
      });
      result.actions.push('reset_promotion_funnel');
    }
    
    // Contabilizar resposta na Promoção
    if (contact.last_promo_id) {
      try {
        const promo = await base44.asServiceRole.entities.Promotion.get(contact.last_promo_id);
        if (promo) {
          await base44.asServiceRole.entities.Promotion.update(promo.id, {
            contador_respostas: (promo.contador_respostas || 0) + 1
          });
          result.actions.push('counted_promo_response');
        }
      } catch (e) {
        console.warn('[CORE] ⚠️ Erro ao contabilizar resposta da promoção:', e.message);
      }
    }
  }
  
  // ============================================================================
  // 2. SAFETY CHECKS & MICRO-URA (Bloqueios Prioritários)
  // ============================================================================
  
  result.pipeline.push('micro_ura_check');
  if (thread.transfer_pending) {
    const { pedidoExpirou } = await import('./detectorPedidoTransferencia.js');
    
    // Se o pedido de transferência expirou, limpar estado
    if (pedidoExpirou(thread)) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        transfer_pending: false,
        transfer_requested_sector_id: null,
        transfer_requested_user_id: null,
        transfer_confirmed: false,
        transfer_expires_at: null,
        transfer_last_prompt_at: null
      });
      result.actions.push('micro_ura_expired');
    } else if (message.sender_type === 'contact') {
      // Nova mensagem do contato com micro-URA pendente
      const resposta = userInput.content?.trim().toLowerCase() || '';
      
      // Processar respostas claras
      if (resposta === '1' || resposta.includes('sim') || resposta.includes('quero')) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          transfer_confirmed: true
        });
        result.actions.push('micro_ura_confirmed');
        return { ...result, consumed: true, action: 'micro_ura_confirmed' };
      }
      
      if (resposta === '2' || resposta.includes('nao') || resposta.includes('não') || resposta.includes('cancelar')) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          transfer_pending: false,
          transfer_requested_sector_id: null,
          transfer_requested_user_id: null,
          transfer_confirmed: false,
          transfer_expires_at: null,
          transfer_last_prompt_at: null
        });
        result.actions.push('micro_ura_cancelled');
        // NÃO retorna - deixa processar como mensagem normal
      } else if (resposta.length > 3) {
        // Qualquer outra mensagem relevante cancela micro-URA
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          transfer_pending: false,
          transfer_requested_sector_id: null,
          transfer_requested_user_id: null,
          transfer_confirmed: false,
          transfer_expires_at: null,
          transfer_last_prompt_at: null
        });
        result.actions.push('micro_ura_auto_cancelled');
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
        await enviarMensagem({ base44, integration, contact, message: pergunta, provider, thread });
        
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
  const novoCiclo = detectNovoCiclo(thread.last_inbound_at, now); // ✅ USAR last_inbound_at ao invés de last_message_at
  result.novoCiclo = novoCiclo;
  
  if (novoCiclo) {
    result.actions.push('new_cycle_detected');
  }
  
  // ============================================================================
  // 🗓️ ROTEAMENTO AGENDA IA (NOVO RAMO - NÃO INTRUSIVO)
  // ============================================================================
  result.pipeline.push('agenda_ia_check');
  
  // LOG DETALHADO DE DIAGNÓSTICO
  console.log('[CORE] 🔍 AGENDA IA CHECK:', {
    assistant_mode: thread.assistant_mode,
    integration_name: integration?.nome_instancia,
    contact_telefone: contact?.telefone,
    should_route: thread.assistant_mode === 'agenda' || 
                  integration?.nome_instancia === 'NEXUS_AGENDA_INTEGRATION' ||
                  contact?.telefone === '+5548999142800'
  });
  
  // Verificar se deve rotear para Agenda IA
  if (thread.assistant_mode === 'agenda' || 
      integration?.nome_instancia === 'NEXUS_AGENDA_INTEGRATION' ||
      contact?.telefone === '+5548999142800') {
    
    console.log('[CORE] 🗓️ Thread elegível para Agenda IA - ROTEANDO');
    result.actions.push('routing_to_agenda_ia');
    
    try {
      const agendaResult = await base44.asServiceRole.functions.invoke('routeToAgendaIA', {
        thread_id: thread.id,
        message_id: message.id,
        content: userInput.content,
        from_type: message.sender_type === 'user' ? 'internal_user' : 'external_contact',
        from_id: message.sender_id
      });
      
      if (agendaResult.data?.routed && agendaResult.data?.result?.message_to_send) {
        // Enviar resposta da Agenda IA
        await enviarMensagem({ 
          base44, 
          integration, 
          contact, 
          message: agendaResult.data.result.message_to_send, 
          provider, 
          thread 
        });
        
        result.actions.push('agenda_ia_response_sent');
      }
      
      return { ...result, routed: true, to: 'agenda_ia', agenda_result: agendaResult.data };
      
    } catch (e) {
      console.error('[CORE] ❌ Erro ao rotear para Agenda IA:', e.message);
      result.actions.push('agenda_ia_routing_failed');
      // Não bloqueia - continua fluxo normal
    }
  }
  
  // (5) GUARDAS DE ROTEAMENTO
  result.pipeline.push('routing_guards');
  
  // 5.1 Fornecedor/Compras
  const { ehFornecedorOuCompras } = await import('./roteadorCentral.js');
  if (ehFornecedorOuCompras(contact, thread)) {
    result.actions.push('routing_fornecedor');
    const { aplicarRoteamentoFornecedor } = await import('./roteadorCentral.js');
    await aplicarRoteamentoFornecedor(base44, thread, contact);
    return { ...result, routed: true, to: 'fornecedor' };
  }
  
  // 5.2 Fidelizado
  const { classificarContato } = await import('./roteadorCentral.js');
  const classificacao = classificarContato(contact);
  
  if (classificacao.fidelizado) {
    result.actions.push('routing_fidelizado');
    const { aplicarRoteamentoFidelizado } = await import('./roteadorCentral.js');
    await aplicarRoteamentoFidelizado(base44, thread, contact);
    return { ...result, routed: true, to: 'fidelizado' };
  }
  
  // ============================================================================
  // 6. DECISOR DE CICLO E INTELIGÊNCIA (O Cérebro)
  // ============================================================================

  let intentContext = null;
  
  // ✅ CORREÇÃO: Declarar isUraActive ANTES de usar
  const isUraActive = thread.pre_atendimento_ativo === true;

  // Se é novo ciclo, não é URA ativa, e é texto (não botão), usar IA
  if (novoCiclo && !isUraActive && userInput.type === 'text' && userInput.content.length > 2) {
    result.pipeline.push('analyzing_intent');
    
    try {
      const aiPayload = {
        mensagem: userInput.content,
        contexto: {
          historico_anterior: thread.sector_id,
          contact_id: contact.id,
          thread_id: thread.id
        }
      };
      
      const aiResponse = await base44.asServiceRole.functions.invoke('analisarIntencao', aiPayload);
      
      if (aiResponse?.data?.success && aiResponse.data.analise) {
        intentContext = aiResponse.data.analise;
        result.actions.push('intent_analyzed');
      }
    } catch (e) {
      console.warn('[CORE] Falha na IA de intenção, seguindo sem contexto:', e.message);
      result.actions.push('intent_analysis_failed');
    }
  }
  
  // =================================================================
  // 7. EXECUÇÃO DO PRÉ-ATENDIMENTO (GUARDIÃO INTELIGENTE v11)
  // =================================================================
  
  result.pipeline.push('pre_atendimento_dispatch');
  
  // ✅ isUraActive já foi declarado acima (linha ~275)
  const isHumanActive = humanoAtivo(thread, 2); // Janela estrita de 2h
  const isHumanDormant = thread.assigned_user_id && !isHumanActive; // Humano existe, mas dormiu
  
  let shouldDispatch = false;

  // 1. Se URA já manda, continua mandando.
  if (isUraActive) {
      shouldDispatch = true;
  }
  // 2. Se é Novo Ciclo (passou a noite), reseta tudo e chama URA.
  else if (novoCiclo) {
      shouldDispatch = true;
  }
  // 3. O CASO CRÍTICO: Humano existe mas está em silêncio (>2h)
  else if (isHumanDormant) {
      console.log('[CORE] 🔔 Humano ausente. URA assume.');
      shouldDispatch = true;
  }
  // 4. Sem humano e sem URA (limbo) -> Chama URA
  else if (!thread.assigned_user_id) {
      shouldDispatch = true;
  }

  if (shouldDispatch) {
    // ✅ BLOQUEIO CRÍTICO: Verificar se existe playbook de pré-atendimento ATIVO
    console.log('[CORE] 🎯 Verificando se playbooks de pré-atendimento estão ativos...');
    
    try {
      const playbooksPreAtendimento = await base44.asServiceRole.entities.FlowTemplate.filter({
        is_pre_atendimento_padrao: true,
        ativo: true
      }, '-created_date', 1);
      
      if (!playbooksPreAtendimento || playbooksPreAtendimento.length === 0) {
        console.log('[CORE] 🚫 Nenhum playbook de pré-atendimento ATIVO encontrado - BLOQUEANDO URA');
        result.actions.push('ura_blocked_no_active_playbook');
        return { ...result, stop: true, reason: 'pre_atendimento_desativado' };
      }
      
      console.log('[CORE] ✅ Playbook ativo encontrado:', playbooksPreAtendimento[0].nome);
      result.actions.push('ura_allowed_active_playbook');
      
    } catch (checkError) {
      console.error('[CORE] ⚠️ Erro ao verificar playbooks ativos:', checkError.message);
      result.actions.push('ura_check_failed');
      return { ...result, stop: true, reason: 'ura_check_error' };
    }
    
    result.actions.push('dispatching_to_ura');
    
    // Contrato Unificado para o Handler
    const payloadUnificado = {
      thread_id: thread.id,
      contact_id: contact.id,
      whatsapp_integration_id: integration?.id,
      user_input: userInput,
      intent_context: intentContext,
      is_new_cycle: novoCiclo,
      provider: provider,
      whatsappIntegration: integration
    };
    
    try {
      await base44.asServiceRole.functions.invoke('preAtendimentoHandler', payloadUnificado);
      result.actions.push('ura_dispatched');
    } catch (e) {
      console.error('[CORE] Erro ao disparar preAtendimentoHandler:', e.message);
      result.actions.push('ura_dispatch_failed');
    }
    
    return { ...result, handled_by_ura: true };
  }
  
  // Se chegou aqui, é mensagem solta em ciclo vigente sem URA ativa
  result.pipeline.push('normal_message');
  result.actions.push('message_in_cycle_no_ura');
  return result;
}

// =================================================================
// 📤 HELPER DE ENVIO
// =================================================================

// Emoji processing inline (evita import local)
function processTextWithEmojis(text) {
  return text; // Passthrough - emojis já são suportados nativamente
}
function emojiDebug(label, text) {
  console.log(`[EMOJI-${label}]`, text?.substring(0, 100));
}

async function enviarMensagem(params) {
  const { base44, integration, contact, message, provider, thread } = params;
  
  if (!integration) return;
  
  const processedMessage = processTextWithEmojis(message);
  emojiDebug('OUTBOUND_MESSAGE', processedMessage);
  
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
        body: JSON.stringify({ phone: contact.telefone, message: processedMessage })
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
          text: processedMessage
        })
      });
    }
    
    // Registrar mensagem
    await base44.asServiceRole.entities.Message.create({
      thread_id: thread?.id,
      sender_id: thread?.assigned_user_id || 'nexus_engine',
      sender_type: 'user',
      content: processedMessage,
      channel: 'whatsapp',
      visibility: 'internal_only',
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