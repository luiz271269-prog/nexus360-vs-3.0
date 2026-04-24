// v2.0 — delega ao motor único enviarPromocao
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ============================================================================
// PROCESSADOR DA FILA DE PROMOÇÕES — v2.0
// ============================================================================
// Executa a cada 5-30 min via automação.
// Processa WorkQueueItems do tipo 'enviar_promocao' agendados.
// Cada item vira 1 chamada ao motor único enviarPromocao (trigger=fila_agendada).
// Toda lógica de bloqueio/cooldown/formatação vive no motor.
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();

  try {
    console.log('[FILA-PROMO v2] Processando...');

    const items = await base44.asServiceRole.entities.WorkQueueItem.filter({
      tipo: 'enviar_promocao',
      status: 'agendado',
      scheduled_for: { $lte: now.toISOString() }
    }, 'scheduled_for', 50);

    console.log(`[FILA-PROMO] ${items.length} itens prontos`);
    if (!items.length) return Response.json({ success: true, processados: 0 });

    let processados = 0;
    let erros = 0;
    let bloqueados = 0;

    for (const item of items) {
      try {
        const { contact_id, thread_id, payload } = item;
        const { promotion_id, integration_id, trigger: triggerOrig } = payload;

        // Cancelar se cliente respondeu depois da saudação
        if (thread_id) {
          const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null);
          if (thread?.last_inbound_at && new Date(thread.last_inbound_at) > new Date(item.metadata?.saudacao_enviada_em || 0)) {
            console.log(`[FILA-PROMO] ⚠️ cliente respondeu - cancelando`);
            await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
              status: 'cancelado',
              metadata: { ...item.metadata, cancelado_motivo: 'cliente_respondeu' }
            });
            processados++;
            continue;
          }
        }

        // Delegar pro motor único
        const resp = await base44.asServiceRole.functions.invoke('enviarPromocao', {
          contact_id,
          promotion_id,
          thread_id,
          integration_id,
          trigger: 'fila_agendada',
          initiated_by: 'cron:processarFilaPromocoes',
          campaign_id: triggerOrig === 'lote_urgentes' ? `lote_urgentes_${payload.lote_id || 'default'}` : null
        });

        if (resp?.data?.success) {
          await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
            status: 'processado',
            processed_at: now.toISOString()
          });
          processados++;
        } else if (resp?.data?.status === 'bloqueada') {
          await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
            status: 'cancelado',
            metadata: { ...item.metadata, bloqueio_motivo: resp.data.reason }
          });
          bloqueados++;
        } else {
          throw new Error(resp?.data?.error || 'erro_desconhecido');
        }

        await new Promise(r => setTimeout(r, 600));

      } catch (error) {
        console.error('[FILA-PROMO] ❌', error.message);
        await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
          status: 'erro',
          metadata: { ...item.metadata, erro: error.message }
        }).catch(() => {});
        erros++;
      }
    }

    return Response.json({
      success: true,
      processados,
      bloqueados,
      erros,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[FILA-PROMO] ERRO GERAL:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});