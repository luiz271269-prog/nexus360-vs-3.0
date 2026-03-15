import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import {
  isBlocked, 
  getActivePromotions, 
  filterEligiblePromotions,
  pickPromotion,
  readLastPromoIds,
  writeLastPromoIds,
  canSendUniversalPromo,
  isHumanActive,
  sendPromotion
} from './lib/promotionEngine.js';

// ============================================================================
// CRON JOB - PROMOÇÕES INBOUND (6h após mensagem do cliente)
// ============================================================================
// Executar a cada 30 min via cron
// Busca threads onde last_inbound_at foi há 6+ horas
// Completamente independente da URA
// ============================================================================

const VERSION = 'v3.0.0-DETERMINISTIC';
const SIX_HOURS_AGO = (now) => new Date(now.getTime() - 6 * 60 * 60 * 1000);
const BATCH_LIMIT = 30;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();
  
  try {
    console.log(`[PROMO-INBOUND ${VERSION}] Iniciando...`);
    
    // Buscar promoções ativas - FILTRANDO POR STAGE='6h' (Correção #4)
    const promos = await getActivePromotions(base44, now, '6h');
    if (!promos.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_active_6h_promos' });
    }

    // Buscar threads "devidas" (last_inbound_at <= now-6h)
    const dueAt = SIX_HOURS_AGO(now).toISOString();
    const limitWindow = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(); // Limitar a 48h atrás
    
    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      last_inbound_at: { 
        $gte: limitWindow,
        $lte: dueAt 
      },
      status: 'aberta'
    }, '-last_inbound_at', 200);

    console.log(`[PROMO-INBOUND] ${threads.length} threads na janela 6h`);

    if (!threads.length) {
      return Response.json({ success: true, sent: 0, reason: 'no_threads_in_window' });
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
        // GUARDA 1: Já enviou promo inbound depois do último inbound?
        const lastInbound = thread.last_inbound_at ? new Date(thread.last_inbound_at) : null;
        const lastPromoInbound = thread.thread_last_promo_inbound_at ? new Date(thread.thread_last_promo_inbound_at) : null;
        
        if (!lastInbound) {
          skipped++;
          reasons['no_last_inbound'] = (reasons['no_last_inbound'] || 0) + 1;
          continue;
        }
        
        if (lastPromoInbound && lastPromoInbound >= lastInbound) {
          skipped++;
          reasons['already_sent_after_inbound'] = (reasons['already_sent_after_inbound'] || 0) + 1;
          continue;
        }

        // GUARDA 2: Humano ativo? (atendente conversando recentemente)
        if (isHumanActive({ thread, now, stalenessHours: 8 })) {
          skipped++;
          reasons['human_active'] = (reasons['human_active'] || 0) + 1;
          continue;
        }

        // Buscar contato
        const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
        if (!contact?.telefone) {
          skipped++;
          reasons['no_contact'] = (reasons['no_contact'] || 0) + 1;
          continue;
        }

        // GUARDA META: WhatsApp status inválido/bloqueado
        if (['invalido', 'bloqueado'].includes(contact.whatsapp_status)) {
          skipped++;
          reasons['whatsapp_status_invalido'] = (reasons['whatsapp_status_invalido'] || 0) + 1;
          continue;
        }

        // Buscar integração
        const integration = integracoesMap.get(thread.whatsapp_integration_id) || integracoes[0];
        if (!integration) {
          skipped++;
          reasons['no_integration'] = (reasons['no_integration'] || 0) + 1;
          continue;
        }

        // GUARDA 3: Bloqueios absolutos
        const setorTipo = null;
        const block = isBlocked({ contact, thread, integration, setorTipo });
        if (block.blocked) {
          skipped++;
          reasons[block.reason] = (reasons[block.reason] || 0) + 1;
          continue;
        }

        // GUARDA 4: Cooldown universal 12h (entre qualquer promoção)
        const cd = canSendUniversalPromo({ contact, now });
        if (!cd.ok) {
          skipped++;
          reasons[cd.reason] = (reasons[cd.reason] || 0) + 1;
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

        // GUARDA META: Janela de 24h — verificar se ainda está dentro da janela ativa
        const janelaExpiraEm = thread.janela_24h_expira_em
          ? new Date(thread.janela_24h_expira_em)
          : (lastInbound ? new Date(lastInbound.getTime() + 24 * 60 * 60 * 1000) : null);

        if (!janelaExpiraEm || now > janelaExpiraEm) {
          console.log(`[PROMO-INBOUND] ⛔ Janela 24h expirada para ${contact.nome} — pulando`);
          skipped++;
          reasons['janela_expirada'] = (reasons['janela_expirada'] || 0) + 1;
          continue;
        }

        // ENVIAR
        await sendPromotion(base44, { 
          contact, 
          thread, 
          integration_id: integration.id, 
          promo, 
          trigger: 'inbound_6h' 
        });

        // Atualizar controles
        const lastIds = readLastPromoIds(contact);
        const nextIds = writeLastPromoIds(lastIds, promo.id);

        await base44.asServiceRole.entities.Contact.update(contact.id, {
          last_promo_inbound_at: now.toISOString(),
          last_promo_ids: nextIds,
          promocoes_recebidas: {
            ...(contact.promocoes_recebidas || {}),
            [promo.id]: ((contact.promocoes_recebidas || {})[promo.id] || 0) + 1
          }
        });

        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          thread_last_promo_inbound_at: now.toISOString(),
          thread_last_promo_inbound_id: promo.id
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
            trigger: 'inbound_6h',
            hours_since_inbound: ((now - lastInbound) / (1000 * 60 * 60)).toFixed(1)
          }
        });

        sent++;
        console.log(`[PROMO-INBOUND] ✅ ${contact.nome}: ${promo.titulo}`);

        // Anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        skipped++;
        reasons['error'] = (reasons['error'] || 0) + 1;
        console.error('[PROMO-INBOUND] ❌', error.message);
      }
    }

    console.log('[PROMO-INBOUND] Concluído:', { sent, skipped, reasons });

    return Response.json({
      success: true,
      sent,
      skipped,
      reasons,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[PROMO-INBOUND] ERRO GERAL:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});