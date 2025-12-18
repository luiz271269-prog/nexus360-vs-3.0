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
 */
export function humanoAtivo(thread, horasStale = 8) {
  if (!thread.assigned_user_id) return false;
  if (thread.pre_atendimento_ativo) return false; // URA ativa = humano não está no controle
  
  const lastMessageDate = new Date(thread.last_message_at);
  const now = new Date();
  const hoursGap = (now - lastMessageDate) / (1000 * 60 * 60);
  
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
  const novoCiclo = detectNovoCiclo(thread.last_message_at, now);
  result.novoCiclo = novoCiclo;
  
  if (novoCiclo) {
    result.actions.push('new_cycle_detected');
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
  
  const isUraActive = thread.pre_atendimento_ativo === true;
  let intentContext = null;
  
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
  
  // ============================================================================
  // 7. EXECUÇÃO DO PRÉ-ATENDIMENTO (O Motor Único)
  // ============================================================================
  
  result.pipeline.push('pre_atendimento_dispatch');
  
  // Regra: Chamamos o handler se URA ativa OU novo ciclo OU COMPLETED (handler trata TTL)
  const shouldDispatch = isUraActive || novoCiclo || 
    ['COMPLETED', 'CANCELLED', 'TIMEOUT'].includes(thread.pre_atendimento_state);
  
  if (shouldDispatch) {
    result.actions.push('dispatching_to_ura');
    
    // Contrato Unificado para o Handler
    const payloadUnificado = {
      thread_id: thread.id,
      contact_id: contact.id,
      whatsapp_integration_id: integration?.id,
      user_input: userInput,
      intent_context: intentContext,
      is_new_cycle: novoCiclo,
      provider: provider
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

import { processTextWithEmojis, emojiDebug } from './emojiHelper.js';

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
      sender_id: 'system',
      sender_type: 'user',
      content: processedMessage,
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