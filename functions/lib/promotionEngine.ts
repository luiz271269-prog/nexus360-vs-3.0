// ============================================================================
// PROMOTION ENGINE - Motor de Seleção e Envio de Promoções
// ============================================================================
// Funções puras e reutilizáveis para lógica de promoções
// ============================================================================

/**
 * Verifica se um contato está bloqueado para receber promoções
 */
export function isBlockedFromPromotions(contact, thread, integration) {
  // BLOQUEIO ABSOLUTO: Setores sensíveis
  const blockedSectors = ['financeiro', 'fornecedor'];
  if (thread?.sector_id && blockedSectors.includes(thread.sector_id)) {
    return { blocked: true, reason: 'setor_bloqueado' };
  }
  
  // BLOQUEIO: Tipos de contato
  const blockedTypes = ['fornecedor'];
  if (contact?.tipo_contato && blockedTypes.includes(contact.tipo_contato)) {
    return { blocked: true, reason: 'tipo_bloqueado' };
  }
  
  // BLOQUEIO: Contato explicitamente bloqueado
  if (contact?.bloqueado === true) {
    return { blocked: true, reason: 'contato_bloqueado' };
  }
  
  // BLOQUEIO: Opt-out de promoções
  if (contact?.whatsapp_optin === false) {
    return { blocked: true, reason: 'opt_out' };
  }
  
  return { blocked: false };
}

/**
 * Filtra promoções elegíveis baseado em gatilhos (contact_type, setor, tags)
 */
