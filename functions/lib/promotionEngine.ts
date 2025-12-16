// ============================================================================
// PROMOTION ENGINE - Motor de Ofertas e Novidades Desacoplado da URA
// ============================================================================
// Versão 2.0 - Triggers: Inbound (6h) + Batch (24h)
// Totalmente independente da URA
// ============================================================================

import { processTextWithEmojis, emojiDebug } from './emojiHelper.js';

const PROMO_COOLDOWN_INBOUND_HOURS = 6;  // Janela para disparo inbound
const PROMO_COOLDOWN_BATCH_HOURS = 24;   // Janela para batch/campanha
const PROMO_COOLDOWN_HOURS_DEFAULT = 24;

/**
 * Bloqueios Absolutos - FORNECEDOR, FINANCEIRO, COMPRAS nunca recebem promos
 */
export function isBlockedFromPromotions(contact, thread, integration) {
  // Bloqueio 1: Tipo de contato
  if (contact.tipo_contato === 'fornecedor') {
    return { blocked: true, reason: 'blocked_tipo_fornecedor' };
  }
  
  // Bloqueio 2: Tags de fornecedor
  if (contact.tags && Array.isArray(contact.tags)) {
    if (contact.tags.includes('fornecedor') || contact.tags.includes('compras')) {
      return { blocked: true, reason: 'blocked_tag_fornecedor' };
    }
  }
  
  // Bloqueio 3: Setor da thread
  const setoresExcluidos = ['financeiro', 'cobranca', 'compras', 'fornecedor', 'fornecedores'];
  if (thread.sector_id && setoresExcluidos.includes(thread.sector_id.toLowerCase())) {
    return { blocked: true, reason: `blocked_setor_${thread.sector_id}` };
  }
  
  // Bloqueio 4: Integração/Canal
  if (integration) {
    if (integration.tipo_canal === 'financeiro' || integration.tipo_canal === 'cobranca') {
      return { blocked: true, reason: 'blocked_integration_financeira' };
    }
    if (integration.permite_promocao === false) {
      return { blocked: true, reason: 'blocked_integration_flag' };
    }
    const setoresCanalExcluidos = ['financeiro', 'cobranca', 'compras'];
    if (integration.setor_principal && setoresCanalExcluidos.includes(integration.setor_principal.toLowerCase())) {
      return { blocked: true, reason: `blocked_integration_setor_${integration.setor_principal}` };
    }
  }
  
  return { blocked: false };
}

/**
 * Verifica se pode enviar promoção respeitando cooldowns
 */
export function canSendPromoInbound(contact, thread, now, minHours = PROMO_COOLDOWN_INBOUND_HOURS) {
  // Cooldown por contato (última promo enviada)
  if (contact.last_promo_sent_at) {
    const lastPromoDate = new Date(contact.last_promo_sent_at);
    const hoursSinceLastPromo = (now - lastPromoDate) / (1000 * 60 * 60);
    
    if (hoursSinceLastPromo < minHours) {
      return { can: false, reason: 'cooldown_contact', hours: hoursSinceLastPromo.toFixed(1) };
    }
  }
  
  // Cooldown por thread (última promo nesta conversa)
  if (thread.thread_last_promo_sent_at) {
    const lastPromoDateThread = new Date(thread.thread_last_promo_sent_at);
    const hoursSinceLastPromoThread = (now - lastPromoDateThread) / (1000 * 60 * 60);
    
    if (hoursSinceLastPromoThread < minHours) {
      return { can: false, reason: 'cooldown_thread', hours: hoursSinceLastPromoThread.toFixed(1) };
    }
  }
  
  return { can: true };
}

export function canSendPromoBatch(contact, now, minHours = PROMO_COOLDOWN_BATCH_HOURS) {
  // Para batch, só verifica cooldown do contato
  if (contact.last_promo_sent_at) {
    const lastPromoDate = new Date(contact.last_promo_sent_at);
    const hoursSinceLastPromo = (now - lastPromoDate) / (1000 * 60 * 60);
    
    if (hoursSinceLastPromo < minHours) {
      return { can: false, reason: 'cooldown_batch', hours: hoursSinceLastPromo.toFixed(1) };
    }
  }
  
  return { can: true };
}

/**
 * Filtra promoções elegíveis para um contato específico
 */
