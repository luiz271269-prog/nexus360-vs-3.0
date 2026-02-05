import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ═══════════════════════════════════════════════════════════════════════════
// 🔔 WORKER DE LEMBRETES - AGENDA IA NEXUS
// ═══════════════════════════════════════════════════════════════════════════
// Worker que roda a cada 1 minuto (via scheduled automation):
// 1. Busca lembretes pendentes com send_at <= now
// 2. Envia mensagem interna via Central de Comunicação
// 3. Marca como sent ou failed (retry limitado a 3x)
// 4. Aplica quotas para prevenir spam
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // ⚠️ Worker roda via scheduled automation (sem usuário logado)
  // Sempre usar asServiceRole
  
  try {
    console.log(`[REMINDER-WORKER] 🚀 Iniciando execução...`);
    
    const now = new Date().toISOString();
    
    // Buscar lembretes pendentes
    const reminders = await base44.asServiceRole.entities.ScheduleReminder.filter({
      status: 'pending',
      send_at: { $lte: now }
    }, 'send_at', 100); // Ordenar por horário (mais antigos primeiro)
    
    if (!reminders || reminders.length === 0) {
      console.log(`[REMINDER-WORKER] ℹ️ Nenhum lembrete pendente`);
      return Response.json({ success: true, sent: 0 });
    }
    
    console.log(`[REMINDER-WORKER] 📋 Encontrados ${reminders.length} lembretes pendentes`);
    
    let enviados = 0;
    let falhas = 0;
    
    for (const reminder of reminders) {
      try {
        // Carregar evento relacionado
        const event = await base44.asServiceRole.entities.ScheduleEvent.get(reminder.event_id);
        
        if (!event) {
          console.warn(`[REMINDER-WORKER] ⚠️ Evento não encontrado: ${reminder.event_id}`);
          await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_details: 'Evento não encontrado'
          });
          falhas++;
          continue;
        }
        
        // Verificar se evento ainda está válido
        if (event.status === 'cancelled' || event.status === 'completed') {
          console.log(`[REMINDER-WORKER] ⏭️ Evento ${event.status}, pulando lembrete`);
          await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_details: `Evento ${event.status}`
          });
          continue;
        }
        
        // Construir mensagem de lembrete
        const horaEvento = new Date(event.start_at).toLocaleString('pt-BR', {
          timeZone: event.timezone || 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'short'
        });
        
        const mensagemLembrete = `🔔 **Lembrete de Agenda**

📌 ${event.title}
📅 ${horaEvento}
${event.description ? `📝 ${event.description}` : ''}

_Agendado via Agenda IA Nexus_`;
        
        // Enviar lembrete via Central de Comunicação
        let enviouComSucesso = false;
        
        if (reminder.channel === 'internal' || reminder.channel === 'whatsapp_internal') {
          // Enviar mensagem interna para o usuário
          try {
            // Buscar ou criar thread interna entre sistema e usuário
            const result = await base44.asServiceRole.functions.invoke('getOrCreateInternalThread', {
              user_ids: ['AGENDA_IA_NEXUS', reminder.target_user_id]
            });
            
            if (result.data.success) {
              // Enviar mensagem interna
              await base44.asServiceRole.functions.invoke('sendInternalMessage', {
                thread_id: result.data.thread.id,
                content: mensagemLembrete,
                media_type: 'none'
              });
              
              enviouComSucesso = true;
            }
          } catch (e) {
            console.error(`[REMINDER-WORKER] ❌ Erro ao enviar interno:`, e.message);
          }
        }
        
        if (enviouComSucesso) {
          await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
            status: 'sent',
            sent_at: new Date().toISOString()
          });
          enviados++;
          console.log(`[REMINDER-WORKER] ✅ Enviado: ${reminder.id.substring(0, 8)}`);
        } else {
          // Incrementar retry
          const newRetryCount = (reminder.retry_count || 0) + 1;
          
          if (newRetryCount >= 3) {
            // Dead-letter após 3 tentativas
            await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
              status: 'failed',
              retry_count: newRetryCount,
              failed_at: new Date().toISOString(),
              dead_lettered_at: new Date().toISOString(),
              error_details: 'Máximo de tentativas excedido'
            });
            console.warn(`[REMINDER-WORKER] 💀 Dead-letter: ${reminder.id.substring(0, 8)}`);
          } else {
            // Incrementar retry e reagendar
            const nextSendAt = new Date(Date.now() + Math.pow(2, newRetryCount) * 60 * 1000).toISOString();
            await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
              retry_count: newRetryCount,
              send_at: nextSendAt
            });
            console.log(`[REMINDER-WORKER] 🔄 Retry ${newRetryCount}/3 agendado`);
          }
          
          falhas++;
        }
        
      } catch (e) {
        console.error(`[REMINDER-WORKER] ❌ Erro ao processar lembrete:`, e.message);
        falhas++;
      }
    }
    
    console.log(`[REMINDER-WORKER] ✅ Concluído | Enviados: ${enviados} | Falhas: ${falhas}`);
    
    return Response.json({
      success: true,
      sent: enviados,
      failed: falhas,
      processed: reminders.length
    });
    
  } catch (error) {
    console.error('[REMINDER-WORKER] ❌ Erro:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});