import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// CRON JOB - PROMOÇÕES BATCH (36h inatividade + janela 7 dias Meta)
// ============================================================================
// Executa diariamente ou a cada 6h via cron
// Só envia para contatos com last_inbound_at nos últimos 7 dias (lista quente)
// Fora disso exige template HSM aprovado — não implementado aqui
// ============================================================================

const VERSION = 'v5.0.0-INLINE';
const BATCH_LIMIT = 50;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

// ── Helpers inline (sem imports locais) ─────────────────────────────────────

// Cooldown maior para eventuais (48h vs 12h padrão)
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

function isBlocked({ contact, thread, integration }) {
  const tipo = String(contact?.tipo_contato || '').toLowerCase();
  if (tipo === 'fornecedor')  return { blocked: true, reason: 'blocked_supplier_type' };
  // ✅ ex_cliente: NUNCA recebe batch — apenas playbook de reativação manual
  if (tipo === 'ex_cliente')  return { blocked: true, reason: 'blocked_ex_cliente_batch' };
  // ✅ parceiro: não recebe promoção padrão de produto
  if (tipo === 'parceiro')    return { blocked: true, reason: 'blocked_parceiro_type' };
  const tags = (contact?.tags || []).map(t => String(t).toLowerCase());
  if (tags.some(t => ['fornecedor', 'compras', 'colaborador', 'interno'].includes(t)))
    return { blocked: true, reason: 'blocked_tag' };
  const canal = String(integration?.setor_principal || '').toLowerCase();
  if (['financeiro', 'cobranca'].includes(canal))
    return { blocked: true, reason: 'blocked_integration_financial' };
  if (integration?.permite_promocao === false)
    return { blocked: true, reason: 'blocked_integration_flag' };
  const setor = String(thread?.sector_id || '').toLowerCase();
  if (['financeiro', 'cobranca', 'compras', 'fornecedor', 'fornecedores'].some(s => setor.includes(s)))
    return { blocked: true, reason: 'blocked_sector' };
  if (contact?.bloqueado === true) return { blocked: true, reason: 'contact_blocked' };
  if (contact?.whatsapp_optin === false) return { blocked: true, reason: 'opt_out' };
  if (['invalido', 'bloqueado'].includes(contact?.whatsapp_status))
    return { blocked: true, reason: 'whatsapp_status_invalido' };
  return { blocked: false };
}

function canSendUniversalPromo({ contact, now }) {
  const last = contact?.last_any_promo_sent_at ? new Date(contact.last_any_promo_sent_at) : null;
  if (!last) return { ok: true };
  const gap = now - last;
  if (gap >= TWELVE_HOURS_MS) return { ok: true };
  return { ok: false, reason: 'cooldown_universal_12h' };
}

function filterEligiblePromotions(promos, contact, thread) {
  return promos.filter(promo => {
    if (promo.target_contact_types?.length > 0) {
      const tipo = String(contact.tipo_contato || '').toLowerCase();
      if (!promo.target_contact_types.map(t => String(t).toLowerCase()).includes(tipo)) return false;
    }
    if (promo.target_sectors?.length > 0) {
      if (!promo.target_sectors.includes(thread?.sector_id || 'geral')) return false;
    }
    if (promo.target_tags?.length > 0) {
      if (!promo.target_tags.some(tag => (contact.tags || []).includes(tag))) return false;
    }
    if (promo.limite_envios_por_contato > 0) {
      if ((contact.promocoes_recebidas?.[promo.id] || 0) >= promo.limite_envios_por_contato) return false;
    }
    return true;
  });
}

function pickPromotion(promos, contact) {
  if (!promos?.length) return null;
  const lastIds = Array.isArray(contact?.last_promo_ids) ? contact.last_promo_ids : [];
  let candidates = promos.filter(p => !lastIds.includes(p.id));
  if (!candidates.length) candidates = promos;
  const topPrio = candidates[0].priority || 10;
  const pool = candidates.filter(p => (p.priority || 10) === topPrio);
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatPromotionMessage(promo) {
  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *${promo.titulo || 'Oferta Especial'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (promo.descricao_curta || promo.descricao) msg += `${promo.descricao_curta || promo.descricao}\n\n`;
  if (promo.price_info) msg += `💰 *${promo.price_info}*\n\n`;
  if (promo.validade) msg += `⏰ *Válido até:* ${new Date(promo.validade).toLocaleDateString('pt-BR')}\n\n`;
  if (promo.link_produto) msg += `🔗 ${promo.link_produto}\n\n`;
  msg += `_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨`;
  return msg;
}

async function sendPromotion(base44, { contact, thread, integration_id, promo, trigger }) {
  const msg = formatPromotionMessage(promo);
  const now = new Date();
  const payload = { integration_id, numero_destino: contact.telefone };
  if (promo.imagem_url && promo.tipo_midia === 'image') {
    payload.media_url = promo.imagem_url;
    payload.media_type = 'image';
    payload.media_caption = msg;
  } else {
    payload.mensagem = msg;
  }
  const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', payload);
  if (!resp?.data?.success) throw new Error(resp?.data?.error || 'erro_envio_promocao');

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
    metadata: { whatsapp_integration_id: integration_id, message_type: 'promotion', promotion_id: promo.id, trigger }
  });

  await base44.asServiceRole.entities.Contact.update(contact.id, {
    last_any_promo_sent_at: now.toISOString()
  });

  return { message_id: resp.data.message_id };
}

// ── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();

  try {
    console.log(`[PROMO-BATCH ${VERSION}] Iniciando...`);

    const promos = await base44.asServiceRole.entities.Promotion.filter({ ativo: true, stage: '36h' });
    const validPromos = (promos || []).filter(p => {
      if (p.validade && new Date(p.validade) < now) return false;
      if (p.limite_envios_total > 0 && (p.contador_envios || 0) >= p.limite_envios_total) return false;
      return true;
    }).sort((a, b) => (a.priority || 10) - (b.priority || 10));

    if (!validPromos.length) return Response.json({ success: true, sent: 0, reason: 'no_active_36h_promos' });

    const trintaSeisHorasAtras = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
    // GUARDA META: só lista quente (inbound nos últimos 7 dias)
    const seteDiasAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      last_message_at: { $lte: trintaSeisHorasAtras },
      last_inbound_at: { $gte: seteDiasAtras },
      thread_type: 'contact_external'
    }, '-last_message_at', 200);

    console.log(`[PROMO-BATCH] ${threads.length} threads elegíveis (36h+ inativos, inbound <7d)`);
    if (!threads.length) return Response.json({ success: true, sent: 0, reason: 'no_eligible_threads' });

    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
    if (!integracoes.length) return Response.json({ success: true, sent: 0, reason: 'no_active_integrations' });

    const integracoesMap = new Map(integracoes.map(i => [i.id, i]));
    let sent = 0, skipped = 0;
    const reasons = {};

    for (const thread of threads) {
      if (sent >= BATCH_LIMIT) break;
      try {
        const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
        if (!contact?.telefone) { skipped++; reasons['no_contact_or_phone'] = (reasons['no_contact_or_phone'] || 0) + 1; continue; }

        // GUARDA META: whatsapp_status
        if (['invalido', 'bloqueado'].includes(contact.whatsapp_status)) {
          skipped++; reasons['whatsapp_status_invalido'] = (reasons['whatsapp_status_invalido'] || 0) + 1; continue;
        }

        // GUARDA META: Janela 24h — não enviar fora da janela ativa
        const lastInboundBatch = thread.last_inbound_at ? new Date(thread.last_inbound_at) : null;
        const janelaExpiraEm = thread.janela_24h_expira_em
          ? new Date(thread.janela_24h_expira_em)
          : (lastInboundBatch ? new Date(lastInboundBatch.getTime() + 24 * 60 * 60 * 1000) : null);
        if (!janelaExpiraEm || now > janelaExpiraEm) {
          skipped++; reasons['fora_janela_24h_meta'] = (reasons['fora_janela_24h_meta'] || 0) + 1; continue;
        }

        // ✅ eventual: cooldown 48h (vs 12h padrão)
        const tipoContato = String(contact.tipo_contato || '').toLowerCase();
        if (tipoContato === 'eventual') {
          const lastEv = contact.last_any_promo_sent_at ? new Date(contact.last_any_promo_sent_at) : null;
          if (lastEv && (now - lastEv) < FORTY_EIGHT_HOURS_MS) {
            skipped++; reasons['cooldown_eventual_48h'] = (reasons['cooldown_eventual_48h'] || 0) + 1; continue;
          }
        } else {
          const cd = canSendUniversalPromo({ contact, now });
          if (!cd.ok) { skipped++; reasons[cd.reason] = (reasons[cd.reason] || 0) + 1; continue; }
        }

        const integration = integracoesMap.get(thread.whatsapp_integration_id) || integracoes[0];
        if (!integration) { skipped++; reasons['no_integration'] = (reasons['no_integration'] || 0) + 1; continue; }

        const block = isBlocked({ contact, thread, integration });
        if (block.blocked) { skipped++; reasons[block.reason] = (reasons[block.reason] || 0) + 1; continue; }

        const eligible = filterEligiblePromotions(validPromos, contact, thread);
        const promo = pickPromotion(eligible, contact);
        if (!promo) { skipped++; reasons['no_eligible_promo'] = (reasons['no_eligible_promo'] || 0) + 1; continue; }

        await sendPromotion(base44, { contact, thread, integration_id: integration.id, promo, trigger: 'batch_36h' });

        const lastIds = Array.isArray(contact.last_promo_ids) ? contact.last_promo_ids : [];
        await Promise.all([
          base44.asServiceRole.entities.Contact.update(contact.id, {
            last_promo_batch_at: now.toISOString(),
            last_promo_ids: [promo.id, ...lastIds.filter(id => id !== promo.id)].slice(0, 3),
            promocoes_recebidas: { ...(contact.promocoes_recebidas || {}), [promo.id]: ((contact.promocoes_recebidas || {})[promo.id] || 0) + 1 }
          }),
          base44.asServiceRole.entities.Promotion.update(promo.id, {
            contador_envios: (promo.contador_envios || 0) + 1
          })
        ]);

        sent++;
        console.log(`[PROMO-BATCH] ✅ ${contact.nome}: ${promo.titulo}`);
        await new Promise(r => setTimeout(r, 300));

      } catch (e) {
        skipped++;
        reasons['error'] = (reasons['error'] || 0) + 1;
        console.error('[PROMO-BATCH] ❌', e.message);
      }
    }

    console.log('[PROMO-BATCH] Concluído:', { sent, skipped, reasons });
    return Response.json({ success: true, sent, skipped, reasons, timestamp: now.toISOString() });

  } catch (e) {
    console.error('[PROMO-BATCH] ERRO GERAL:', e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});