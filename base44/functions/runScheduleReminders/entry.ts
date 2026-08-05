import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════════════
// 🔔 WORKER DE LEMBRETES - AGENDA IA NEXUS
// ═══════════════════════════════════════════════════════════════════════════
// Worker que roda a cada 15 minutos (workflow "Motor de Lembretes Agenda IA"):
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
    }, 'send_at', 20); // Reduzido de 100 para 20 para evitar timeout
    
    if (!reminders || reminders.length === 0) {
      console.log(`[REMINDER-WORKER] ℹ️ Nenhum lembrete pendente`);
      return Response.json({ success: true, sent: 0 });
    }
    
    console.log(`[REMINDER-WORKER] 📋 Encontrados ${reminders.length} lembretes pendentes`);
    
    let enviados = 0;
    let falhas = 0;
    
    for (const reminder of reminders) {
      try {
        const isTask = Boolean(reminder.task_id);
        const scheduleItem = isTask
          ? await base44.asServiceRole.entities.ScheduleTask.get(reminder.task_id).catch(() => null)
          : await base44.asServiceRole.entities.ScheduleEvent.get(reminder.event_id).catch(() => null);

        if (!scheduleItem) {
          await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_details: isTask ? 'Tarefa não encontrada' : 'Evento não encontrado'
          });
          falhas++;
          continue;
        }

        const finalStatuses = isTask ? ['concluida', 'cancelada'] : ['cancelled', 'completed'];
        if (finalStatuses.includes(scheduleItem.status)) {
          await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
            status: 'skipped',
            error_details: `Atividade ${scheduleItem.status}`
          });
          continue;
        }

        const scheduledAt = scheduleItem.prazo_em || scheduleItem.start_at;
        const formattedAt = new Date(scheduledAt).toLocaleString('pt-BR', {
          timeZone: scheduleItem.timezone || 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'short'
        });
        const itemTitle = scheduleItem.titulo || scheduleItem.title;
        const itemDescription = scheduleItem.descricao || scheduleItem.description;
        const mensagemLembrete = `🔔 **Lembrete de Agenda**

📌 ${itemTitle}
📅 ${formattedAt}
${itemDescription ? `📝 ${itemDescription}` : ''}

_Agenda Operacional Nexus_`;
        
        // Enviar lembrete via Central de Comunicação
        let enviouComSucesso = false;
        let pushEntregue = null;

        // 🔔 PUSH (padrão smartphone) — abre o item na Agenda ao tocar
        const enviarPush = async () => {
          try {
            const res = await base44.asServiceRole.functions.invoke('enviarWakeUpPush', {
              target_user_id: reminder.target_user_id,
              tipo: 'message',
              title: `🔔 ${itemTitle}`,
              body: `${formattedAt}${itemDescription ? ` • ${itemDescription}` : ''}`,
              action_url: `/Agenda?item=${scheduleItem.id}`
            });
            return Boolean(res?.sent || res?.data?.sent);
          } catch (e) {
            console.warn(`[REMINDER-WORKER] ⚠️ Push falhou: ${e.message}`);
            return false;
          }
        };
        
        if (reminder.channel === 'whatsapp_external') {
          // 📱 ENVIAR VIA WHATSAPP EXTERNO
          try {
            // Buscar usuário e contato do usuário (se tiver telefone cadastrado)
            const targetUser = await base44.asServiceRole.entities.User.get(reminder.target_user_id);
            
            // Buscar Contact vinculado ao user (pelo email ou telefone)
            let contactUser = null;
            if (targetUser.telefone) {
              const contacts = await base44.asServiceRole.entities.Contact.filter({
                telefone: targetUser.telefone
              }, '-created_date', 1);
              contactUser = contacts?.[0];
            }
            
            if (!contactUser || !contactUser.telefone) {
              throw new Error('Usuário sem telefone cadastrado para WhatsApp');
            }
            
            // 🛡️ BLOQUEIO DE CONTEXTO: se houve conversa recente (2h) na thread
            // deste contato, adia o lembrete em 24h em vez de disparar no meio da conversa
            const threadsContato = await base44.asServiceRole.entities.MessageThread.filter({
              contact_id: contactUser.id,
              thread_type: 'contact_external',
              is_canonical: true
            }, '-last_message_at', 1).catch(() => []);
            
            const ultimaAtividade = threadsContato?.[0]?.last_message_at;
            if (ultimaAtividade && (Date.now() - new Date(ultimaAtividade).getTime()) < 2 * 60 * 60 * 1000) {
              const novoSendAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
              await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
                send_at: novoSendAt,
                error_details: `Adiado por contexto: conversa ativa em ${ultimaAtividade}`
              });
              console.log(`[REMINDER-WORKER] 🛡️ Contexto ativo na thread do contato ${contactUser.id} — lembrete adiado 24h`);
              continue;
            }
            
            // Buscar integração WhatsApp ativa
            const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
              status: 'conectado'
            }, '-created_date', 1);
            
            if (!integracoes || integracoes.length === 0) {
              throw new Error('Nenhuma integração WhatsApp ativa');
            }
            
            // Enviar via WhatsApp
            try {
              const result = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
                integration_id: integracoes[0].id,
                numero_destino: contactUser.telefone,
                mensagem: mensagemLembrete
              });
              
              // Verificar sucesso (pode vir em diferentes formatos)
              const success = result?.success || result?.data?.success || (result?.status && result.status < 400);
              if (success) {
                enviouComSucesso = true;
                console.log(`[REMINDER-WORKER] 📱 WhatsApp enviado para ${contactUser.telefone}`);
              } else {
                console.warn(`[REMINDER-WORKER] ⚠️ WhatsApp retornou sucesso=false: ${JSON.stringify(result).substring(0, 100)}`);
              }
            } catch (whatsappErr) {
              console.warn(`[REMINDER-WORKER] ⚠️ WhatsApp invoke falhou: ${whatsappErr.message}`);
            }
          } catch (e) {
            console.error(`[REMINDER-WORKER] ❌ Erro WhatsApp externo:`, e.message);
          }
        } else if (reminder.channel === 'push') {
          // 📲 SOMENTE PUSH
          enviouComSucesso = await enviarPush();
        } else if (['app', 'desktop', 'internal', 'whatsapp_internal'].includes(reminder.channel)) {
          // 💬 ENVIAR VIA MENSAGEM INTERNA (SIMPLIFICADO — sem funções extras que podem falhar)
          try {
            // Buscar usuário alvo
            const targetUser = await base44.asServiceRole.entities.User.get(reminder.target_user_id).catch(() => null);
            
            if (!targetUser) {
              throw new Error(`Usuário ${reminder.target_user_id} não encontrado`);
            }
            
            // ✅ FIX: Criar message direto na thread 1:1 do user (sem invocar funções extras que podem timeout)
            // Usar pair_key para encontrar thread existente
            const minId = ['AGENDA_IA_NEXUS', reminder.target_user_id].sort()[0];
            const maxId = ['AGENDA_IA_NEXUS', reminder.target_user_id].sort()[1];
            const pairKey = `${minId}:${maxId}`;
            
            let threadId = null;
            const existingThreads = await base44.asServiceRole.entities.MessageThread.filter({
              pair_key: pairKey,
              thread_type: 'team_internal'
            }, '-created_date', 1).catch(() => []);
            
            if (existingThreads?.length > 0) {
              threadId = existingThreads[0].id;
            } else {
              // Criar thread 1:1 diretamente
              const newThread = await base44.asServiceRole.entities.MessageThread.create({
                pair_key: pairKey,
                thread_type: 'team_internal',
                participants: ['AGENDA_IA_NEXUS', reminder.target_user_id],
                is_group_chat: false,
                channel: 'interno',
                status: 'aberta',
                unread_by: {}
              }).catch(() => null);
              
              if (newThread?.id) {
                threadId = newThread.id;
              }
            }
            
            // Enviar mensagem se thread foi encontrada/criada
            if (threadId) {
              await base44.asServiceRole.entities.Message.create({
                thread_id: threadId,
                sender_id: 'AGENDA_IA_NEXUS',
                sender_type: 'user',
                content: mensagemLembrete,
                channel: 'interno',
                visibility: 'internal_only',
                provider: 'internal_system',
                status: 'enviada',
                sent_at: new Date().toISOString()
              });
              
              enviouComSucesso = true;
              console.log(`[REMINDER-WORKER] 💬 Mensagem interna enviada para ${reminder.target_user_id}`);
              pushEntregue = await enviarPush();
              if (!pushEntregue) {
                console.warn(`[REMINDER-WORKER] 📵 Push não entregue (chat interno OK) para ${reminder.target_user_id}`);
              }
            }
          } catch (e) {
            console.warn(`[REMINDER-WORKER] ⚠️ Erro ao enviar interno: ${e.message}`);
          }
        } else if (reminder.channel === 'email') {
          // 📧 ENVIAR POR E-MAIL (usuário registrado do app)
          try {
            const targetUser = await base44.asServiceRole.entities.User.get(reminder.target_user_id).catch(() => null);
            if (!targetUser?.email) throw new Error('Usuário sem e-mail cadastrado');

            await base44.asServiceRole.integrations.Core.SendEmail({
              to: targetUser.email,
              subject: `🔔 Lembrete de Agenda: ${itemTitle}`,
              body: mensagemLembrete
            });
            enviouComSucesso = true;
            console.log(`[REMINDER-WORKER] 📧 E-mail enviado para ${targetUser.email}`);
          } catch (e) {
            console.warn(`[REMINDER-WORKER] ⚠️ Erro ao enviar e-mail: ${e.message}`);
          }
        } else {
          // Canal desconhecido — não faz sentido tentar 3x
          await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_details: `Canal não suportado: ${reminder.channel}`
          });
          falhas++;
          continue;
        }
        
        if (enviouComSucesso) {
          const sentAt = new Date().toISOString();
          await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
            status: 'sent',
            sent_at: sentAt
          });
          await base44.asServiceRole.entities.ScheduleActivityLog.create({
            task_id: reminder.task_id,
            event_id: reminder.event_id,
            acao: 'lembrete_enviado',
            usuario_id: reminder.target_user_id,
            data_em: sentAt,
            origem: 'sistema',
            visible_user_ids: [reminder.target_user_id]
          }).catch(() => null);
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