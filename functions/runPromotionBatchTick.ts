import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import {
  isBlocked, 
  getActivePromotions, 
  filterEligiblePromotions,
  pickPromotion,
  readLastPromoIds,
  writeLastPromoIds,
  canSendUniversalPromo,
  sendPromotion
} from './lib/promotionEngine.js';

// ============================================================================
// CRON JOB - PROMOÇÕES BATCH (36h inatividade completa)
// ============================================================================
// Executar diariamente ou a cada 6h via cron
// Envia promoções para threads sem NENHUMA comunicação (enviada ou recebida) há 36h
// ============================================================================

const VERSION = 'v4.0.0-INACTIVITY-36H';
const BATCH_LIMIT = 50;
const THIRTY_SIX_HOURS_AGO = (now) => new Date(now.getTime() - 36 * 60 * 60 * 1000);

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();
  
  try {
    console.log(`[PROMO-BATCH ${VERSION}] Iniciando...`);
    
    // Buscar promoções ativas - FILTRANDO POR STAGE='36h'
    const promos = await getActivePromotions(base44, now, '36h');
    if (!promos.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_active_36h_promos' });
    }

    // Buscar threads INATIVAS há 36h+ (last_message_at considera qualquer mensagem)
    const inactiveSince = THIRTY_SIX_HOURS_AGO(now).toISOString();
    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      last_message_at: { $lte: inactiveSince },
      thread_type: 'contact_external'
    }, '-last_message_at', 200);

    console.log(`[PROMO-BATCH] ${threads.length} threads inativas há 36h+`);

    if (!threads.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_inactive_threads' });
    }

    // Buscar integrações ativas
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });

    if (!integracoes.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_active_integrations' });
    }

    const integracoesMap = new Map(integracoes.map(i => [i.id, i]));

    let sent = 0;
    let skipped = 0;
    const reasons = {};

    for (const thread of threads) {
      if (sent >= BATCH_LIMIT) break;

      try {
        // Buscar contato
        const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
        if (!contact?.telefone) {
          skipped++;
          reasons['no_contact_or_phone'] = (reasons['no_contact_or_phone'] || 0) + 1;
          continue;
        }

        // GUARDA 0: WhatsApp status inválido/bloqueado
        if (['invalido', 'bloqueado'].includes(contact.whatsapp_status)) {
          skipped++;
          reasons['whatsapp_status_invalido'] = (reasons['whatsapp_status_invalido'] || 0) + 1;
          continue;
        }

        // GUARDA META: Janela de 24h — batch só pode enviar dentro da janela de conversa ativa
        // Fora de 24h desde o último inbound exige template aprovado (não implementado)
        const vinteQuatroHorasAtras = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const lastInboundBatch = thread.last_inbound_at ? new Date(thread.last_inbound_at) : null;
        if (!lastInboundBatch || lastInboundBatch < vinteQuatroHorasAtras) {
          // Fora da janela de 24h — apenas enviar se tiver template aprovado configurado
          // Por enquanto, bloquear para evitar ban
          skipped++;
          reasons['fora_janela_24h_meta'] = (reasons['fora_janela_24h_meta'] || 0) + 1;
          continue;
        }

        // GUARDA 1: Cooldown universal 12h (entre qualquer promoção)
        const cd = canSendUniversalPromo({ contact, now });
        if (!cd.ok) {
          skipped++;
          reasons[cd.reason] = (reasons[cd.reason] || 0) + 1;
          continue;
        }

        // Determinar integração
        const integration = integracoesMap.get(thread.whatsapp_integration_id) || integracoes[0];
        
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

        // ENVIAR (sendPromotion já atualiza last_any_promo_sent_at)
        await sendPromotion(base44, { 
          contact, 
          thread, 
          integration_id: integration.id, 
          promo, 
          trigger: 'batch_36h' 
        });

        // Atualizar controles específicos do batch
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
            trigger: 'batch_36h',
            hours_inactive: ((now - new Date(thread.last_message_at)) / (1000 * 60 * 60)).toFixed(1)
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