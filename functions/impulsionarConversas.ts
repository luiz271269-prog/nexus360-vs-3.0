import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// MOTOR DE IMPULSIONAMENTO - 6h / 12h / 24h
// ============================================================================
// Esta função roda via CRON (a cada 1 hora) e identifica conversas paradas
// em janelas de tempo específicas (6h, 12h, 24h) para enviar promoções
// de forma progressiva e inteligente.
// ============================================================================

const VERSION = 'v1.0.0-BOOST-ENGINE';
const BATCH_LIMIT = 50; // Máximo de envios por execução (evita sobrecarga)

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();
  
  try {
    console.log(`[BOOST-ENGINE ${VERSION}] 🚀 INICIANDO | ${now.toISOString()}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // 1. CARREGAR PROMOÇÕES ATIVAS POR ESTÁGIO
    // ═══════════════════════════════════════════════════════════════════════
    const [promo6h, promo12h, promo24h] = await Promise.all([
      base44.asServiceRole.entities.Promotion.filter({ ativo: true, stage: '6h' }),
      base44.asServiceRole.entities.Promotion.filter({ ativo: true, stage: '12h' }),
      base44.asServiceRole.entities.Promotion.filter({ ativo: true, stage: '24h' })
    ]);
    
    console.log(`[BOOST-ENGINE] Promoções carregadas: 6h=${promo6h.length}, 12h=${promo12h.length}, 24h=${promo24h.length}`);
    
    if (promo6h.length === 0 && promo12h.length === 0 && promo24h.length === 0) {
      return Response.json({ 
        success: true, 
        processed: 0, 
        reason: 'no_active_promotions' 
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 2. BUSCAR THREADS CANDIDATAS (conversas abertas/aguardando)
    // ═══════════════════════════════════════════════════════════════════════
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const allThreads = await base44.asServiceRole.entities.MessageThread.filter({
      status: { $in: ['aberta', 'aguardando_cliente'] },
      last_message_at: { $gte: sevenDaysAgo.toISOString() } // Ativas nos últimos 7 dias
    }, '-last_message_at', 500);
    
    console.log(`[BOOST-ENGINE] ${allThreads.length} threads candidatas`);
    
    if (allThreads.length === 0) {
      return Response.json({ success: true, processed: 0, reason: 'no_threads' });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 3. BUSCAR INTEGRAÇÕES E CONTATOS
    // ═══════════════════════════════════════════════════════════════════════
    const [integrations, contacts] = await Promise.all([
      base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }),
      base44.asServiceRole.entities.Contact.filter({
        id: { $in: [...new Set(allThreads.map(t => t.contact_id))] }
      })
    ]);
    
    if (integrations.length === 0) {
      return Response.json({ success: true, processed: 0, reason: 'no_integrations' });
    }
    
    const contactMap = new Map(contacts.map(c => [c.id, c]));
    
    // ═══════════════════════════════════════════════════════════════════════
    // 4. IMPORTAR HELPERS DO PROMOTION ENGINE
    // ═══════════════════════════════════════════════════════════════════════
    const { 
      isBlockedFromPromotions, 
      filterEligiblePromotions, 
      pickNextPromotion,
      calculateNextStage,
      isCooldownExpired,
      isHumanActive,
      buildSendPayload,
      formatPromotionMessage
    } = await import('./lib/promotionEngine.js');
    
    const { processTextWithEmojis } = await import('./lib/emojiHelper.js');
    
    // ═══════════════════════════════════════════════════════════════════════
    // 5. PROCESSAR THREADS E ENVIAR PROMOÇÕES
    // ═══════════════════════════════════════════════════════════════════════
    const stats = {
      processed: 0,
      sent_6h: 0,
      sent_12h: 0,
      sent_24h: 0,
      blocked: 0,
      cooldown: 0,
      human_active: 0,
      no_integration: 0,
      no_eligible_promo: 0,
      errors: 0
    };
    
    for (const thread of allThreads) {
      // Limite de envios por execução
      if (stats.sent_6h + stats.sent_12h + stats.sent_24h >= BATCH_LIMIT) {
        console.log(`[BOOST-ENGINE] ⚠️ Limite de ${BATCH_LIMIT} envios atingido`);
        break;
      }
      
      stats.processed++;
      
      const contact = contactMap.get(thread.contact_id);
      if (!contact || !contact.telefone) continue;
      
      // ═══════════════════════════════════════════════════════════════════
      // GUARDAS DE SEGURANÇA
      // ═══════════════════════════════════════════════════════════════════
      
      // GUARDA 1: Verificar se humano está ativo
      if (isHumanActive(thread, 8)) {
        stats.human_active++;
        continue;
      }
      
      // GUARDA 2: Determinar integração
      let integration = integrations.find(i => i.id === thread.whatsapp_integration_id);
      if (!integration) integration = integrations[0];
      
      if (!integration) {
        stats.no_integration++;
        continue;
      }
      
      // GUARDA 3: Bloqueios absolutos
      const blockCheck = isBlockedFromPromotions(contact, thread, integration);
      if (blockCheck.blocked) {
        stats.blocked++;
        continue;
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // CALCULAR PRÓXIMO ESTÁGIO (6h → 12h → 24h)
      // ═══════════════════════════════════════════════════════════════════
      const nextStage = calculateNextStage(thread, now);
      
      if (!nextStage) {
        continue; // Não está em nenhuma janela de tempo válida
      }
      
      // Selecionar pool de promoções do estágio
      let promoPool = [];
      if (nextStage === '6h') promoPool = promo6h;
      if (nextStage === '12h') promoPool = promo12h;
      if (nextStage === '24h') promoPool = promo24h;
      
      if (promoPool.length === 0) continue;
      
      // GUARDA 4: Verificar cooldown
      const cooldownCheck = isCooldownExpired(thread, contact, promoPool[0].cooldown_hours || 6);
      if (!cooldownCheck.expired) {
        stats.cooldown++;
        continue;
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // SELECIONAR E ENVIAR PROMOÇÃO
      // ═══════════════════════════════════════════════════════════════════
      const eligible = filterEligiblePromotions(promoPool, contact, thread);
      
      if (eligible.length === 0) {
        stats.no_eligible_promo++;
        continue;
      }
      
      const promotion = pickNextPromotion(eligible, contact);
      
      if (!promotion) {
        stats.no_eligible_promo++;
        continue;
      }
      
      try {
        // Montar payload de envio
        const { payload, message } = buildSendPayload(promotion, contact, thread, integration, nextStage);
        
        // Processar texto com segurança de emoji
        const messageSafe = processTextWithEmojis(message);
        if (payload.mensagem) payload.mensagem = messageSafe;
        if (payload.media_caption) payload.media_caption = messageSafe;
        
        // Enviar via função unificada
        const resultadoEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', payload);
        
        if (!resultadoEnvio?.data?.success) {
          throw new Error(resultadoEnvio?.data?.error || 'Erro ao enviar');
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // REGISTRAR ENVIO E ATUALIZAR ESTADOS
        // ═══════════════════════════════════════════════════════════════════
        
        // Atualizar Contato
        await base44.asServiceRole.entities.Contact.update(contact.id, {
          last_promo_sent_at: now.toISOString(),
          last_promo_id: promotion.id
        });
        
        // Atualizar Thread
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          thread_last_promo_sent_at: now.toISOString(),
          autoboost_stage: `${nextStage}_sent`,
          last_boost_at: now.toISOString(),
          promo_cooldown_expires_at: new Date(now.getTime() + (promotion.cooldown_hours || 6) * 60 * 60 * 1000).toISOString()
        });
        
        // Registrar mensagem no sistema
        await base44.asServiceRole.entities.Message.create({
          thread_id: thread.id,
          sender_id: 'system',
          sender_type: 'user',
          recipient_id: contact.id,
          recipient_type: 'contact',
          content: messageSafe,
          channel: 'whatsapp',
          status: 'enviada',
          whatsapp_message_id: resultadoEnvio.data.message_id,
          sent_at: now.toISOString(),
          media_url: promotion.imagem_url || null,
          media_type: promotion.tipo_midia || 'none',
          media_caption: payload.media_caption || null,
          metadata: {
            whatsapp_integration_id: integration.id,
            is_system_message: true,
            message_type: 'promotion',
            promotion_id: promotion.id,
            promotion_stage: nextStage,
            format: promotion.formato || 'teaser',
            trigger: 'auto_boost'
          }
        });
        
        // Registrar log de engajamento
        await base44.asServiceRole.entities.EngagementLog.create({
          contact_id: contact.id,
          thread_id: thread.id,
          type: 'offer',
          sent_at: now.toISOString(),
          status: 'sent',
          provider: integration.api_provider,
          message_id: resultadoEnvio.data.message_id,
          metadata: {
            promotion_id: promotion.id,
            promotion_titulo: promotion.titulo,
            stage: nextStage,
            format: promotion.formato,
            trigger: 'auto_boost',
            hours_since_last_message: ((now - new Date(thread.last_message_at)) / (1000 * 60 * 60)).toFixed(1)
          }
        });
        
        // Atualizar métricas da promoção
        await base44.asServiceRole.entities.Promotion.update(promotion.id, {
          contador_envios: (promotion.contador_envios || 0) + 1
        });
        
        // Incrementar contador correto
        if (nextStage === '6h') stats.sent_6h++;
        if (nextStage === '12h') stats.sent_12h++;
        if (nextStage === '24h') stats.sent_24h++;
        
        console.log(`[BOOST-ENGINE] ✅ ${nextStage.toUpperCase()} enviado para ${contact.nome}: ${promotion.titulo}`);
        
        // Delay anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`[BOOST-ENGINE] ❌ Erro ao enviar para ${contact.nome}:`, error.message);
        stats.errors++;
        
        // Registrar falha
        await base44.asServiceRole.entities.EngagementLog.create({
          contact_id: contact.id,
          thread_id: thread.id,
          type: 'offer',
          status: 'failed',
          reason: error.message,
          provider: integration.api_provider,
          metadata: { 
            trigger: 'auto_boost',
            stage: nextStage,
            promotion_id: promotion.id
          }
        });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 6. RETORNAR ESTATÍSTICAS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[BOOST-ENGINE] ✅ Concluído:', stats);
    
    return Response.json({
      success: true,
      version: VERSION,
      stats: stats,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('[BOOST-ENGINE] ❌ ERRO GERAL:', error.message);
    console.error('[BOOST-ENGINE] Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      version: VERSION
    }, { status: 500 });
  }
});