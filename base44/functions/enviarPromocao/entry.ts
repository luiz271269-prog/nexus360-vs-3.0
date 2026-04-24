import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ============================================================================
// MOTOR ÚNICO DE ENVIO DE PROMOÇÕES — v1.0.0
// ============================================================================
// Fonte ÚNICA de verdade para envio de promoções. Todos os canais
// (inbound 6h, batch 36h, fila agendada, massa manual, manual individual)
// DEVEM chamar este skill para garantir regras consistentes.
//
// Aceita:
//   - contact_id (obrigatório)
//   - promotion_id (opcional — se vazio, motor escolhe via pickPromotion)
//   - trigger (obrigatório: inbound_6h|batch_36h|fila_agendada|massa_manual|manual_individual)
//   - integration_id (opcional — se vazio, motor escolhe)
//   - thread_id (opcional — se vazio, motor busca/cria)
//   - skip_cooldown (bool, default false) — massa manual pode ignorar cooldown
//   - skip_rotation (bool, default false) — quando promotion_id fixo, ignora rotação
//   - skip_janela_meta (bool, default false) — só mass blast pode (é decisão explícita)
//   - campaign_id (string, opcional — agrupa envios em massa)
//   - initiated_by (string: 'cron' ou user email)
//
// Retorna:
//   { success: true, status: 'enviada'|'bloqueada'|'erro', ... }
// ============================================================================

const VERSION = 'v1.0.0';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

// ── BLOQUEIOS ABSOLUTOS ─────────────────────────────────────────────────────
function isBlocked({ contact, thread, integration, trigger }) {
  const tipo = String(contact?.tipo_contato || '').toLowerCase();
  if (tipo === 'fornecedor') return { blocked: true, reason: 'blocked_supplier_type' };
  if (tipo === 'ex_cliente' && trigger === 'batch_36h') {
    return { blocked: true, reason: 'blocked_ex_cliente_batch' };
  }
  if (tipo === 'parceiro' && trigger === 'batch_36h') {
    return { blocked: true, reason: 'blocked_parceiro_batch' };
  }

  const tags = (contact?.tags || []).map(t => String(t).toLowerCase());
  if (tags.some(t => ['fornecedor', 'compras', 'colaborador', 'interno'].includes(t))) {
    return { blocked: true, reason: 'blocked_tag' };
  }
  if (tags.includes('opt_out')) return { blocked: true, reason: 'opt_out_tag' };

  const canal = String(integration?.setor_principal || '').toLowerCase();
  if (['financeiro', 'cobranca'].includes(canal)) {
    return { blocked: true, reason: 'blocked_integration_financial' };
  }
  if (integration?.permite_promocao === false) {
    return { blocked: true, reason: 'blocked_integration_flag' };
  }

  const setor = String(thread?.sector_id || '').toLowerCase();
  if (['financeiro', 'cobranca', 'compras', 'fornecedor', 'fornecedores'].some(s => setor.includes(s))) {
    return { blocked: true, reason: 'blocked_sector' };
  }

  if (contact?.bloqueado === true) return { blocked: true, reason: 'contact_blocked' };
  if (contact?.whatsapp_optin === false) return { blocked: true, reason: 'opt_out' };
  if (['invalido', 'bloqueado'].includes(contact?.whatsapp_status)) {
    return { blocked: true, reason: 'whatsapp_status_invalido' };
  }

  // Integração pausada (por 429/403 do broadcast worker)
  const pausadaAte = integration?.configuracoes_avancadas?.pausada_ate;
  if (pausadaAte && new Date(pausadaAte).getTime() > Date.now()) {
    return { blocked: true, reason: 'integracao_pausada' };
  }

  return { blocked: false };
}

