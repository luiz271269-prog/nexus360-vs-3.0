// functions/agenteSendPromotion.js
// Expõe sendPromotion() do promotionEngine como endpoint HTTP
// Usado pelo agente promocoes_automaticas para enviar promoções via WhatsApp

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { sendPromotion, isBlocked, canSendUniversalPromo, filterEligiblePromotions } from './lib/promotionEngine.js';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { promotion_id, contact_id, integration_id } = await req.json();
  if (!promotion_id || !contact_id) {
    return Response.json({ error: 'promotion_id e contact_id são obrigatórios' }, { status: 400 });
  }

  // Buscar promoção e contato em paralelo
  const [promo, contact] = await Promise.all([
    base44.asServiceRole.entities.Promotion.get(promotion_id),
    base44.asServiceRole.entities.Contact.get(contact_id)
  ]);

  if (!promo) return Response.json({ error: 'Promoção não encontrada' }, { status: 404 });
  if (!contact) return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
  if (!promo.ativo) return Response.json({ success: false, reason: 'promocao_inativa' });

  // Cooldown universal (12h entre qualquer promoção)
  const now = new Date();
  const cooldownCheck = canSendUniversalPromo({ contact, now });
  if (!cooldownCheck.ok) {
    return Response.json({
      success: false,
      reason: cooldownCheck.reason,
      next_in_hours: cooldownCheck.hours_remaining
    }, { status: 429 });
  }

  // Bloqueios absolutos (fornecedor, financeiro, etc.)
  const blockCheck = isBlocked({ contact, thread: null, integration: null });
  if (blockCheck.blocked) {
    return Response.json({ success: false, reason: blockCheck.reason });
  }

  // Buscar integração WhatsApp
  let integration;
  if (integration_id) {
    integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
  } else {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { status: 'conectado' }, '-created_date', 1
    );
    integration = integracoes[0];
  }
  if (!integration) return Response.json({ error: 'Sem integração WhatsApp ativa' }, { status: 404 });

  // Buscar thread canônica do contato
  const threads = await base44.asServiceRole.entities.MessageThread.filter({
    contact_id: contact.id,
    is_canonical: true,
    status: 'aberta'
  }, '-created_date', 1);
  const thread = threads[0];
  if (!thread) return Response.json({ error: 'Thread ativa não encontrada para este contato' }, { status: 404 });

  // Enviar usando o engine existente
  const result = await sendPromotion(base44, {
    contact,
    thread,
    integration_id: integration.id,
    promo,
    trigger: 'agente_manual'
  });

  // Atualizar contadores da promoção
  await base44.asServiceRole.entities.Promotion.update(promo.id, {
    contador_envios: (promo.contador_envios || 0) + 1
  });

  // Atualizar histórico do contato
  const lastPromoIds = Array.isArray(contact.last_promo_ids) ? contact.last_promo_ids : [];
  await base44.asServiceRole.entities.Contact.update(contact.id, {
    last_promo_ids: [promo.id, ...lastPromoIds.filter(id => id !== promo.id)].slice(0, 3),
    last_promo_id: promo.id,
    promocoes_recebidas: {
      ...(contact.promocoes_recebidas || {}),
      [promo.id]: ((contact.promocoes_recebidas || {})[promo.id] || 0) + 1
    }
  });

  console.log(`[agenteSendPromotion] ✅ Enviado: "${promo.titulo}" → ${contact.nome} (${contact.telefone})`);

  return Response.json({
    success: true,
    promo_titulo: promo.titulo,
    contact_nome: contact.nome,
    message_id: result.message_id
  });
});