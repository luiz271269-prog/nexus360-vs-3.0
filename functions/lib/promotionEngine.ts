// ============================================================================
// PROMOTION ENGINE V3.0 - Motor Unificado de Promoções
// ============================================================================
// Baseado em estudo de eficiência e independência da URA
// Funções puras e determinísticas para decisão de envio
// ============================================================================

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// BLOQUEIOS ABSOLUTOS
// ============================================================================

/**
 * Verifica se contato está bloqueado para receber promoções
 * @returns {blocked: boolean, reason: string}
 */
export function isBlocked({ contact, thread, integration, setorTipo }) {
  // BLOQUEIO 1: Tipo de contato
  const tipoContato = String(contact?.tipo_contato || '').toLowerCase();
  if (tipoContato === 'fornecedor') {
    return { blocked: true, reason: 'blocked_supplier_type' };
  }

  // BLOQUEIO 2: Tags do contato
  const tags = (contact?.tags || []).map(t => String(t).toLowerCase());
  const blockedTags = ['fornecedor', 'compras', 'colaborador', 'interno'];
  const hasBlockedTag = tags.some(t => blockedTags.includes(t));
  if (hasBlockedTag) {
    return { blocked: true, reason: 'blocked_tag' };
  }

  // BLOQUEIO 3: Integração/Canal financeiro
  const tipoCanal = String(integration?.setor_principal || '').toLowerCase();
  const blockedChannels = ['financeiro', 'cobranca'];
  if (blockedChannels.includes(tipoCanal)) {
    return { blocked: true, reason: 'blocked_integration_financial' };
  }

  if (integration?.permite_promocao === false) {
    return { blocked: true, reason: 'blocked_integration_flag' };
  }

  // BLOQUEIO 4: Setor da thread
  const setorThread = String(thread?.sector_id || setorTipo || '').toLowerCase();
  const blockedSectors = ['financeiro', 'cobranca', 'compras', 'fornecedores', 'fornecedor'];
  if (blockedSectors.some(s => setorThread.includes(s))) {
    return { blocked: true, reason: 'blocked_sector' };
  }

  // BLOQUEIO 5: Contato bloqueado manualmente
  if (contact?.bloqueado === true) {
    return { blocked: true, reason: 'contact_blocked' };
  }

  // BLOQUEIO 6: Opt-out explícito
  if (contact?.whatsapp_optin === false) {
    return { blocked: true, reason: 'opt_out' };
  }

  return { blocked: false };
}

// ============================================================================
// PROMOÇÕES ATIVAS E ELEGÍVEIS
// ============================================================================

/**
 * Busca promoções ativas e válidas (com filtro opcional de stage)
 */
export async function getActivePromotions(base44, now, stage = null) {
  // Filtro base: ativo + stage opcional
  const filter = { ativo: true };
  if (stage) filter.stage = stage;
  
  const all = await base44.asServiceRole.entities.Promotion.filter(filter);
  const valid = (all || []).filter(p => {
    // Validar data de validade
    if (p.validade) {
      const dataValidade = new Date(p.validade);
      if (dataValidade < now) return false;
    }
    
    // Validar limite total de envios
    if (p.limite_envios_total && p.limite_envios_total > 0) {
      const enviados = p.contador_envios || 0;
      if (enviados >= p.limite_envios_total) return false;
    }
    
    return true;
  });

  // Ordenar por prioridade (menor = maior prioridade)
  valid.sort((a, b) => (a.priority || 10) - (b.priority || 10));
  return valid;
}

/**
 * Filtra promoções elegíveis para contato/thread específico
 */
