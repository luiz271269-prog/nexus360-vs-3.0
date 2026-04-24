import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ============================================================================
// ENVIO DE PROMOÇÃO EM MASSA (v2.0 — usa motor único + broadcast engine)
// ============================================================================
// Delega envio físico pro motor de Broadcast (tiers, delays, anti-ban)
// + registra cada contato no PromotionDispatchLog via trigger=massa_manual
//
// Frontend chama: base44.functions.invoke('enviarPromocaoEmMassa', {
//   promotion_id: '...',
//   contact_ids: [...],
//   integration_id: '...'   // opcional
// });
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { promotion_id, contact_ids = [], integration_id = null } = body;

    if (!promotion_id) return Response.json({ success: false, error: 'promotion_id obrigatório' }, { status: 400 });
    if (!contact_ids.length) return Response.json({ success: false, error: 'contact_ids vazio' }, { status: 400 });

    const promo = await base44.asServiceRole.entities.Promotion.get(promotion_id);
    if (!promo) return Response.json({ success: false, error: 'Promoção não encontrada' }, { status: 404 });
    if (!promo.ativo) return Response.json({ success: false, error: 'Promoção está inativa' }, { status: 400 });
    if (promo.validade && new Date(promo.validade) < new Date()) {
      return Response.json({ success: false, error: 'Promoção fora da validade' }, { status: 400 });
    }

    // ─ Montar mensagem (formato único do motor) ─
    let mensagem = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *${promo.titulo || 'Oferta Especial'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (promo.descricao_curta || promo.descricao) mensagem += `${promo.descricao_curta || promo.descricao}\n\n`;
    if (promo.price_info) mensagem += `💰 *${promo.price_info}*\n\n`;
    if (promo.validade) mensagem += `⏰ *Válido até:* ${new Date(promo.validade).toLocaleDateString('pt-BR')}\n\n`;
    if (promo.link_produto) mensagem += `🔗 ${promo.link_produto}\n\n`;
    mensagem += `_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨`;

    // ─ Delegar pro motor de broadcast (tiers, delays, anti-ban) ─
    const resp = await base44.asServiceRole.functions.invoke('enviarCampanhaLote', {
      contact_ids,
      modo: 'broadcast',
      mensagem,
      personalizar: true,
      media_url: promo.imagem_url || null,
      media_type: promo.imagem_url ? 'image' : 'none',
      media_caption: null,
      integration_id
    });

    if (!resp?.data?.success) {
      return Response.json({
        success: false,
        error: resp?.data?.error || 'Erro no motor de broadcast',
        motivo: resp?.data?.motivo
      }, { status: 500 });
    }

    const qtdEnviada = resp.data.enfileirados || 0;
    const campaignId = resp.data.broadcast_id || `promo_${promo.id}_${Date.now()}`;

    // ─ Atualizar contador da promoção ─
    await base44.asServiceRole.entities.Promotion.update(promotion_id, {
      contador_envios: (promo.contador_envios || 0) + qtdEnviada
    }).catch(e => console.warn('[PromoEmMassa] Falha contador:', e.message));

    // ─ Log de auditoria unificado (fire-and-forget em lote) ─
    (async () => {
      try {
        const contatos = await base44.asServiceRole.entities.Contact.filter({ id: { $in: contact_ids } });
        const contatosMap = new Map(contatos.map(c => [c.id, c]));

        const logs = (resp.data.resultados || []).map(r => ({
          trigger: 'massa_manual',
          promotion_id: promo.id,
          promotion_titulo: promo.titulo,
          contact_id: r.contact_id,
          contact_nome: contatosMap.get(r.contact_id)?.nome || r.nome,
          integration_id: integration_id || null,
          campaign_id: campaignId,
          status: r.status === 'enfileirado' ? 'enfileirada'
                : r.status === 'opt_out' ? 'bloqueada'
                : r.status === 'excedente' ? 'bloqueada'
                : r.status === 'erro' ? 'erro' : 'enfileirada',
          bloqueio_motivo: (r.status === 'opt_out' || r.status === 'excedente') ? r.motivo : null,
          erro_mensagem: r.status === 'erro' ? r.motivo : null,
          mensagem_enviada: mensagem.substring(0, 500),
          tem_midia: !!promo.imagem_url,
          initiated_by: user.email || user.id,
          metadata: { tier_aplicado: resp.data.tier_aplicado }
        }));

        // Bulk create em batches de 50 pra não estourar rate limit
        for (let i = 0; i < logs.length; i += 50) {
          await base44.asServiceRole.entities.PromotionDispatchLog.bulkCreate(logs.slice(i, i + 50));
        }
      } catch (e) {
        console.warn('[PromoEmMassa] Falha ao logar dispatches:', e.message);
      }
    })();

    console.log(`[PromoEmMassa] ✅ ${qtdEnviada} envios enfileirados para "${promo.titulo}" (campaign=${campaignId})`);

    return Response.json({
      success: true,
      promotion_id,
      promotion_titulo: promo.titulo,
      campaign_id: campaignId,
      enfileirados: qtdEnviada,
      erros: resp.data.erros || 0,
      excedentes: resp.data.excedentes || 0,
      tier_aplicado: resp.data.tier_aplicado,
      janela_minutos: resp.data.janela_minutos,
      mensagem_status: resp.data.mensagem_status,
      broadcast_id: campaignId
    });

  } catch (error) {
    console.error('[PromoEmMassa] ❌', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});