// ── COOLDOWN ─────────────────────────────────────────────────────────────────
function checkCooldown({ contact, now, skip }) {
  if (skip) return { ok: true };
  const last = contact?.last_any_promo_sent_at ? new Date(contact.last_any_promo_sent_at) : null;
  if (!last) return { ok: true };

  const gap = now - last;
  const tipo = String(contact.tipo_contato || '').toLowerCase();
  const limite = tipo === 'eventual' ? FORTY_EIGHT_HOURS_MS : TWELVE_HOURS_MS;

  if (gap >= limite) return { ok: true };
  return { ok: false, reason: tipo === 'eventual' ? 'cooldown_eventual_48h' : 'cooldown_universal_12h' };
}

// ── HUMANO ATIVO ────────────────────────────────────────────────────────────
function isHumanActive({ thread, now, stalenessHours = 8 }) {
  if (!thread?.assigned_user_id) return false;
  const last = thread.last_human_message_at ? new Date(thread.last_human_message_at) : null;
  if (!last) return false;
  return (now - last) / 3600000 < stalenessHours;
}

// ── JANELA META 24H ─────────────────────────────────────────────────────────
function checkJanelaMeta({ thread, now, skip }) {
  if (skip) return { ok: true };
  const lastInbound = thread?.last_inbound_at ? new Date(thread.last_inbound_at) : null;
  const janelaExpira = thread?.janela_24h_expira_em
    ? new Date(thread.janela_24h_expira_em)
    : (lastInbound ? new Date(lastInbound.getTime() + 24 * 60 * 60 * 1000) : null);
  if (!janelaExpira || now > janelaExpira) {
    return { ok: false, reason: 'janela_24h_meta_expirada' };
  }
  return { ok: true };
}

// ── ELEGIBILIDADE / SELEÇÃO ─────────────────────────────────────────────────
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

