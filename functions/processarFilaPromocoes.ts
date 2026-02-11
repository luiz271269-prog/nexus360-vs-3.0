import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// PROCESSADOR DA FILA DE PROMOÇÕES
// ============================================================================
// Executar a cada 1 minuto via automação
// Processa WorkQueueItems do tipo 'enviar_promocao' que estão agendados
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

        // Montar mensagem da promoção
        let mensagemPromo = promo.descricao || promo.titulo;
        
        // Substituir placeholders
        mensagemPromo = mensagemPromo
          .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
          .replace(/\{\{empresa\}\}/gi, contato.empresa || '');

        // Adicionar preço se houver
        if (promo.price_info) {
          mensagemPromo += `\n\n💰 ${promo.price_info}`;
        }

        // Adicionar link se houver
        if (promo.link_produto) {
          mensagemPromo += `\n\n🔗 ${promo.link_produto}`;
        }

        // Enviar promoção
        const envioData = {
          thread_id,
          texto: mensagemPromo,
          integration_id
        };

        // Se tiver imagem, anexar
        if (promo.imagem_url && promo.tipo_midia === 'image') {
          envioData.media_url = promo.imagem_url;
          envioData.media_type = 'image';
          envioData.media_caption = promo.descricao_curta || promo.titulo;
        }

        await base44.asServiceRole.functions.invoke('enviarMensagemUnificada', envioData);

        // Atualizar controles no contato
        const lastPromoIds = contato.last_promo_ids || [];
        const nextIds = [promotion_id, ...lastPromoIds].slice(0, 3);

        await base44.asServiceRole.entities.Contact.update(contact_id, {
          last_promo_inbound_at: now.toISOString(),
          last_promo_ids: nextIds,
          promocoes_recebidas: {
            ...(contato.promocoes_recebidas || {}),
            [promotion_id]: ((contato.promocoes_recebidas || {})[promotion_id] || 0) + 1
          }
        });

        // Log de engajamento
        await base44.asServiceRole.entities.EngagementLog.create({
          contact_id,
          thread_id,
          type: 'offer',
          sent_at: now.toISOString(),
          status: 'sent',
          metadata: {
            promotion_id,
            trigger,
            via_lote_urgentes: true
          }
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