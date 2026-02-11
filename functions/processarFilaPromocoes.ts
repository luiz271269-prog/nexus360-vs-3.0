import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { sendPromotion, readLastPromoIds, writeLastPromoIds } from './lib/promotionEngine.js';

// ============================================================================
// PROCESSADOR DA FILA DE PROMOÇÕES
// ============================================================================
// Executar a cada 5 minutos via automação
// Processa WorkQueueItems do tipo 'enviar_promocao' que estão agendados
// Reutiliza promotionEngine.js para envio
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();
  
  try {
    console.log('[FILA-PROMO] Processando itens agendados...');

    // Buscar itens prontos para processar
    const items = await base44.asServiceRole.entities.WorkQueueItem.filter({
      tipo: 'enviar_promocao',
      status: 'agendado',
      scheduled_for: { $lte: now.toISOString() }
    }, 'scheduled_for', 50);

    console.log(`[FILA-PROMO] ${items.length} itens prontos`);

    if (!items.length) {
      return Response.json({ success: true, processados: 0 });
    }

    let processados = 0;
    let erros = 0;

    for (const item of items) {
      try {
        const { contact_id, thread_id, payload } = item;
        const { promotion_id, integration_id, trigger } = payload;

        // Buscar dados
        const [contato, thread, promo] = await Promise.all([
          base44.asServiceRole.entities.Contact.get(contact_id),
          base44.asServiceRole.entities.MessageThread.get(thread_id),
          base44.asServiceRole.entities.Promotion.get(promotion_id)
        ]);

        if (!contato || !thread || !promo) {
          throw new Error('Dados não encontrados');
        }

        // Verificar se já respondeu (cancelar promoção se sim)
        if (thread.last_inbound_at && new Date(thread.last_inbound_at) > new Date(item.metadata?.saudacao_enviada_em || 0)) {
          console.log(`[FILA-PROMO] ⚠️ ${contato.nome} respondeu - cancelando promoção`);
          await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
            status: 'cancelado',
            metadata: {
              ...item.metadata,
              cancelado_motivo: 'cliente_respondeu'
            }
          });
          processados++;
          continue;
        }

        // ✅ REUTILIZAR: sendPromotion() do promotionEngine
        // Já faz: formatação, envio, registro, atualização de controles
        await sendPromotion(base44, {
          contact: contato,
          thread,
          integration_id,
          promo,
          trigger: trigger || 'manual_lote_urgentes'
        });

        // ✅ REUTILIZAR: rotação inteligente de IDs
        const lastIds = readLastPromoIds(contato);
        const nextIds = writeLastPromoIds(lastIds, promotion_id);

        await base44.asServiceRole.entities.Contact.update(contact_id, {
          last_promo_inbound_at: now.toISOString(),
          last_promo_ids: nextIds
        });

        // Marcar item como processado
        await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
          status: 'processado',
          processed_at: now.toISOString()
        });

        console.log(`[FILA-PROMO] ✅ ${contato.nome}: ${promo.titulo}`);
        processados++;

        // Anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, 600));

      } catch (error) {
        console.error('[FILA-PROMO] ❌', error.message);
        
        // Marcar item como erro
        await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
          status: 'erro',
          metadata: {
            ...item.metadata,
            erro: error.message
          }
        }).catch(() => {});
        
        erros++;
      }
    }

    return Response.json({
      success: true,
      processados,
      erros,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[FILA-PROMO] ERRO GERAL:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});