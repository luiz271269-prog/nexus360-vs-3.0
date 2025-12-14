// ============================================================================
// PROMOTION ENGINE - Motor de Ofertas e Novidades Desacoplado da URA
// ============================================================================
// Gerencia o envio de promoções na "abertura de ciclo" de forma inteligente
// ============================================================================

const PROMO_COOLDOWN_HOURS_DEFAULT = 24;
const NEW_CYCLE_GAP_HOURS = 12;

/**
 * Detecta se é um "novo ciclo de conversa" elegível para promoções
 */
export function isNewCycle(thread, contact, now) {
  if (!thread.last_message_at) return true; // Thread nova
  
  const lastMessageDate = new Date(thread.last_message_at);
  const hoursSinceLastMessage = (now - lastMessageDate) / (1000 * 60 * 60);
  
  // Novo ciclo se passou mais de X horas desde última mensagem
  if (hoursSinceLastMessage >= NEW_CYCLE_GAP_HOURS) return true;
  
  return false;
}

/**
 * Verifica se pode enviar promoção respeitando cooldowns
 */
export function canSendPromotion(contact, promotion, now) {
  // Verificar cooldown global do contato
  if (contact.last_promo_sent_at) {
    const lastPromoDate = new Date(contact.last_promo_sent_at);
    const hoursSinceLastPromo = (now - lastPromoDate) / (1000 * 60 * 60);
    
    const cooldownHours = promotion.cooldown_hours || PROMO_COOLDOWN_HOURS_DEFAULT;
    if (hoursSinceLastPromo < cooldownHours) {
      return { can: false, reason: 'global_cooldown' };
    }
  }
  
  // Verificar cooldown por campanha específica
  if (contact.last_campaign_sent_at && promotion.campaign_id) {
    const campaignCooldown = contact.last_campaign_sent_at[promotion.campaign_id];
    if (campaignCooldown) {
      const lastCampaignDate = new Date(campaignCooldown);
      const hoursSinceCampaign = (now - lastCampaignDate) / (1000 * 60 * 60);
      
      const campaignCooldownHours = promotion.cooldown_hours || PROMO_COOLDOWN_HOURS_DEFAULT;
      if (hoursSinceCampaign < campaignCooldownHours) {
        return { can: false, reason: 'campaign_cooldown' };
      }
    }
  }
  
  return { can: true };
}

/**
 * Filtra promoções elegíveis para um contato específico
 */
export function filterEligiblePromotions(promotions, contact, thread) {
  return promotions.filter(promo => {
    // Verificar se está ativa
    if (!promo.active) return false;
    
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
    if (thread.sector_id && promo.target_sectors && promo.target_sectors.length > 0) {
      if (!promo.target_sectors.includes(thread.sector_id)) {
        return false;
      }
    }
    
    return true;
  });
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
 * Função principal: tenta enviar promoções na abertura de ciclo
 */
export async function maybeSendPromotions(params) {
  const { base44, contact, thread, integration, now, provider } = params;
  
  // Verificar se é novo ciclo
  if (!isNewCycle(thread, contact, now)) {
    return { sent: false, reason: 'not_new_cycle' };
  }
  
  // Buscar promoções ativas
  const allPromotions = await base44.asServiceRole.entities.Promotion.filter({
    ativo: true
  });
  
  if (allPromotions.length === 0) {
    return { sent: false, reason: 'no_active_promotions' };
  }
  
  // Filtrar elegíveis
  const eligible = filterEligiblePromotions(allPromotions, contact, thread);
  
  if (eligible.length === 0) {
    return { sent: false, reason: 'no_eligible_promotions' };
  }
  
  // Pegar primeira elegível
  const promotion = eligible[0];
  
  // Verificar cooldowns
  const cooldownCheck = canSendPromotion(contact, promotion, now);
  if (!cooldownCheck.can) {
    return { sent: false, reason: cooldownCheck.reason };
  }
  
  // Determinar formato (teaser ou direto)
  const format = promotion.formato || 'teaser';
  const message = formatPromotionMessage(promotion, contact, format);
  
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
      last_promo_sent_at: now.toISOString()
    };
    
    if (promotion.campaign_id) {
      const campaignMap = contact.last_campaign_sent_at || {};
      campaignMap[promotion.campaign_id] = now.toISOString();
      contactUpdate.last_campaign_sent_at = campaignMap;
    }
    
    await base44.asServiceRole.entities.Contact.update(contact.id, contactUpdate);
    
    // Atualizar thread
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      thread_last_promo_sent_at: now.toISOString()
    });
    
    // Registrar log
    await base44.asServiceRole.entities.EngagementLog.create({
      contact_id: contact.id,
      thread_id: thread.id,
      type: 'offer',
      sent_at: now.toISOString(),
      status: 'sent',
      dedupe_key: `${contact.id}_offer_${now.toISOString().split('T')[0]}`,
      provider: provider,
      message_id: messageId,
      metadata: {
        promotion_id: promotion.id,
        format: format
      }
    });
    
    // Registrar mensagem no sistema
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
        whatsapp_integration_id: integration.id,
        is_system_message: true,
        message_type: 'promotion',
        promotion_id: promotion.id,
        format: format
      }
    });
    
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
      thread_id: thread.id,
      type: 'offer',
      status: 'failed',
      reason: error.message,
      dedupe_key: `${contact.id}_offer_fail_${now.toISOString().split('T')[0]}`,
      provider: provider
    });
    
    return {
      sent: false,
      reason: 'send_error',
      error: error.message
    };
  }
}