function pickPromotion(promos, contact, skipRotation = false) {
  if (!promos?.length) return null;
  const lastIds = Array.isArray(contact?.last_promo_ids) ? contact.last_promo_ids : [];
  let candidates = skipRotation ? promos : promos.filter(p => !lastIds.includes(p.id));
  if (!candidates.length) candidates = promos;
  const topPrio = candidates[0].priority || 10;
  const pool = candidates.filter(p => (p.priority || 10) === topPrio);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── FORMATAÇÃO DE MENSAGEM (FONTE ÚNICA) ────────────────────────────────────
function formatPromotionMessage(promo) {
  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *${promo.titulo || 'Oferta Especial'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (promo.descricao_curta || promo.descricao) msg += `${promo.descricao_curta || promo.descricao}\n\n`;
  if (promo.price_info) msg += `💰 *${promo.price_info}*\n\n`;
  if (promo.validade) msg += `⏰ *Válido até:* ${new Date(promo.validade).toLocaleDateString('pt-BR')}\n\n`;
  if (promo.link_produto) msg += `🔗 ${promo.link_produto}\n\n`;
  msg += `_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨`;
  return msg;
}

// ── LOG DE AUDITORIA ────────────────────────────────────────────────────────
async function logDispatch(base44, data) {
  try {
    await base44.asServiceRole.entities.PromotionDispatchLog.create(data);
  } catch (e) {
    console.warn('[enviarPromocao] logDispatch falhou (non-blocking):', e.message);
  }
}

// ── HANDLER PRINCIPAL ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();

  try {
    const body = await req.json();
    const {
      contact_id,
      promotion_id = null,
      trigger,
      integration_id = null,
      thread_id = null,
      skip_cooldown = false,
      skip_rotation = false,
      skip_janela_meta = false,
      skip_human_check = false,
      campaign_id = null,
      initiated_by = 'system'
    } = body;

    // Validações básicas
    if (!contact_id) {
      return Response.json({ success: false, error: 'contact_id obrigatório' }, { status: 400 });
    }
    if (!trigger) {
      return Response.json({ success: false, error: 'trigger obrigatório' }, { status: 400 });
    }

    // 1. Carregar contato
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contact?.telefone) {
      await logDispatch(base44, {
        trigger, promotion_id: promotion_id || 'none', contact_id,
        status: 'bloqueada', bloqueio_motivo: 'no_contact_or_phone',
        campaign_id, initiated_by
      });
      return Response.json({ success: false, status: 'bloqueada', reason: 'no_contact_or_phone' });
    }

    // 2. Carregar/criar thread
    let thread = null;
    if (thread_id) {
      thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    }
    if (!thread) {
      const threads = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id, is_canonical: true
      });
      thread = threads[0];
    }

    // 3. Carregar integração
    let integration = null;
    if (integration_id) {
      integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    }
    if (!integration) {
      const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      integration = (thread?.whatsapp_integration_id && ints.find(i => i.id === thread.whatsapp_integration_id)) || ints[0];
    }
    if (!integration) {
      await logDispatch(base44, {
        trigger, promotion_id: promotion_id || 'none', contact_id, contact_nome: contact.nome,
        status: 'bloqueada', bloqueio_motivo: 'no_integration',
        campaign_id, initiated_by
      });
      return Response.json({ success: false, status: 'bloqueada', reason: 'no_integration' });
    }

    // 4. BLOQUEIOS ABSOLUTOS
    const block = isBlocked({ contact, thread, integration, trigger });
    if (block.blocked) {
      await logDispatch(base44, {
        trigger, promotion_id: promotion_id || 'none', contact_id, contact_nome: contact.nome,
        thread_id: thread?.id, integration_id: integration.id,
        status: 'bloqueada', bloqueio_motivo: block.reason,
        campaign_id, initiated_by
      });
      return Response.json({ success: false, status: 'bloqueada', reason: block.reason });
    }

    // 5. JANELA META 24H (só quando temos thread)
    if (thread) {
      const janela = checkJanelaMeta({ thread, now, skip: skip_janela_meta });
      if (!janela.ok) {
        await logDispatch(base44, {
          trigger, promotion_id: promotion_id || 'none', contact_id, contact_nome: contact.nome,
          thread_id: thread.id, integration_id: integration.id,
          status: 'bloqueada', bloqueio_motivo: janela.reason,
          campaign_id, initiated_by
        });
        return Response.json({ success: false, status: 'bloqueada', reason: janela.reason });
      }
    }

    // 6. HUMANO ATIVO (não bloqueia massa manual)
    if (thread && !skip_human_check && isHumanActive({ thread, now })) {
      await logDispatch(base44, {
        trigger, promotion_id: promotion_id || 'none', contact_id, contact_nome: contact.nome,
        thread_id: thread.id, integration_id: integration.id,
        status: 'bloqueada', bloqueio_motivo: 'human_active',
        campaign_id, initiated_by
      });
      return Response.json({ success: false, status: 'bloqueada', reason: 'human_active' });
    }

    // 7. COOLDOWN
    const cd = checkCooldown({ contact, now, skip: skip_cooldown });
    if (!cd.ok) {
      await logDispatch(base44, {
        trigger, promotion_id: promotion_id || 'none', contact_id, contact_nome: contact.nome,
        thread_id: thread?.id, integration_id: integration.id,
        status: 'bloqueada', bloqueio_motivo: cd.reason,
        campaign_id, initiated_by
      });
      return Response.json({ success: false, status: 'bloqueada', reason: cd.reason });
    }

    // 8. SELECIONAR PROMOÇÃO
    let promo = null;
    if (promotion_id) {
      promo = await base44.asServiceRole.entities.Promotion.get(promotion_id);
      if (!promo?.ativo) {
        return Response.json({ success: false, status: 'bloqueada', reason: 'promo_inativa' });
      }
      if (promo.validade && new Date(promo.validade) < now) {
        return Response.json({ success: false, status: 'bloqueada', reason: 'promo_expirada' });
      }
    } else {
      const all = await base44.asServiceRole.entities.Promotion.filter({ ativo: true });
      const valid = (all || []).filter(p => {
        if (p.validade && new Date(p.validade) < now) return false;
        if (p.limite_envios_total > 0 && (p.contador_envios || 0) >= p.limite_envios_total) return false;
        return true;
      }).sort((a, b) => (a.priority || 10) - (b.priority || 10));
      const eligible = filterEligiblePromotions(valid, contact, thread);
      promo = pickPromotion(eligible, contact, skip_rotation);
    }

    if (!promo) {
      await logDispatch(base44, {
        trigger, promotion_id: 'none', contact_id, contact_nome: contact.nome,
        thread_id: thread?.id, integration_id: integration.id,
        status: 'bloqueada', bloqueio_motivo: 'no_eligible_promo',
        campaign_id, initiated_by
      });
      return Response.json({ success: false, status: 'bloqueada', reason: 'no_eligible_promo' });
    }

    // 9. ENVIAR VIA GATEWAY
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
      await logDispatch(base44, {
        trigger, promotion_id: promo.id, promotion_titulo: promo.titulo,
        contact_id, contact_nome: contact.nome,
        thread_id: thread?.id, integration_id: integration.id,
        status: 'erro', erro_mensagem: resp?.data?.error || 'erro_envio',
        campaign_id, initiated_by
      });
      return Response.json({ success: false, status: 'erro', error: resp?.data?.error });
    }

    // 10. PERSISTIR MESSAGE
    if (thread) {
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
          whatsapp_integration_id: integration.id,
          is_system_message: true,
          message_type: 'promotion',
          promotion_id: promo.id,
          trigger,
          campaign_id
        }
      });
    }

    // 11. ATUALIZAR CONTATO + PROMOÇÃO + THREAD (em paralelo)
    const lastIds = Array.isArray(contact.last_promo_ids) ? contact.last_promo_ids : [];
    const nextIds = [promo.id, ...lastIds.filter(id => id !== promo.id)].slice(0, 3);

    const updates = [
      base44.asServiceRole.entities.Contact.update(contact.id, {
        last_any_promo_sent_at: now.toISOString(),
        last_promo_ids: nextIds,
        ...(trigger === 'inbound_6h' && { last_promo_inbound_at: now.toISOString() }),
        ...(trigger === 'batch_36h' && { last_promo_batch_at: now.toISOString() }),
        promocoes_recebidas: {
          ...(contact.promocoes_recebidas || {}),
          [promo.id]: ((contact.promocoes_recebidas || {})[promo.id] || 0) + 1
        }
      }),
      base44.asServiceRole.entities.Promotion.update(promo.id, {
        contador_envios: (promo.contador_envios || 0) + 1
      })
    ];

    if (thread && trigger === 'inbound_6h') {
      updates.push(
        base44.asServiceRole.entities.MessageThread.update(thread.id, {
          thread_last_promo_inbound_at: now.toISOString(),
          thread_last_promo_inbound_id: promo.id
        })
      );
    }

    await Promise.all(updates);

    // 12. AUDITORIA
    await logDispatch(base44, {
      trigger,
      promotion_id: promo.id,
      promotion_titulo: promo.titulo,
      contact_id: contact.id,
      contact_nome: contact.nome,
      thread_id: thread?.id,
      integration_id: integration.id,
      campaign_id,
      status: 'enviada',
      message_id: resp.data.message_id,
      mensagem_enviada: msg.substring(0, 500),
      tem_midia: !!promo.imagem_url,
      initiated_by
    });

    console.log(`[enviarPromocao ${VERSION}] ✅ ${contact.nome}: ${promo.titulo} (trigger=${trigger})`);

    return Response.json({
      success: true,
      status: 'enviada',
      message_id: resp.data.message_id,
      promotion_id: promo.id,
      promotion_titulo: promo.titulo,
      contact_id: contact.id,
      trigger
    });

  } catch (error) {
    console.error('[enviarPromocao] ❌ ERRO GERAL:', error);
    return Response.json({ success: false, status: 'erro', error: error.message }, { status: 500 });
  }
});