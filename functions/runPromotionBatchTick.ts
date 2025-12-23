import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import {
  isBlocked, 
  getActivePromotions, 
  filterEligiblePromotions,
  pickPromotion,
  readLastPromoIds,
  writeLastPromoIds,
  canSendBatch24h,
  sendPromotion
} from './lib/promotionEngine.js';

// ============================================================================
// CRON JOB - PROMOÇÕES BATCH (24h base ativa)
// ============================================================================
// Executar diariamente ou a cada 6h via cron
// Envia promoções para contatos lead/cliente que não receberam batch há 24h
// ============================================================================

const VERSION = 'v3.0.0-DETERMINISTIC';
const BATCH_LIMIT = 50;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();
  
  try {
    console.log(`[PROMO-BATCH ${VERSION}] Iniciando...`);
    
    // Buscar promoções ativas - FILTRANDO POR STAGE='24h' (Correção #4)
    const promos = await getActivePromotions(base44, now, '24h');
    if (!promos.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_active_24h_promos' });
    }

    // Buscar contatos elegíveis (lead/cliente ativos)
    const contacts = await base44.asServiceRole.entities.Contact.filter({
      tipo_contato: { $in: ['lead', 'cliente', 'LEAD', 'CLIENTE'] }
    }, '-updated_date', 300);

    console.log(`[PROMO-BATCH] ${contacts.length} contatos lead/cliente`);

    if (!contacts.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_eligible_contacts' });
    }

    // Buscar integrações ativas
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });

    if (!integracoes.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_active_integrations' });
    }

    let sent = 0;
    let skipped = 0;
    const reasons = {};

    for (const contact of contacts) {
      if (sent >= BATCH_LIMIT) break;

      try {
        if (!contact?.telefone) {
          skipped++;
          reasons['no_phone'] = (reasons['no_phone'] || 0) + 1;
          continue;
        }

        // GUARDA 1: Cooldown batch 24h
        const cd = canSendBatch24h({ contact, now });
        if (!cd.ok) {
          skipped++;
          reasons[cd.reason] = (reasons[cd.reason] || 0) + 1;
          continue;
        }

        // Buscar thread principal do contato
        const threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contact.id
        }, '-updated_date', 1);

        if (!threads?.length) {
          skipped++;
          reasons['no_thread'] = (reasons['no_thread'] || 0) + 1;
          continue;
        }

        const thread = threads[0];
        
        // Determinar integração (priorizar a da thread)
        const integration = integracoes.find(i => i.id === thread.whatsapp_integration_id) || integracoes[0];
        
        if (!integration) {
          skipped++;
          reasons['no_integration'] = (reasons['no_integration'] || 0) + 1;
          continue;
        }

        // GUARDA 2: Bloqueios absolutos
        const setorTipo = null;
        const block = isBlocked({ contact, thread, integration, setorTipo });
        if (block.blocked) {
          skipped++;
          reasons[block.reason] = (reasons[block.reason] || 0) + 1;
          continue;
        }

        // Filtrar e selecionar promoção
        const eligible = filterEligiblePromotions(promos, contact, thread);
        const promo = pickPromotion(eligible, contact);
        
        if (!promo) {
          skipped++;
          reasons['no_eligible_promo'] = (reasons['no_eligible_promo'] || 0) + 1;
          continue;
        }

        // ENVIAR
        await sendPromotion(base44, { 
          contact, 
          thread, 
          integration_id: integration.id, 
          promo, 
          trigger: 'batch_24h' 
        });

        // Atualizar controles (usando helpers exportados do engine)
        const lastIds = readLastPromoIds(contact);
        const nextIds = writeLastPromoIds(lastIds, promo.id);

        await base44.asServiceRole.entities.Contact.update(contact.id, {
          last_promo_batch_at: now.toISOString(),
          last_promo_ids: nextIds,
          promocoes_recebidas: {
            ...(contact.promocoes_recebidas || {}),
            [promo.id]: ((contact.promocoes_recebidas || {})[promo.id] || 0) + 1
          }
        });

        // Log de engajamento
        await base44.asServiceRole.entities.EngagementLog.create({
          contact_id: contact.id,
          thread_id: thread.id,
          type: 'offer',
          sent_at: now.toISOString(),
          status: 'sent',
          metadata: {
            promotion_id: promo.id,
            trigger: 'batch_24h'
          }
        });

        sent++;
        console.log(`[PROMO-BATCH] ✅ ${contact.nome}: ${promo.titulo}`);

        // Anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        skipped++;
        reasons['error'] = (reasons['error'] || 0) + 1;
        console.error('[PROMO-BATCH] ❌', error.message);
      }
    }

    console.log('[PROMO-BATCH] Concluído:', { sent, skipped, reasons });

    return Response.json({
      success: true,
      sent,
      skipped,
      reasons,
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