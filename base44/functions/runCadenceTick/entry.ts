import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// CADENCE TICK - Motor de Cadência 1/7..5/7
// ============================================================================
// Executa ciclos de engajamento automático para contatos inativos
// ============================================================================

const GLOBAL_DAILY_CAP_DEFAULT = 200;
const PER_CONTACT_DAILY_CAP_DEFAULT = 1;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const nowISO = now.toISOString();
    
    console.log('[CADENCE] Iniciando tick | Now:', nowISO);
    
    // Buscar políticas ativas
    const policies = await base44.asServiceRole.entities.CyclePolicy.filter({
      active: true
    });
    
    if (policies.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhuma política ativa encontrada'
      });
    }
    
    console.log('[CADENCE] Políticas ativas:', policies.length);
    
    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      blocked: 0,
      errors: [],
      reasons: {}
    };
    
    // Contador global de envios no dia
    const today = now.toISOString().split('T')[0];
    const sentTodayLogs = await base44.asServiceRole.entities.EngagementLog.filter({
      type: 'cadence',
      sent_at: { $gte: today + 'T00:00:00.000Z' },
      status: 'sent'
    });
    let globalSentToday = sentTodayLogs.length;
    
    // Buscar estados elegíveis (status=active e next_touch_at <= now)
    const eligibleStates = await base44.asServiceRole.entities.ContactEngagementState.filter({
      status: 'active',
      next_touch_at: { $lte: nowISO }
    }, 'next_touch_at', 100);
    
    console.log('[CADENCE] Estados elegíveis:', eligibleStates.length);
    
    for (const state of eligibleStates) {
      try {
        results.processed++;
        
        // Verificar cap global
        if (globalSentToday >= GLOBAL_DAILY_CAP_DEFAULT) {
          console.log('[CADENCE] Cap global atingido');
          break;
        }
        
        // Buscar política aplicável
        const policy = policies.find(p => p.id === state.cycle_policy_id);
        if (!policy) {
          results.skipped++;
          results.reasons['no_policy'] = (results.reasons['no_policy'] || 0) + 1;
          continue;
        }
        
        // Buscar contato
        const contact = await base44.asServiceRole.entities.Contact.get(state.contact_id);
        if (!contact) {
          results.skipped++;
          results.reasons['contact_not_found'] = (results.reasons['contact_not_found'] || 0) + 1;
          continue;
        }
        
        // Verificar opt-out
        if (contact.tags && contact.tags.includes('opt_out')) {
          await base44.asServiceRole.entities.ContactEngagementState.update(state.id, {
            status: 'opted_out'
          });
          results.blocked++;
          results.reasons['opted_out'] = (results.reasons['opted_out'] || 0) + 1;
          continue;
        }
        
        // Verificar thread e humano ativo
        let thread = null;
        if (state.last_thread_id) {
          thread = await base44.asServiceRole.entities.MessageThread.get(state.last_thread_id);
          
          if (thread && thread.assigned_user_id) {
            // Verificar se humano está stale
            const lastMessageDate = thread.last_message_at ? new Date(thread.last_message_at) : null;
            if (lastMessageDate) {
              const hoursSinceLastMessage = (now - lastMessageDate) / (1000 * 60 * 60);
              if (hoursSinceLastMessage < 8) {
                // Humano ativo, bloquear
                await createLog(base44, {
                  contact_id: state.contact_id,
                  thread_id: thread.id,
                  type: 'cadence',
                  stage: state.stage_current,
                  status: 'blocked',
                  reason: 'human_active',
                  dedupe_key: `${state.contact_id}_${state.stage_current}_${today}`
                });
                
                results.blocked++;
                results.reasons['human_active'] = (results.reasons['human_active'] || 0) + 1;
                continue;
              }
            }
          }
        }
        
        // Verificar janela de horário
        const currentHour = now.getHours();
        const currentDay = now.getDay();
        
        const windowStart = policy.time_window_start ? parseInt(policy.time_window_start.split(':')[0]) : 9;
        const windowEnd = policy.time_window_end ? parseInt(policy.time_window_end.split(':')[0]) : 18;
        const allowedDays = policy.days_of_week || [1, 2, 3, 4, 5];
        
        if (currentHour < windowStart || currentHour >= windowEnd || !allowedDays.includes(currentDay)) {
          results.skipped++;
          results.reasons['outside_window'] = (results.reasons['outside_window'] || 0) + 1;
          continue;
        }
        
        // Verificar cap por contato
        const sentTodayForContact = sentTodayLogs.filter(log => log.contact_id === state.contact_id).length;
        const perContactCap = policy.per_contact_daily_cap || PER_CONTACT_DAILY_CAP_DEFAULT;
        
        if (sentTodayForContact >= perContactCap) {
          results.skipped++;
          results.reasons['per_contact_cap'] = (results.reasons['per_contact_cap'] || 0) + 1;
          continue;
        }
        
        // Verificar cooldown
        if (state.cooldown_until && new Date(state.cooldown_until) > now) {
          results.skipped++;
          results.reasons['cooldown'] = (results.reasons['cooldown'] || 0) + 1;
          continue;
        }
        
        // Encontrar stage atual
        const currentStageIndex = policy.stages.findIndex(s => s.stage_label === state.stage_current);
        if (currentStageIndex === -1) {
          results.skipped++;
          results.reasons['invalid_stage'] = (results.reasons['invalid_stage'] || 0) + 1;
          continue;
        }
        
        const currentStage = policy.stages[currentStageIndex];
        
        // Enviar mensagem
        const messageText = currentStage.message_template
          .replace('{nome}', contact.nome || contact.telefone)
          .replace('{stage}', state.stage_current);
        
        // Determinar integração (usar a mais recente do thread ou primeira disponível)
        let integration = null;
        if (thread && thread.whatsapp_integration_id) {
          integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id);
        } else {
          const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
            status: 'conectado'
          }, '-created_date', 1);
          if (integrations.length > 0) {
            integration = integrations[0];
          }
        }
        
        if (!integration) {
          results.blocked++;
          results.reasons['no_integration'] = (results.reasons['no_integration'] || 0) + 1;
          continue;
        }
        
        // Enviar via provider (Z-API ou W-API)
        let messageId = null;
        let provider = 'z_api';
        
        try {
          if (integration.api_provider === 'z_api') {
            const zapiUrl = `${integration.base_url_provider}/instances/${integration.instance_id_provider}/token/${integration.api_key_provider}/send-text`;
            const zapiHeaders = { 'Content-Type': 'application/json' };
            if (integration.security_client_token_header) {
              zapiHeaders['Client-Token'] = integration.security_client_token_header;
            }
            
            const response = await fetch(zapiUrl, {
              method: 'POST',
              headers: zapiHeaders,
              body: JSON.stringify({ phone: contact.telefone, message: messageText })
            });
            
            const data = await response.json();
            if (response.ok && !data.error) {
              messageId = data.messageId;
            } else {
              throw new Error(data.error || 'Erro no envio Z-API');
            }
          } else if (integration.api_provider === 'w_api') {
            provider = 'w_api';
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
                text: messageText
              })
            });
            
            const data = await response.json();
            if (response.ok && data.key?.id) {
              messageId = data.key.id;
            } else {
              throw new Error(data.error || 'Erro no envio W-API');
            }
          }
          
          // Registrar log de sucesso
          await createLog(base44, {
            contact_id: state.contact_id,
            thread_id: thread?.id || null,
            type: 'cadence',
            stage: state.stage_current,
            sent_at: nowISO,
            status: 'sent',
            dedupe_key: `${state.contact_id}_${state.stage_current}_${today}`,
            provider: provider,
            message_id: messageId
          });
          
          // Avançar para próximo stage
          const nextStageIndex = currentStageIndex + 1;
          let nextState = {};
          
          if (nextStageIndex < policy.stages.length) {
            const nextStage = policy.stages[nextStageIndex];
            const nextTouchDate = new Date(now);
            nextTouchDate.setHours(nextTouchDate.getHours() + nextStage.delay_hours);
            
            nextState = {
              stage_current: nextStage.stage_label,
              next_touch_at: nextTouchDate.toISOString(),
              last_touch_at: nowISO,
              version: state.version + 1
            };
          } else {
            // Ciclo completo
            nextState = {
              status: 'completed',
              last_touch_at: nowISO,
              next_touch_at: null,
              version: state.version + 1
            };
          }
          
          await base44.asServiceRole.entities.ContactEngagementState.update(state.id, nextState);
          
          results.sent++;
          globalSentToday++;
          
        } catch (sendError) {
          console.error('[CADENCE] Erro ao enviar:', sendError.message);
          
          await createLog(base44, {
            contact_id: state.contact_id,
            thread_id: thread?.id || null,
            type: 'cadence',
            stage: state.stage_current,
            status: 'failed',
            reason: sendError.message,
            dedupe_key: `${state.contact_id}_${state.stage_current}_${today}`,
            provider: provider
          });
          
          results.errors.push({
            contact_id: state.contact_id,
            error: sendError.message
          });
        }
        
      } catch (error) {
        console.error('[CADENCE] Erro ao processar estado:', state.id, error.message);
        results.errors.push({
          state_id: state.id,
          error: error.message
        });
      }
    }
    
    console.log('[CADENCE] Concluído:', results);
    
    return Response.json({
      success: true,
      summary: results,
      timestamp: nowISO
    });
    
  } catch (error) {
    console.error('[CADENCE] Erro geral:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

async function createLog(base44, data) {
  try {
    await base44.asServiceRole.entities.EngagementLog.create(data);
  } catch (error) {
    console.error('[CADENCE] Erro ao criar log:', error.message);
  }
}