export function filterEligiblePromotions(promotions, contact, thread) {
  const now = new Date();
  
  return promotions.filter(promo => {
    // Verificar se está ativa
    if (promo.ativo !== true) return false;
    
    // Verificar validade
    if (promo.validade) {
      try {
        const validadeDate = new Date(promo.validade);
        if (now > validadeDate) return false;
      } catch (e) {}
    }
    
    // Segmentação por tipo de contato
    if (promo.target_contact_types && promo.target_contact_types.length > 0) {
      if (!promo.target_contact_types.includes(contact.tipo_contato)) {
        return false;
      }
    }
    
    // Segmentação por tags
    if (promo.target_tags && promo.target_tags.length > 0) {
      if (!contact.tags || !promo.target_tags.some(tag => contact.tags.includes(tag))) {
        return false;
      }
    }
    
    // Segmentação por setor (se thread já tem setor)
    if (thread && thread.sector_id && promo.target_sectors && promo.target_sectors.length > 0) {
      if (!promo.target_sectors.includes(thread.sector_id)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Escolhe próxima promoção (rotaciona para não repetir a última)
 */
export function pickNextPromotion(eligiblePromotions, contact) {
  if (eligiblePromotions.length === 0) return null;
  
  // Se só tem 1, retorna ela (mesmo que seja a última)
  if (eligiblePromotions.length === 1) return eligiblePromotions[0];
  
  // Filtrar para não repetir a última enviada
  const candidates = eligiblePromotions.filter(p => p.id !== contact.last_promo_id);
  
  // Se todas foram a última (improvável), pega qualquer uma
  if (candidates.length === 0) return eligiblePromotions[0];
  
  // Pega a primeira candidata (ou poderia ser random)
  return candidates[0];
}

/**
 * Formata mensagem de promoção (teaser ou completa)
 */
export function formatPromotionMessage(promotion, contact, format = 'teaser') {
  const nome = contact.nome && contact.nome !== contact.telefone ? contact.nome : 'cliente';
  
  if (format === 'teaser') {
    // Mensagem curta com call-to-action
    return `🎁 Olá, ${nome}! Temos ofertas especiais hoje. Quer ver?\n\n1️⃣ Sim, quero ver\n2️⃣ Não, obrigado`;
  }
  
  // Mensagem completa
  let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *${promotion.titulo || 'PROMOÇÃO'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (promotion.descricao) {
    message += `${promotion.descricao}\n\n`;
  }
  
  if (promotion.produtos && Array.isArray(promotion.produtos)) {
    promotion.produtos.forEach((produto, idx) => {
      message += `${idx + 1}. *${produto.nome}*\n`;
      if (produto.preco_original && produto.preco_promocional) {
        message += `   ~~R$ ${produto.preco_original}~~ → *R$ ${produto.preco_promocional}*\n`;
      }
      if (produto.descricao) {
        message += `   ${produto.descricao}\n`;
      }
      message += `\n`;
    });
  }
  
  if (promotion.validade) {
    message += `⏰ *Válido até:* ${promotion.validade}\n\n`;
  }
  
  message += `_Interessado? Responda que te ajudo com o pedido!_ 🚀`;
  
  return message;
}

/**
 * Trigger Inbound: enviar promoção quando cliente manda mensagem (janela 6h)
 */
export async function maybeSendPromotionInbound(params) {
  const { base44, contact, thread, integration, now, provider } = params;
  
  // Bloqueios absolutos PRIMEIRO
  const blockCheck = isBlockedFromPromotions(contact, thread, integration);
  if (blockCheck.blocked) {
    console.log('[PROMO-INBOUND] Bloqueado:', blockCheck.reason);
    return { sent: false, reason: blockCheck.reason };
  }
  
  // Verificar cooldown de 6h
  const cooldownCheck = canSendPromoInbound(contact, thread, now, PROMO_COOLDOWN_INBOUND_HOURS);
  if (!cooldownCheck.can) {
    console.log('[PROMO-INBOUND] Cooldown ativo:', cooldownCheck.reason, cooldownCheck.hours + 'h');
    return { sent: false, reason: cooldownCheck.reason, hours: cooldownCheck.hours };
  }
  
  // Buscar promoções ativas
  const allPromotions = await base44.asServiceRole.entities.Promotion.filter({
    ativo: true
  });
  
  if (allPromotions.length === 0) {
    console.log('[PROMO-INBOUND] Nenhuma promoção ativa');
    return { sent: false, reason: 'no_active_promotions' };
  }
  
  // Filtrar elegíveis
  const eligible = filterEligiblePromotions(allPromotions, contact, thread);
  
  if (eligible.length === 0) {
    console.log('[PROMO-INBOUND] Nenhuma promoção elegível');
    return { sent: false, reason: 'no_eligible_promotions' };
  }
  
  // Rotacionar: não repetir a última
  const promotion = pickNextPromotion(eligible, contact);
  
  if (!promotion) {
    return { sent: false, reason: 'no_alternative_promo' };
  }
  
  // Determinar formato (direct se não tem setor ainda)
  const format = (promotion.formato === 'direct' || !thread.sector_id) ? 'direct' : 'teaser';
  const rawMessage = formatPromotionMessage(promotion, contact, format);
  
  // ✅ Processar mensagem com segurança de emoji
  const message = processTextWithEmojis(rawMessage);
  emojiDebug('PROMO_OUTBOUND_MESSAGE', message);
  
  console.log('[PROMO-INBOUND] Enviando:', promotion.titulo, 'para', contact.nome);
  
  // Enviar mensagem
  try {
    let messageId = null;
    
    if (provider === 'z_api') {
      const zapiUrl = `${integration.base_url_provider}/instances/${integration.instance_id_provider}/token/${integration.api_key_provider}/send-text`;
      const zapiHeaders = { 'Content-Type': 'application/json' };
      if (integration.security_client_token_header) {
        zapiHeaders['Client-Token'] = integration.security_client_token_header;
      }
      
      const response = await fetch(zapiUrl, {
        method: 'POST',
        headers: zapiHeaders,
        body: JSON.stringify({ phone: contact.telefone, message })
      });
      
      const data = await response.json();
      if (response.ok && !data.error) {
        messageId = data.messageId;
      } else {
        throw new Error(data.error || 'Erro no envio');
      }
    } else if (provider === 'w_api') {
      const wapiUrl = `${integration.base_url_provider}/messages/send/text`;
      const wapiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.api_key_provider}`
      };
      
      const response = await fetch(wapiUrl, {
        method: 'POST',
        headers: wapiHeaders,
        body: JSON.stringify({
          instanceId: integration.instance_id_provider,
          number: contact.telefone,
          text: message
        })
      });
      
      const data = await response.json();
      if (response.ok && data.key?.id) {
        messageId = data.key.id;
      } else {
        throw new Error(data.error || 'Erro no envio');
      }
    }
    
    // Atualizar timestamps no contato
    const contactUpdate = {
      last_promo_sent_at: now.toISOString(),
      last_promo_id: promotion.id
    };
    
    if (promotion.campaign_id) {
      const campaignMap = contact.last_campaign_sent_at || {};
      campaignMap[promotion.campaign_id] = now.toISOString();
      contactUpdate.last_campaign_sent_at = campaignMap;
    }
    
    await base44.asServiceRole.entities.Contact.update(contact.id, contactUpdate);
    
    // Atualizar thread
    if (thread) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        thread_last_promo_sent_at: now.toISOString()
      });
    }
    
    // Registrar log
    await base44.asServiceRole.entities.EngagementLog.create({
      contact_id: contact.id,
      thread_id: thread?.id,
      type: 'offer',
      sent_at: now.toISOString(),
      status: 'sent',
      dedupe_key: `${contact.id}_offer_${now.toISOString().split('T')[0]}_${Date.now()}`,
      provider: provider,
      message_id: messageId,
      metadata: {
        promotion_id: promotion.id,
        promotion_titulo: promotion.titulo,
        format: format,
        trigger: params.trigger || 'inbound'
      }
    });
    
    // Registrar mensagem no sistema
    if (thread) {
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        content: message,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: messageId,
        sent_at: now.toISOString(),
        metadata: {
          whatsapp_integration_id: integration?.id,
          is_system_message: true,
          message_type: 'promotion',
          promotion_id: promotion.id,
          format: format
        }
      });
    }
    
    console.log('[PROMO] ✅ Enviada:', promotion.titulo, 'para', contact.nome);
    
    return {
      sent: true,
      promotion_id: promotion.id,
      format: format,
      message_id: messageId
    };
    
  } catch (error) {
    console.error('[PROMO] Erro ao enviar:', error.message);
    
    // Registrar falha
    await base44.asServiceRole.entities.EngagementLog.create({
      contact_id: contact.id,
      thread_id: thread?.id,
      type: 'offer',
      status: 'failed',
      reason: error.message,
      dedupe_key: `${contact.id}_offer_fail_${now.toISOString().split('T')[0]}_${Date.now()}`,
      provider: provider
    });
    
    return {
      sent: false,
      reason: 'send_error',
      error: error.message
    };
  }
}

/**
 * FUNÇÃO LEGADA - manter compatibilidade
 */
export async function maybeSendPromotions(params) {
  // Redireciona para trigger inbound
  return maybeSendPromotionInbound({ ...params, trigger: 'inbound' });
}