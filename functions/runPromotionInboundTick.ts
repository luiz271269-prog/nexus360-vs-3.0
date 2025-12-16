import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// CRON JOB - TRIGGER INBOUND DE PROMOÇÕES (6h)
// ============================================================================
// Executar a cada 1 hora via cron
// Busca threads onde última mensagem foi há 6-7h e envia promoção
// Completamente independente da URA
// ============================================================================

const VERSION = 'v1.0.0-INBOUND-6H';
const TRIGGER_WINDOW_MIN_HOURS = 6;
const TRIGGER_WINDOW_MAX_HOURS = 7;
const BATCH_LIMIT = 30; // Máximo de envios por execução

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();
  
  try {
    console.log(`[PROMO-INBOUND-TICK ${VERSION}] Iniciando...`);
    
    // Calcular janela: última promoção foi há 6+ horas
    const sixHoursAgo = new Date(now);
    sixHoursAgo.setHours(sixHoursAgo.getHours() - TRIGGER_WINDOW_MIN_HOURS);
    
    console.log(`[PROMO-INBOUND-TICK] Buscando contatos com última promo antes de ${sixHoursAgo.toISOString()}`);
    
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
      console.log('[PROMO-INBOUND-TICK] Nenhuma promoção ativa');
      return Response.json({ 
        success: true, 
        processed: 0, 
        reason: 'no_active_promotions' 
      });
    }
    
    // Buscar contatos ativos (lead/cliente) que:
    // 1. Nunca receberam promoção (last_promo_sent_at = null) OU
    // 2. Última promoção foi há 6+ horas
    // 3. Tiveram atividade recente (última mensagem < 7 dias)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const allContacts = await base44.asServiceRole.entities.Contact.filter({
      tipo_contato: { $in: ['lead', 'cliente'] },
      ultima_interacao: { $gte: sevenDaysAgo.toISOString() }
    }, '-ultima_interacao', 500);
    
    // Filtrar contatos que passaram pelo cooldown de 6h
    const eligibleContacts = allContacts.filter(c => {
      if (!c.last_promo_sent_at) return true; // Nunca recebeu
      const lastPromoDate = new Date(c.last_promo_sent_at);
      return lastPromoDate < sixHoursAgo; // Última promo há 6+ horas
    });
    
    console.log(`[PROMO-INBOUND-TICK] ${eligibleContacts.length} contatos elegíveis (cooldown 6h passou)`);
    
    if (eligibleContacts.length === 0) {
      return Response.json({ 
        success: true, 
        processed: 0,
        reason: 'no_contacts_past_cooldown',
        cooldown_threshold: sixHoursAgo.toISOString()
      });
    }
    
    // Buscar threads desses contatos
    const contactIds = eligibleContacts.map(c => c.id);
    const allThreads = await base44.asServiceRole.entities.MessageThread.filter({
      contact_id: { $in: contactIds },
      status: 'aberta'
    }, '-last_message_at', 500);
    
    console.log(`[PROMO-INBOUND-TICK] ${allThreads.length} threads encontradas na janela`);
    
    if (allThreads.length === 0) {
      return Response.json({ 
        success: true, 
        processed: 0,
        reason: 'no_threads_in_window',
        window: { start: windowStart.toISOString(), end: windowEnd.toISOString() }
      });
    }
    
    // Buscar integrações ativas
    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });
    
    if (integrations.length === 0) {
      console.log('[PROMO-INBOUND-TICK] Nenhuma integração conectada');
      return Response.json({ 
        success: true, 
        processed: 0, 
        reason: 'no_active_integrations' 
      });
    }
    
    // Buscar contatos associados às threads
    const contactIds = [...new Set(allThreads.map(t => t.contact_id))];
    const contacts = await base44.asServiceRole.entities.Contact.filter({
      id: { $in: contactIds }
    });
    
    const contactMap = new Map(contacts.map(c => [c.id, c]));
    
    // Estatísticas
    const stats = {
      processed: 0,
      sent: 0,
      blocked: 0,
      cooldown: 0,
      no_integration: 0,
      no_eligible_promo: 0,
      human_active: 0,
      errors: 0
    };
    
    // Processar threads
    for (const thread of allThreads) {
      // Limite de envios
      if (stats.sent >= BATCH_LIMIT) {
        console.log(`[PROMO-INBOUND-TICK] Limite de ${BATCH_LIMIT} envios atingido`);
        break;
      }
      
      stats.processed++;
      
      const contact = contactMap.get(thread.contact_id);
      if (!contact) continue;
      
      // GUARDA 1: Verificar se humano está ativo (não enviar se atendente respondeu recentemente)
      if (thread.assigned_user_id && thread.last_message_sender === 'user') {
        const lastMessageDate = new Date(thread.last_message_at);
        const hoursGap = (now - lastMessageDate) / (1000 * 60 * 60);
        
        if (hoursGap < 8) {
          stats.human_active++;
          continue;
        }
      }
      
      // Determinar integração
      let integration = null;
      if (thread.whatsapp_integration_id) {
        integration = integrations.find(i => i.id === thread.whatsapp_integration_id);
      }
      if (!integration) {
        integration = integrations[0];
      }
      
      if (!integration) {
        stats.no_integration++;
        continue;
      }
      
      // GUARDA 2: Bloqueios absolutos (FORNECEDOR, FINANCEIRO, COMPRAS)
      const blockCheck = isBlockedFromPromotions(contact, thread, integration);
      if (blockCheck.blocked) {
        stats.blocked++;
        continue;
      }
      
      // GUARDA 3: Cooldown já foi verificado na query inicial (contatos elegíveis)
      // Mas verificamos novamente por segurança
      if (contact.last_promo_sent_at) {
        const lastPromoDate = new Date(contact.last_promo_sent_at);
        const hoursGap = (now - lastPromoDate) / (1000 * 60 * 60);
        if (hoursGap < TRIGGER_WINDOW_MIN_HOURS) {
          stats.cooldown++;
          continue;
        }
      }
      
      // Filtrar promoções elegíveis
      const eligible = filterEligiblePromotions(allPromotions, contact, thread);
      
      if (eligible.length === 0) {
        stats.no_eligible_promo++;
        continue;
      }
      
      // Rotacionar promoções (não repetir a última)
      const promotion = pickNextPromotion(eligible, contact);
      
      if (!promotion) {
        stats.no_eligible_promo++;
        continue;
      }
      
      // Determinar formato (direct se não tem setor, teaser se tem)
      const format = thread.sector_id ? 'teaser' : 'direct';
      const message = formatPromotionMessage(promotion, contact, format);
      
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
        
        // ✅ ATUALIZAR CONTATO (SEM ALTERAR ESTADOS DE URA)
        await base44.asServiceRole.entities.Contact.update(contact.id, {
          last_promo_sent_at: now.toISOString(),
          last_promo_id: promotion.id
        });
        
        // ✅ ATUALIZAR THREAD (SEM ALTERAR ESTADOS DE URA)
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          thread_last_promo_sent_at: now.toISOString()
        });
        
        // Registrar log
        await base44.asServiceRole.entities.EngagementLog.create({
          contact_id: contact.id,
          thread_id: thread.id,
          type: 'offer',
          sent_at: now.toISOString(),
          status: 'sent',
          provider: provider,
          message_id: messageId,
          metadata: {
            promotion_id: promotion.id,
            promotion_titulo: promotion.titulo,
            format: format,
            trigger: 'inbound_6h',
            hours_since_last_message: ((now - new Date(thread.last_message_at)) / (1000 * 60 * 60)).toFixed(1)
          }
        });
        
        // Registrar mensagem no sistema
        await base44.asServiceRole.entities.Message.create({
          thread_id: thread.id,
          sender_id: 'system',
          sender_type: 'user',
          content: message,
          channel: 'whatsapp',
          status: 'enviada',
          whatsapp_message_id: messageId,
          sent_at: now.toISOString(),
          metadata: {
            whatsapp_integration_id: integration.id,
            is_system_message: true,
            message_type: 'promotion',
            promotion_id: promotion.id,
            format: format,
            trigger: 'inbound_6h'
          }
        });
        
        stats.sent++;
        console.log(`[PROMO-INBOUND-TICK] ✅ Enviado para ${contact.nome}: ${promotion.titulo}`);
        
        // Delay anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`[PROMO-INBOUND-TICK] ❌ Erro ao enviar para ${contact.nome}:`, error.message);
        stats.errors++;
        
        // Registrar falha
        await base44.asServiceRole.entities.EngagementLog.create({
          contact_id: contact.id,
          thread_id: thread.id,
          type: 'offer',
          status: 'failed',
          reason: error.message,
          provider: provider,
          metadata: { trigger: 'inbound_6h' }
        });
      }
    }
    
    console.log('[PROMO-INBOUND-TICK] Concluído:', stats);
    
    return Response.json({
      success: true,
      stats: stats,
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString()
      },
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('[PROMO-INBOUND-TICK] ERRO GERAL:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});