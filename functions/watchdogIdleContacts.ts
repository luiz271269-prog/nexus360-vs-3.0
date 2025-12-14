import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WATCHDOG - Monitoramento de Contatos Parados > 48h
// ============================================================================
// Não envia mensagens, apenas cria WorkQueueItem e atualiza EngagementState
// ============================================================================

const IDLE_THRESHOLD_HOURS = 48;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Calcular timestamp de 48h atrás
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - IDLE_THRESHOLD_HOURS);
    const thresholdISO = threshold.toISOString();
    
    console.log('[WATCHDOG] Iniciando varredura | Threshold:', thresholdISO);
    
    // Buscar todas as threads com última mensagem antes de 48h
    const allThreads = await base44.asServiceRole.entities.MessageThread.list('-last_message_at', 1000);
    
    const idleThreads = allThreads.filter(thread => {
      if (!thread.last_message_at) return false;
      if (!thread.contact_id) return false;
      if (thread.status === 'arquivada') return false;
      
      const lastMessageDate = new Date(thread.last_message_at);
      return lastMessageDate < threshold;
    });
    
    console.log('[WATCHDOG] Threads paradas encontradas:', idleThreads.length);
    
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    
    for (const thread of idleThreads) {
      try {
        results.processed++;
        
        // Verificar se já existe item na fila
        const existingItems = await base44.asServiceRole.entities.WorkQueueItem.filter({
          contact_id: thread.contact_id,
          status: { $in: ['open', 'in_progress'] }
        }, '-created_date', 1);
        
        if (existingItems.length > 0) {
          // Já existe, apenas atualizar se necessário
          const item = existingItems[0];
          if (item.reason !== 'idle_48h' || item.thread_id !== thread.id) {
            await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
              reason: 'idle_48h',
              thread_id: thread.id,
              severity: 'high'
            });
            results.updated++;
          } else {
            results.skipped++;
          }
          continue;
        }
        
        // Criar novo item na fila
        await base44.asServiceRole.entities.WorkQueueItem.create({
          contact_id: thread.contact_id,
          thread_id: thread.id,
          reason: 'idle_48h',
          severity: 'high',
          owner_sector_id: thread.sector_id || 'geral',
          owner_user_id: thread.assigned_user_id || null,
          status: 'open'
        });
        
        results.created++;
        
        // Atualizar ou criar ContactEngagementState
        const existingStates = await base44.asServiceRole.entities.ContactEngagementState.filter({
          contact_id: thread.contact_id
        }, '-created_date', 1);
        
        if (existingStates.length > 0) {
          const state = existingStates[0];
          await base44.asServiceRole.entities.ContactEngagementState.update(state.id, {
            last_inbound_at: thread.last_message_at,
            last_thread_id: thread.id,
            lock_reason: state.lock_reason || 'idle_48h'
          });
        } else {
          await base44.asServiceRole.entities.ContactEngagementState.create({
            contact_id: thread.contact_id,
            last_inbound_at: thread.last_message_at,
            last_thread_id: thread.id,
            status: 'paused',
            lock_reason: 'idle_48h'
          });
        }
        
      } catch (error) {
        console.error('[WATCHDOG] Erro ao processar thread:', thread.id, error.message);
        results.errors.push({ thread_id: thread.id, error: error.message });
      }
    }
    
    console.log('[WATCHDOG] Concluído:', results);
    
    return Response.json({
      success: true,
      summary: results,
      threshold: thresholdISO
    });
    
  } catch (error) {
    console.error('[WATCHDOG] Erro geral:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});