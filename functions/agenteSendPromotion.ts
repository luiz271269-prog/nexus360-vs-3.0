// functions/agenteSendPromotion.js
// Endpoint HTTP para o agente promocoes_automaticas enviar promoções via WhatsApp
// Não usa imports locais (regra Deno) — lógica de cooldown inline

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function formatPromotionMessage(promo) {
  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *${promo.titulo || 'Oferta Especial'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (promo.descricao_curta || promo.descricao) {
    msg += `${promo.descricao_curta || promo.descricao}\n\n`;
  }
  if (promo.price_info) msg += `💰 *${promo.price_info}*\n\n`;
  if (promo.validade) {
    const d = new Date(promo.validade).toLocaleDateString('pt-BR');
    msg += `⏰ *Válido até:* ${d}\n\n`;
  }
  if (promo.link_produto) msg += `🔗 ${promo.link_produto}\n\n`;
  msg += `_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨`;
  return msg;
}

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

  // Cooldown universal 12h
  if (contact.last_any_promo_sent_at) {
    const gap = Date.now() - new Date(contact.last_any_promo_sent_at).getTime();
    if (gap < TWELVE_HOURS_MS) {
      const nextInHours = ((TWELVE_HOURS_MS - gap) / 3600000).toFixed(1);
      return Response.json({ success: false, reason: 'cooldown_universal_12h', next_in_hours: nextInHours }, { status: 429 });
    }
  }

  // Bloqueios: fornecedor, bloqueado, opt-out
  const tipoContato = String(contact.tipo_contato || '').toLowerCase();
  const tags = (contact.tags || []).map(t => String(t).toLowerCase());
  if (tipoContato === 'fornecedor' || tags.some(t => ['fornecedor', 'compras', 'colaborador', 'interno'].includes(t))) {
    return Response.json({ success: false, reason: 'contato_bloqueado_tipo_fornecedor' });
  }
  if (contact.bloqueado === true) return Response.json({ success: false, reason: 'contato_bloqueado_manual' });
  if (contact.whatsapp_optin === false) return Response.json({ success: false, reason: 'opt_out' });
  if (['invalido', 'bloqueado'].includes(contact.whatsapp_status)) {
    return Response.json({ success: false, reason: 'whatsapp_status_invalido' });
  }

  // GUARDA META: Janela de 24h — só enviar mensagem livre dentro da janela de conversa ativa
  const threads24h = await base44.asServiceRole.entities.MessageThread.filter({
    contact_id: contact.id, is_canonical: true
  }, '-created_date', 1);
  const t24 = threads24h[0];
  const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lastInboundT = t24?.last_inbound_at ? new Date(t24.last_inbound_at) : null;
  if (!lastInboundT || lastInboundT < vinteQuatroHorasAtras) {
    return Response.json({ success: false, reason: 'fora_janela_24h_meta', detail: 'Último inbound do contato há mais de 24h. Use template aprovado.' });
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

  // Buscar thread canônica
  const threads = await base44.asServiceRole.entities.MessageThread.filter({
    contact_id: contact.id,
    is_canonical: true,
    status: 'aberta'
  }, '-created_date', 1);
  const thread = threads[0];
  if (!thread) return Response.json({ error: 'Thread ativa não encontrada' }, { status: 404 });

  // Montar payload de envio
  const msg = formatPromotionMessage(promo);
  const payload = { integration_id: integration.id, numero_destino: contact.telefone };
  if (promo.imagem_url && promo.tipo_midia === 'image') {
    payload.media_url = promo.imagem_url;
    payload.media_type = 'image';
    payload.media_caption = msg;
  } else {
    payload.mensagem = msg;
  }

  const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', payload);
  if (!resp?.data?.success) {
    return Response.json({ error: resp?.data?.error || 'Falha no envio WhatsApp' }, { status: 500 });
  }

  const now = new Date();

  // Registrar mensagem no histórico
  await base44.asServiceRole.entities.Message.create({
    thread_id: thread.id,
    sender_id: 'system',
    sender_type: 'user',
    recipient_id: contact.id,
    recipient_type: 'contact',
    content: msg,
    channel: 'whatsapp',
    status: 'enviada',
    sent_at: now.toISOString(),
    media_url: promo.imagem_url || null,
    media_type: promo.imagem_url ? 'image' : 'none',
    metadata: {
      whatsapp_integration_id: integration.id,
      is_system_message: true,
      message_type: 'promotion',
      promotion_id: promo.id,
      trigger: 'agente_manual'
    }
  });

  // Atualizar contador da promoção e histórico do contato em paralelo
  const lastPromoIds = Array.isArray(contact.last_promo_ids) ? contact.last_promo_ids : [];
  await Promise.all([
    base44.asServiceRole.entities.Promotion.update(promo.id, {
      contador_envios: (promo.contador_envios || 0) + 1
    }),
    base44.asServiceRole.entities.Contact.update(contact.id, {
      last_any_promo_sent_at: now.toISOString(),
      last_promo_id: promo.id,
      last_promo_ids: [promo.id, ...lastPromoIds.filter(id => id !== promo.id)].slice(0, 3),
      promocoes_recebidas: {
        ...(contact.promocoes_recebidas || {}),
        [promo.id]: ((contact.promocoes_recebidas || {})[promo.id] || 0) + 1
      }
    })
  ]);

  console.log(`[agenteSendPromotion] ✅ "${promo.titulo}" → ${contact.nome} (${contact.telefone})`);

  return Response.json({
    success: true,
    promo_titulo: promo.titulo,
    contact_nome: contact.nome,
    message_id: resp.data.message_id
  });
});