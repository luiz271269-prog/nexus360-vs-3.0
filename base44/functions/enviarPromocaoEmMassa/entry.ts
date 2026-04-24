import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// ENVIO DE PROMOÇÃO EM MASSA (Nível 2 — Promoções × Broadcast)
// ============================================================================
// Pega uma Promotion cadastrada e usa o motor de Broadcast para enviar para
// múltiplos contatos, respeitando TODAS as proteções (tiers, horário, opt-out,
// anti-429, saturação) do BroadcastConfig.
//
// Frontend chama: base44.functions.invoke('enviarPromocaoEmMassa', {
//   promotion_id: '...',
//   contact_ids: [...],
//   integration_id: '...'  // opcional
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

    // Buscar promoção
    const promo = await base44.asServiceRole.entities.Promotion.get(promotion_id);
    if (!promo) return Response.json({ success: false, error: 'Promoção não encontrada' }, { status: 404 });
    if (!promo.ativo) return Response.json({ success: false, error: 'Promoção está inativa' }, { status: 400 });

    // Validade
    if (promo.validade && new Date(promo.validade) < new Date()) {
      return Response.json({ success: false, error: 'Promoção fora da validade' }, { status: 400 });
    }

    // Montar mensagem formatada
    let mensagem = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *${promo.titulo || 'Oferta Especial'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (promo.descricao_curta || promo.descricao) mensagem += `${promo.descricao_curta || promo.descricao}\n\n`;
    if (promo.price_info) mensagem += `💰 *${promo.price_info}*\n\n`;
    if (promo.validade) mensagem += `⏰ *Válido até:* ${new Date(promo.validade).toLocaleDateString('pt-BR')}\n\n`;
    if (promo.link_produto) mensagem += `🔗 ${promo.link_produto}\n\n`;
    mensagem += `_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨`;

    // Delegar pro motor de broadcast (que já tem TODAS as proteções)
    const resp = await base44.asServiceRole.functions.invoke('enviarCampanhaLote', {
      contact_ids,
      modo: 'broadcast',
      mensagem,
      personalizar: true,
      media_url: promo.imagem_url || null,
      media_type: promo.imagem_url ? 'image' : 'none',
      media_caption: null, // já está no mensagem
      integration_id
    });

    if (!resp?.data?.success) {
      return Response.json({
        success: false,
        error: resp?.data?.error || 'Erro no motor de broadcast',
        motivo: resp?.data?.motivo
      }, { status: 500 });
    }

    // Atualizar contador de envios da promoção
    const qtdEnviada = resp.data.enfileirados || 0;
    await base44.asServiceRole.entities.Promotion.update(promotion_id, {
      contador_envios: (promo.contador_envios || 0) + qtdEnviada
    }).catch(e => console.warn('[PromoEmMassa] Falha ao atualizar contador:', e.message));

    console.log(`[PromoEmMassa] ✅ ${qtdEnviada} envios enfileirados para promo "${promo.titulo}"`);

    return Response.json({
      success: true,
      promotion_id,
      promotion_titulo: promo.titulo,
      enfileirados: qtdEnviada,
      erros: resp.data.erros || 0,
      excedentes: resp.data.excedentes || 0,
      tier_aplicado: resp.data.tier_aplicado,
      janela_minutos: resp.data.janela_minutos,
      mensagem_status: resp.data.mensagem_status,
      broadcast_id: resp.data.broadcast_id
    });

  } catch (error) {
    console.error('[PromoEmMassa] ❌', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});