export function filterEligiblePromotions(allPromotions, contact, thread) {
  return allPromotions.filter(promo => {
    // Filtro 1: Tipo de contato
    if (promo.target_contact_types && promo.target_contact_types.length > 0) {
      if (!contact.tipo_contato || !promo.target_contact_types.includes(contact.tipo_contato)) {
        return false;
      }
    }
    
    // Filtro 2: Setor
    if (promo.target_sectors && promo.target_sectors.length > 0) {
      const threadSetor = thread?.sector_id || 'geral';
      if (!promo.target_sectors.includes(threadSetor)) {
        return false;
      }
    }
    
    // Filtro 3: Tags (se a promoção especificar tags, o contato precisa ter pelo menos uma)
    if (promo.target_tags && promo.target_tags.length > 0) {
      const contactTags = contact.tags || [];
      const hasMatchingTag = promo.target_tags.some(tag => contactTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }
    
    // Filtro 4: Validade
    if (promo.validade) {
      const dataValidade = new Date(promo.validade);
      if (dataValidade < new Date()) {
        return false;
      }
    }
    
    // Filtro 5: Limite de envios totais (HARD STOP - Estoque Esgotado)
    if (promo.limite_envios_total && promo.limite_envios_total > 0) {
      const enviados = promo.contador_envios || 0;
      if (enviados >= promo.limite_envios_total) {
        return false; // Promoção esgotada
      }
    }
    
    // Filtro 6: Limite de envios por contato (HARD STOP - Anti-Chatice)
    // Usa o mapa 'promocoes_recebidas' no Contact para verificar quantas vezes este contato recebeu esta promoção
    if (promo.limite_envios_por_contato && promo.limite_envios_por_contato > 0) {
      const promocoesRecebidas = contact.promocoes_recebidas || {};
      const enviosParaEsteContato = promocoesRecebidas[promo.id] || 0;
      if (enviosParaEsteContato >= promo.limite_envios_por_contato) {
        return false; // Contato já recebeu esta promoção o número máximo de vezes
      }
    }
    
    // Filtro 7: Evitar repetir EXATAMENTE a última promoção enviada (Rotação de Ofertas)
    // Força diversidade, a menos que seja a única opção
    if (contact.last_promo_id === promo.id) {
      return false; // Já foi a última enviada, dar chance a outras
    }
    
    return true;
  });
}

/**
 * Escolhe a próxima promoção (evita repetir a última enviada)
 */
export function pickNextPromotion(eligiblePromotions, contact) {
  if (eligiblePromotions.length === 0) return null;
  
  // Ordenar por prioridade
  const sorted = [...eligiblePromotions].sort((a, b) => {
    const prioA = a.priority ?? 10;
    const prioB = b.priority ?? 10;
    return prioA - prioB;
  });
  
  // Se contato tem histórico de última promo, evitar repetir
  if (contact.last_promo_id && sorted.length > 1) {
    const diferente = sorted.find(p => p.id !== contact.last_promo_id);
    if (diferente) return diferente;
  }
  
  return sorted[0];
}

/**
 * Formata a mensagem da promoção (substitui placeholders)
 */
export function formatPromotionMessage(promotion, contact, format = 'teaser') {
  let mensagem = '';
  
  // Formato TEASER (curto, com opção 1/2)
  if (format === 'teaser') {
    const descricao = promotion.descricao_curta || promotion.descricao.substring(0, 120);
    mensagem = `🎁 *Oferta Especial para Você!*\n\n${descricao}`;
    
    if (promotion.price_info) {
      mensagem += `\n\n💰 ${promotion.price_info}`;
    }
    
    mensagem += `\n\n_Digite 1 para saber mais ou 2 para falar com atendente_`;
  } 
  // Formato DIRECT (mensagem completa)
  else {
    mensagem = `🎉 *${promotion.titulo}*\n\n${promotion.descricao}`;
    
    if (promotion.price_info) {
      mensagem += `\n\n💰 ${promotion.price_info}`;
    }
    
    if (promotion.validade) {
      const dataValidade = new Date(promotion.validade);
      const dataFormatada = dataValidade.toLocaleDateString('pt-BR');
      mensagem += `\n\n⏰ Válido até: ${dataFormatada}`;
    }
    
    if (promotion.link_produto) {
      mensagem += `\n\n🔗 Saiba mais: ${promotion.link_produto}`;
    }
    
    mensagem += `\n\n_Entre em contato para aproveitar esta oferta!_`;
  }
  
  // Substituir placeholders
  mensagem = mensagem.replace(/\{\{nome\}\}/g, contact.nome || 'Cliente');
  mensagem = mensagem.replace(/\{\{empresa\}\}/g, contact.empresa || '');
  
  return mensagem;
}

/**
 * Calcula o próximo estágio baseado no tempo decorrido
 */
export function calculateNextStage(thread, now) {
  if (!thread.last_message_at) return null;
  
  const lastMessageDate = new Date(thread.last_message_at);
  const hoursGap = (now - lastMessageDate) / (1000 * 60 * 60);
  
  const currentStage = thread.autoboost_stage;
  
  // 6h → 12h → 24h (progressão sequencial)
  if (hoursGap >= 6 && hoursGap < 12 && !currentStage) {
    return '6h';
  }
  
  if (hoursGap >= 12 && hoursGap < 24 && currentStage === '6h_sent') {
    return '12h';
  }
  
  if (hoursGap >= 24 && currentStage === '12h_sent') {
    return '24h';
  }
  
  return null;
}

/**
 * Verifica se o cooldown de promoção passou
 */
export function isCooldownExpired(thread, contact, cooldownHours = 6) {
  const now = new Date();
  
  // Verificar cooldown na thread
  if (thread.thread_last_promo_sent_at) {
    const lastPromoThread = new Date(thread.thread_last_promo_sent_at);
    const hoursGap = (now - lastPromoThread) / (1000 * 60 * 60);
    if (hoursGap < cooldownHours) {
      return { expired: false, reason: 'thread_cooldown', hours_remaining: cooldownHours - hoursGap };
    }
  }
  
  // Verificar cooldown no contato
  if (contact.last_promo_sent_at) {
    const lastPromoContact = new Date(contact.last_promo_sent_at);
    const hoursGap = (now - lastPromoContact) / (1000 * 60 * 60);
    if (hoursGap < cooldownHours) {
      return { expired: false, reason: 'contact_cooldown', hours_remaining: cooldownHours - hoursGap };
    }
  }
  
  return { expired: true };
}

/**
 * Verifica se humano está ativamente gerenciando a conversa
 */
export function isHumanActive(thread, stalenessHours = 8) {
  if (!thread.assigned_user_id) return false;
  if (thread.last_message_sender !== 'user') return false;
  
  const lastMessageDate = new Date(thread.last_message_at);
  const now = new Date();
  const hoursGap = (now - lastMessageDate) / (1000 * 60 * 60);
  
  return hoursGap < stalenessHours;
}

/**
 * Monta o payload de envio baseado no provider e estágio
 */
export function buildSendPayload(promotion, contact, thread, integration, stage) {
  const format = promotion.formato || 'teaser';
  const message = formatPromotionMessage(promotion, contact, format);
  
  const payload = {
    integration_id: integration.id,
    numero_destino: contact.telefone
  };
  
  // Se for 24h, DEVE usar template aprovado
  if (stage === '24h') {
    if (!promotion.whatsapp_template_name) {
      throw new Error('Promoção 24h requer whatsapp_template_name configurado');
    }
    
    payload.template_name = promotion.whatsapp_template_name;
    payload.template_vars = promotion.whatsapp_template_vars || [contact.nome || 'Cliente'];
  } 
  // Antes de 24h (6h/12h) - envio livre
  else {
    if (promotion.imagem_url && promotion.tipo_midia === 'image') {
      payload.media_url = promotion.imagem_url;
      payload.media_type = 'image';
      payload.media_caption = message;
    } else {
      payload.mensagem = message;
    }
  }
  
  return { payload, message };
}