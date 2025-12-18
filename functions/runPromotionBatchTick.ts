import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// CAMPANHA BATCH DE PROMOÇÕES - Envio para Base Ativa (24h)
// ============================================================================
// Executa periodicamente (cron) para enviar promoções para contatos ativos
// que não receberam promoção nas últimas 24 horas
// ============================================================================

const VERSION = 'v1.0.0';
const COOLDOWN_HOURS = 24;
const BATCH_LIMIT = 50; // Máximo de envios por execução

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();
  
  try {
    console.log(`[PROMO-BATCH ${VERSION}] Iniciando tick...`);
    
    // Importar helpers do promotionEngine
    const { 
      isBlockedFromPromotions, 
      filterEligiblePromotions, 
      pickNextPromotion,
      formatPromotionMessage
    } = await import('./lib/promotionEngine.js');
    
    // Buscar todas as promoções ativas
    const allPromotions = await base44.asServiceRole.entities.Promotion.filter({
      ativo: true
    });
    
    if (allPromotions.length === 0) {
      console.log('[PROMO-BATCH] Nenhuma promoção ativa');
      return Response.json({ 
        success: true, 
        processed: 0, 
        reason: 'no_active_promotions' 
      });
    }
    
    // Buscar contatos elegíveis
    // - Tipo: lead ou cliente
    // - Ativo
    // - Não recebeu promoção nas últimas 24h (ou nunca)
    const contacts = await base44.asServiceRole.entities.Contact.filter({
      tipo_contato: { $in: ['lead', 'cliente'] }
    }, '-ultima_interacao', 500);
    
    console.log(`[PROMO-BATCH] ${contacts.length} contatos lead/cliente encontrados`);
    
    // Buscar todas as integrações WhatsApp ativas
    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });
    
    if (integrations.length === 0) {
      console.log('[PROMO-BATCH] Nenhuma integração WhatsApp conectada');
      return Response.json({ 
        success: true, 
        processed: 0, 
        reason: 'no_active_integrations' 
      });
    }
    
    // Estatísticas
    const stats = {
      processed: 0,
      sent: 0,
      blocked: 0,
      cooldown: 0,
      no_integration: 0,
      no_eligible_promo: 0,
      errors: 0
    };
    
    // Processar em batch
    for (const contact of contacts) {
      // Limite de envios por execução
      if (stats.sent >= BATCH_LIMIT) {
        console.log(`[PROMO-BATCH] Limite de ${BATCH_LIMIT} envios atingido`);
        break;
      }
      
      stats.processed++;
      
      // Buscar thread do contato (última thread)
      const threads = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: contact.id
      }, '-last_message_at', 1);
      
      const thread = threads.length > 0 ? threads[0] : null;
      
      // Determinar integração a usar (priorizar a da thread ou primeira disponível)
      let integration = null;
      if (thread?.whatsapp_integration_id) {
        integration = integrations.find(i => i.id === thread.whatsapp_integration_id);
      }
      if (!integration) {
        integration = integrations[0]; // Fallback para primeira integração
      }
      
      if (!integration) {
        stats.no_integration++;
        continue;
      }
      
      // Bloqueios absolutos
      const blockCheck = isBlockedFromPromotions(contact, thread || {}, integration);
      if (blockCheck.blocked) {
        stats.blocked++;
        continue;
      }
      
      // Verificar cooldown de 24h
      if (contact.last_promo_sent_at) {
        const lastPromoDate = new Date(contact.last_promo_sent_at);
        const hoursGap = (now - lastPromoDate) / (1000 * 60 * 60);
        if (hoursGap < COOLDOWN_HOURS) {
          stats.cooldown++;
          continue;
        }
      }
      
      // Filtrar promoções elegíveis
      const eligible = filterEligiblePromotions(allPromotions, contact, thread || {});
      
      if (eligible.length === 0) {
        stats.no_eligible_promo++;
        continue;
      }
      
      // Rotacionar promoções
      const promotion = pickNextPromotion(eligible, contact);
      
      if (!promotion) {
        stats.no_eligible_promo++;
        continue;
      }
      
      // Formatar mensagem (sempre direct para batch)
      const rawMessage = formatPromotionMessage(promotion, contact, 'direct');
      
      // ✅ Processar mensagem com segurança de emoji
      const { processTextWithEmojis, emojiDebug } = await import('./lib/emojiHelper.js');
      const message = processTextWithEmojis(rawMessage);
      emojiDebug('BATCH_PROMO_OUTBOUND', message);
      
      // Determinar provider
      const provider = integration.api_provider === 'w_api' ? 'w_api' : 'z_api';
      
      // Enviar
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
            throw new Error(data.error || 'Erro no envio Z-API');
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
            throw new Error(data.error || 'Erro no envio W-API');
          }
        }
        
        // Atualizar contato com histórico de envios
        const promocoesRecebidas = contact.promocoes_recebidas || {};
        const contagemAtual = promocoesRecebidas[promotion.id] || 0;
        
        await base44.asServiceRole.entities.Contact.update(contact.id, {
          last_promo_sent_at: now.toISOString(),
          last_promo_id: promotion.id,
          promocoes_recebidas: {
            ...promocoesRecebidas,
            [promotion.id]: contagemAtual + 1
          }
        });
        
        // Atualizar thread se existir
        if (thread) {
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            thread_last_promo_sent_at: now.toISOString()
          });
        }
        
        // Registrar log
        await base44.asServiceRole.entities.EngagementLog.create({
          contact_id: contact.id,
          thread_id: thread?.id,
          type: 'offer',
          sent_at: now.toISOString(),
          status: 'sent',
          provider: provider,
          message_id: messageId,
          metadata: {
            promotion_id: promotion.id,
            promotion_titulo: promotion.titulo,
            format: 'direct',
            trigger: 'batch_24h'
          }
        });
        
        stats.sent++;
        console.log(`[PROMO-BATCH] ✅ Enviado para ${contact.nome}: ${promotion.titulo}`);
        
        // Pequeno delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`[PROMO-BATCH] ❌ Erro ao enviar para ${contact.nome}:`, error.message);
        stats.errors++;
        
        // Registrar falha
        await base44.asServiceRole.entities.EngagementLog.create({
          contact_id: contact.id,
          thread_id: thread?.id,
          type: 'offer',
          status: 'failed',
          reason: error.message,
          provider: provider
        });
      }
    }
    
    console.log('[PROMO-BATCH] Concluído:', stats);
    
    return Response.json({
      success: true,
      stats: stats,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('[PROMO-BATCH] ERRO GERAL:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});