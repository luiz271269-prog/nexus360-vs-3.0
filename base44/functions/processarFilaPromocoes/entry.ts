// redeploy: 2026-03-03T14:35
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// --- Inline from promotionEngine (NO local imports allowed in Deno Edge) ---

function readLastPromoIds(contact) {
  const v = contact?.last_promo_ids;
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function writeLastPromoIds(lastIds, newId) {
  return [newId, ...lastIds.filter(id => id !== newId)].slice(0, 3);
}

function formatPromotionMessage(promo) {
  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *${promo.titulo || 'Oferta Especial'}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (promo.descricao_curta || promo.descricao) msg += `${promo.descricao_curta || promo.descricao}\n\n`;
  if (promo.price_info) msg += `💰 *${promo.price_info}*\n\n`;
  if (promo.validade) msg += `⏰ *Válido até:* ${new Date(promo.validade).toLocaleDateString('pt-BR')}\n\n`;
  if (promo.link_produto) msg += `🔗 ${promo.link_produto}\n\n`;
  msg += `_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨`;
  return msg;
}

async function sendPromotion(base44, { contact, thread, integration_id, promo, trigger }) {
  const msg = formatPromotionMessage(promo);
  const now = new Date();

  const payload = { integration_id, numero_destino: contact.telefone };
  if (promo.imagem_url && promo.tipo_midia === 'image') {
    payload.media_url = promo.imagem_url;
    payload.media_type = 'image';
    payload.media_caption = msg;
  } else {
    payload.mensagem = msg;
  }

  const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', payload);
  if (!resp?.data?.success) throw new Error(resp?.data?.error || 'erro_envio_promocao');

  await base44.asServiceRole.entities.Message.create({
    thread_id: thread.id,
    sender_id: 'system',
    sender_type: 'user',
    recipient_id: contact.id,
    recipient_type: 'contact',
    content: msg,
    channel: 'whatsapp',
    status: 'enviada',
    whatsapp_message_id: resp.data.message_id,
    sent_at: now.toISOString(),
    media_url: promo.imagem_url || null,
    media_type: promo.imagem_url ? 'image' : 'none',
    media_caption: promo.imagem_url ? msg : null,
    metadata: { whatsapp_integration_id: integration_id, is_system_message: true, message_type: 'promotion', promotion_id: promo.id, trigger }
  });

  await base44.asServiceRole.entities.Contact.update(contact.id, { last_any_promo_sent_at: now.toISOString() });
  return { message_id: resp.data.message_id, text: msg };
}
// --- End inline ---

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