export function filterEligiblePromotions(promos, contact, thread) {
  return promos.filter(promo => {
    // Filtro: target_contact_types
    if (promo.target_contact_types && promo.target_contact_types.length > 0) {
      const tipoNorm = String(contact.tipo_contato || '').toLowerCase();
      const targetNorm = promo.target_contact_types.map(t => String(t).toLowerCase());
      if (!targetNorm.includes(tipoNorm)) {
        return false;
      }
    }

    // Filtro: target_sectors
    if (promo.target_sectors && promo.target_sectors.length > 0) {
      const threadSetor = thread?.sector_id || 'geral';
      if (!promo.target_sectors.includes(threadSetor)) {
        return false;
      }
    }

    // Filtro: target_tags
    if (promo.target_tags && promo.target_tags.length > 0) {
      const contactTags = contact.tags || [];
      const hasMatchingTag = promo.target_tags.some(tag => contactTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    // Filtro: limite por contato
    if (promo.limite_envios_por_contato && promo.limite_envios_por_contato > 0) {
      const promocoesRecebidas = contact.promocoes_recebidas || {};
      const enviosParaEsteContato = promocoesRecebidas[promo.id] || 0;
      if (enviosParaEsteContato >= promo.limite_envios_por_contato) {
        return false;
      }
    }

    return true;
  });
}

// ============================================================================
// ROTAÇÃO INTELIGENTE (Anti-Repetição com Histórico de 3)
// ============================================================================

export function readLastPromoIds(contact) {
  const v = contact?.last_promo_ids;
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  // Fallback: se for string CSV
  if (typeof v === 'string') {
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export function writeLastPromoIds(lastIds, newId) {
  const next = [newId, ...lastIds.filter(id => id !== newId)].slice(0, 3);
  return next;
}

/**
 * Escolhe a próxima promoção evitando as últimas 3 enviadas
 */
export function pickPromotion(promos, contact) {
  if (!promos?.length) return null;

  const lastIds = readLastPromoIds(contact);

  // Tentar evitar as últimas 3
  let candidates = promos.filter(p => !lastIds.includes(p.id));
  if (!candidates.length) candidates = promos; // Se todas já foram enviadas, permite reenvio

  // Pegar a(s) de maior prioridade e randomizar dentro do mesmo nível
  const topPrio = candidates[0].priority || 10;
  const pool = candidates.filter(p => (p.priority || 10) === topPrio);
  
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================================
// COOLDOWN E FREQUÊNCIA
// ============================================================================

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const THIRTY_SIX_HOURS_MS = 36 * 60 * 60 * 1000;

/**
 * Verifica cooldown UNIVERSAL (12h entre qualquer promoção)
 * Esta é a principal guarda - nenhuma promoção pode ser enviada se não passaram 12h desde a última
 */
export function canSendUniversalPromo({ contact, now }) {
  const last = contact?.last_any_promo_sent_at ? new Date(contact.last_any_promo_sent_at) : null;
  if (!last) return { ok: true };
  
  const gap = now - last;
  if (gap >= TWELVE_HOURS_MS) return { ok: true };
  
  const hoursRemaining = ((TWELVE_HOURS_MS - gap) / (1000 * 60 * 60)).toFixed(1);
  return { ok: false, reason: 'cooldown_universal_12h', hours_remaining: hoursRemaining };
}

/**
 * Verifica se humano está ativo na thread (evitar promoção se atendente está conversando)
 */
export function isHumanActive({ thread, now, stalenessHours = 8 }) {
  if (!thread?.assigned_user_id) return false;
  
  const lastHuman = thread.last_human_message_at ? new Date(thread.last_human_message_at) : null;
  if (!lastHuman) return false;
  
  const gap = now - lastHuman;
  const hours = gap / (1000 * 60 * 60);
  
  return hours < stalenessHours;
}

// ============================================================================
// FORMATAÇÃO DE MENSAGEM (SEM NÚMEROS - Evitar colisão com URA)
// ============================================================================

export function formatPromotionMessage(promo) {
  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *${promo.titulo || 'Oferta Especial'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (promo.descricao_curta || promo.descricao) {
    msg += `${promo.descricao_curta || promo.descricao}\n\n`;
  }
  
  if (promo.price_info) {
    msg += `💰 *${promo.price_info}*\n\n`;
  }
  
  if (promo.validade) {
    const d = new Date(promo.validade).toLocaleDateString('pt-BR');
    msg += `⏰ *Válido até:* ${d}\n\n`;
  }
  
  if (promo.link_produto) {
    msg += `🔗 ${promo.link_produto}\n\n`;
  }
  
  // ✅ SEM NÚMEROS (evita colisão com URA 1-4)
  msg += `_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨`;
  
  return msg;
}

// ============================================================================
// ENVIO UNIFICADO
// ============================================================================

/**
 * Envia promoção e registra no banco
 * @param trigger - 'inbound_6h' ou 'batch_36h'
 */
export async function sendPromotion(base44, { contact, thread, integration_id, promo, trigger }) {
  const msg = formatPromotionMessage(promo);
  const now = new Date();

  // Invocar função de envio WhatsApp
  const payload = {
    integration_id,
    numero_destino: contact.telefone
  };

  // Suporte a mídia
  if (promo.imagem_url && promo.tipo_midia === 'image') {
    payload.media_url = promo.imagem_url;
    payload.media_type = 'image';
    payload.media_caption = msg;
  } else {
    payload.mensagem = msg;
  }

  const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', payload);
  
  if (!resp?.data?.success) {
    throw new Error(resp?.data?.error || 'erro_envio_promocao');
  }

  // Registrar mensagem no banco
  await base44.asServiceRole.entities.Message.create({
    thread_id: thread.id,
    sender_id: 'system',
    sender_type: 'user',
    recipient_id: contact.id,
    recipient_type: 'contact',
    content: msg,
    channel: 'whatsapp',
    status: 'enviada',
    whatsapp_message_id: resp.data.message_id,
    sent_at: now.toISOString(),
    media_url: promo.imagem_url || null,
    media_type: promo.imagem_url ? 'image' : 'none',
    media_caption: promo.imagem_url ? msg : null,
    metadata: {
      whatsapp_integration_id: integration_id,
      is_system_message: true,
      message_type: 'promotion',
      promotion_id: promo.id,
      trigger
    }
  });

  // ATUALIZAR CONTROLE UNIVERSAL (CRÍTICO)
  // Sempre atualizar last_any_promo_sent_at independente do tipo de promoção
  await base44.asServiceRole.entities.Contact.update(contact.id, {
    last_any_promo_sent_at: now.toISOString()
  });

  return { message_id: resp.data.message_id, text: msg };
}