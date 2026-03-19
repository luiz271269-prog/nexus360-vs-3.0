import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ═══════════════════════════════════════════════════════════════════════════
// 🗓️ AGENDA IA NEXUS - PROCESSADOR DE INTENÇÕES
// ═══════════════════════════════════════════════════════════════════════════
// Núcleo do fluxo da Agenda IA: recebe mensagem de thread marcada como
// assistant_mode='agenda', interpreta com IA, resolve escopo, cria evento.
//
// ENTRADA: { thread_id, message_id, text, from_type, from_id }
// SAÍDA: { success, action, event_id?, message_to_send }
//
// PIPELINE:
// 1. Load conversation state (se houver pendências)
// 2. Run agenda agent (IA extrai intenção)
// 3. Handle missing fields (pergunta e salva estado)
// 4. Resolve assigned user (escopo: responsável/fila/agenda_publica)
// 5. Confirm event summary (confirmação antes de gravar)
// 6. Create event + reminders (persistência)
// 7. Ack to requester (resposta final)
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    // ⚠️ Função pode ser chamada por webhook (sem user) ou por usuário interno
    // Se vier de webhook (externo), user = null
    
    const payload = await req.json();
    const { thread_id, message_id, text, from_type, from_id } = payload;

    if (!thread_id || !text || !from_type || !from_id) {
      return Response.json({ 
        success: false, 
        error: 'Campos obrigatórios: thread_id, text, from_type, from_id' 
      }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VALIDAÇÕES BÁSICAS (P1 - Segurança)
    // ═══════════════════════════════════════════════════════════════════════

    // Validar quota diária (anti-spam)
    const today = new Date().toISOString().split('T')[0];
    const existingToday = await base44.asServiceRole.entities.ScheduleEvent.filter({
      created_by_id: from_id,
      created_date: { $gte: `${today}T00:00:00`, $lte: `${today}T23:59:59` }
    });

    const MAX_EVENTS_PER_DAY = from_type === 'internal_user' ? 50 : 10;

    if (existingToday && existingToday.length >= MAX_EVENTS_PER_DAY) {
      console.log(`[AGENDA-IA] 🚫 Quota diária excedida: ${existingToday.length}/${MAX_EVENTS_PER_DAY}`);
      return Response.json({
        success: false,
        message_to_send: `⚠️ Você atingiu o limite de ${MAX_EVENTS_PER_DAY} eventos por dia. Tente novamente amanhã.`
      });
    }
    
    console.log(`[AGENDA-IA] 🚀 Processando mensagem | Thread: ${thread_id.substring(0, 8)} | Tipo: ${from_type}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSO 1: LOAD CONVERSATION STATE
    // ═══════════════════════════════════════════════════════════════════════
    const now = new Date().toISOString();
    let conversationState = null;
    
    try {
      const states = await base44.asServiceRole.entities.ScheduleConversationState.filter({
        thread_id,
        expires_at: { $gte: now }
      }, '-created_date', 1);
      
      if (states && states.length > 0) {
        conversationState = states[0];
        console.log(`[AGENDA-IA] 📋 Estado existente | Missing: ${conversationState.missing_fields?.length || 0}`);
      }
    } catch (e) {
      console.warn(`[AGENDA-IA] ⚠️ Erro ao carregar estado:`, e.message);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSO 2: RUN AGENDA AGENT (IA INTERPRETA)
    // ═══════════════════════════════════════════════════════════════════════
    const currentTime = new Date().toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'full',
      timeStyle: 'short'
    });
    
    // Detectar comando explícito primeiro
    const lowerText = text.toLowerCase();
    let forcedAction = null;

    if (lowerText.includes('listar') || lowerText.includes('minha agenda') || lowerText.includes('próximos')) {
      forcedAction = 'list';
    } else if (lowerText.includes('cancelar') || lowerText.includes('remover')) {
      forcedAction = 'cancel';
    } else if (lowerText.includes('remarcar') || lowerText.includes('mudar') || lowerText.includes('alterar')) {
      forcedAction = 'reschedule';
    }

    const prompt = `Você é o assistente de agenda Nexus. Hora atual: ${currentTime} (São Paulo).

    MENSAGEM DO USUÁRIO:
    ${text}

${conversationState?.pending_intent_json ? `
CONTEXTO DE CONVERSA ANTERIOR:
Intenção parcial: ${JSON.stringify(conversationState.pending_intent_json, null, 2)}
Campos faltantes: ${conversationState.missing_fields?.join(', ')}
` : ''}

TAREFA:
Extraia a intenção de agendamento e retorne JSON estruturado.

AÇÕES POSSÍVEIS:
- create: criar novo evento
- reschedule: alterar evento existente
- cancel: cancelar evento
- list: listar próximos eventos

REGRAS:
1. Se faltar informação essencial (data, hora, responsável), liste em missing_fields
2. Pergunte de forma objetiva se faltar dados
3. Se tiver confiança baixa (<0.7), sinalize em confidence
4. Horários: sempre em formato 24h (ex: 14:16)
5. Datas: YYYY-MM-DD

RETORNE JSON COM:
{
  "action": "create|reschedule|cancel|list",
  "title": "título do evento",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "timezone": "America/Sao_Paulo",
  "assigned_target": "nome do usuário interno OU 'self' se for para o próprio solicitante",
  "description": "detalhes adicionais",
  "reminders": [{"offset_minutes": 15, "channel": "internal"}],
  "missing_fields": ["date", "time", "assigned_user"],
  "question_to_ask": "pergunta objetiva se faltar campo",
  "confidence": 0.85,
  "risk_flags": ["precisa_confirmacao", "horario_passado"]
}`;

    let agendaIntent;
    try {
      agendaIntent = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["create", "reschedule", "cancel", "list"] },
            title: { type: "string" },
            date: { type: "string" },
            time: { type: "string" },
            timezone: { type: "string" },
            assigned_target: { type: "string" },
            description: { type: "string" },
            reminders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  offset_minutes: { type: "number" },
                  channel: { type: "string" }
                }
              }
            },
            missing_fields: { type: "array", items: { type: "string" } },
            question_to_ask: { type: "string" },
            confidence: { type: "number" },
            risk_flags: { type: "array", items: { type: "string" } }
          }
        }
      });
      
      // Forçar action se detectado comando explícito
      if (forcedAction) {
        agendaIntent.action = forcedAction;
      }

      console.log(`[AGENDA-IA] 🤖 IA Intent:`, agendaIntent);
    } catch (e) {
      console.error(`[AGENDA-IA] ❌ Erro na IA:`, e.message);
      return Response.json({
        success: false,
        error: 'Erro ao processar com IA',
        message_to_send: '❌ Desculpe, tive um problema ao processar sua solicitação. Tente novamente.'
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // HANDLE ACTION: LIST
    // ═══════════════════════════════════════════════════════════════════════
    if (agendaIntent.action === 'list') {
      console.log(`[AGENDA-IA] 📋 Listando eventos...`);

      const targetUserId = from_type === 'internal_user' ? from_id : null;

      if (!targetUserId) {
        return Response.json({
          success: false,
          message_to_send: '❌ Listagem de agenda só disponível para usuários internos'
        });
      }

      // Buscar eventos futuros do usuário
      const nowList = new Date().toISOString();
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const events = await base44.asServiceRole.entities.ScheduleEvent.filter({
        assigned_user_id: targetUserId,
        start_at: { $gte: now, $lte: in7Days },
        status: { $in: ['scheduled', 'pending_review'] }
      }, 'start_at', 20);

      if (!events || events.length === 0) {
        return Response.json({
          success: true,
          action: 'list',
          message_to_send: '📭 Você não tem eventos agendados nos próximos 7 dias.'
        });
      }

      // Formatar lista
      let message = `📅 **Sua Agenda (próximos 7 dias)**\n\n`;

      events.forEach((evt, idx) => {
        const date = new Date(evt.start_at);
        const dateStr = date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'short',
          weekday: 'short'
        });
        const timeStr = date.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        message += `${idx + 1}. **${evt.title}**\n`;
        message += `   📅 ${dateStr} às ${timeStr}\n`;
        if (evt.description) {
          message += `   📝 ${evt.description}\n`;
        }
        message += `\n`;
      });

      message += `\n💡 Use "cancelar [número]" para remover um evento.`;

      return Response.json({
        success: true,
        action: 'list',
        total: events.length,
        message_to_send: message
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HANDLE ACTION: CANCEL
    // ═══════════════════════════════════════════════════════════════════════
    if (agendaIntent.action === 'cancel') {
      console.log(`[AGENDA-IA] ❌ Cancelando evento...`);

      const targetUserId = from_type === 'internal_user' ? from_id : null;

      if (!targetUserId) {
        return Response.json({
          success: false,
          message_to_send: '❌ Cancelamento só disponível para usuários internos'
        });
      }

      // Buscar eventos recentes do usuário
      const nowCancel = new Date().toISOString();
      const events = await base44.asServiceRole.entities.ScheduleEvent.filter({
        assigned_user_id: targetUserId,
        start_at: { $gte: nowCancel },
        status: 'scheduled'
      }, 'start_at', 10);

      if (!events || events.length === 0) {
        return Response.json({
          success: false,
          message_to_send: '❌ Você não tem eventos agendados para cancelar.'
        });
      }

      // Identificar qual evento cancelar (primeiro, ou por contexto)
      const eventToCancel = events[0]; // Simplificado: cancela o próximo

      // Cancelar evento
      await base44.asServiceRole.entities.ScheduleEvent.update(eventToCancel.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });

      // Cancelar lembretes pendentes
      const reminders = await base44.asServiceRole.entities.ScheduleReminder.filter({
        event_id: eventToCancel.id,
        status: 'pending'
      });

      for (const reminder of (reminders || [])) {
        await base44.asServiceRole.entities.ScheduleReminder.update(reminder.id, {
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_details: 'Evento cancelado pelo usuário'
        });
      }

      const dateStr = new Date(eventToCancel.start_at).toLocaleString('pt-BR');

      return Response.json({
        success: true,
        action: 'cancel',
        event_id: eventToCancel.id,
        message_to_send: `✅ Evento cancelado:\n\n📌 ${eventToCancel.title}\n📅 ${dateStr}`
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PASSO 3: HANDLE MISSING FIELDS (CREATE/RESCHEDULE)
    // ═══════════════════════════════════════════════════════════════════════
    if (agendaIntent.missing_fields && agendaIntent.missing_fields.length > 0) {
      console.log(`[AGENDA-IA] ❓ Campos faltantes:`, agendaIntent.missing_fields);
      
      // Salvar/atualizar estado da conversa
      const expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString(); // 45 min
      
      const stateData = {
        thread_id,
        pending_intent_json: agendaIntent,
        missing_fields: agendaIntent.missing_fields,
        last_question: agendaIntent.question_to_ask || 'Preciso de mais informações',
        awaiting_confirmation: false,
        expires_at: expiresAt
      };
      
      try {
        if (conversationState) {
          await base44.asServiceRole.entities.ScheduleConversationState.update(
            conversationState.id, 
            stateData
          );
        } else {
          await base44.asServiceRole.entities.ScheduleConversationState.create(stateData);
        }
      } catch (e) {
        console.error(`[AGENDA-IA] ⚠️ Erro ao salvar estado:`, e.message);
      }
      
      return Response.json({
        success: true,
        action: 'ask_more',
        message_to_send: agendaIntent.question_to_ask || 'Qual dia e horário você prefere? 📅'
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSO 4: RESOLVE ASSIGNED USER (ESCOPO)
    // ═══════════════════════════════════════════════════════════════════════
    let assigned_user_id = null;
    
    try {
      const resolveResult = await base44.asServiceRole.functions.invoke('resolveScheduleUser', {
        thread_id,
        from_type,
        from_id,
        assigned_target: agendaIntent.assigned_target
      });
      
      if (!resolveResult.data.success) {
        return Response.json({
          success: false,
          message_to_send: resolveResult.data.message || '❌ Não consegui identificar o responsável.'
        });
      }
      
      assigned_user_id = resolveResult.data.user_id;
      console.log(`[AGENDA-IA] ✅ Usuário resolvido: ${assigned_user_id}`);
    } catch (e) {
      console.error(`[AGENDA-IA] ❌ Erro ao resolver usuário:`, e.message);
      return Response.json({
        success: false,
        message_to_send: '❌ Erro ao identificar responsável. Tente especificar o nome completo.'
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSO 5: CONFIRM EVENT SUMMARY (se necessário)
    // ═══════════════════════════════════════════════════════════════════════
    const autoCommit = agendaIntent.confidence >= 0.85 && 
                       (!agendaIntent.risk_flags || agendaIntent.risk_flags.length === 0);
    
    if (!autoCommit && !conversationState?.awaiting_confirmation) {
      // Pedir confirmação
      const confirmMessage = `📋 Vou agendar:
      
📌 ${agendaIntent.title}
📅 ${agendaIntent.date} às ${agendaIntent.time}
👤 Responsável: ${agendaIntent.assigned_target}
🔔 Lembrete: ${agendaIntent.reminders?.[0]?.offset_minutes || 15} min antes

Confirma? (Responda: sim/ok ou não)`;
      
      // Atualizar estado
      try {
        if (conversationState) {
          await base44.asServiceRole.entities.ScheduleConversationState.update(
            conversationState.id,
            {
              pending_intent_json: agendaIntent,
              awaiting_confirmation: true,
              last_question: confirmMessage
            }
          );
        } else {
          const expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();
          await base44.asServiceRole.entities.ScheduleConversationState.create({
            thread_id,
            pending_intent_json: agendaIntent,
            awaiting_confirmation: true,
            last_question: confirmMessage,
            expires_at: expiresAt
          });
        }
      } catch (e) {
        console.error(`[AGENDA-IA] ⚠️ Erro ao salvar estado de confirmação:`, e.message);
      }
      
      return Response.json({
        success: true,
        action: 'ask_confirmation',
        message_to_send: confirmMessage
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // VALIDAÇÃO DE DATA (P1 - Segurança)
    // ═══════════════════════════════════════════════════════════════════════
    const startAt = `${agendaIntent.date}T${agendaIntent.time}:00`;
    const startDate = new Date(startAt);
    const nowValidation = new Date();

    // Não aceitar datas passadas
    if (startDate < nowValidation) {
      return Response.json({
        success: false,
        message_to_send: '⏰ Não posso agendar eventos no passado. Escolha uma data futura.'
      });
    }

    // Não aceitar datas muito distantes (> 2 anos)
    const maxFutureDate = new Date(now.getFullYear() + 2, 11, 31);
    if (startDate > maxFutureDate) {
      return Response.json({
        success: false,
        message_to_send: '📅 Data muito distante. Por favor, escolha uma data nos próximos 2 anos.'
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PASSO 6: CREATE EVENT + REMINDERS
    // ═══════════════════════════════════════════════════════════════════════
    const titleNorm = (agendaIntent.title || '').toLowerCase().replace(/\s+/g, '_');
    const eventDedupeKey = `${assigned_user_id}_${startAt}_${titleNorm}`;
    
    // Verificar duplicação
    const existingEvents = await base44.asServiceRole.entities.ScheduleEvent.filter({
      event_dedupe_key: eventDedupeKey
    }, '-created_date', 1);
    
    let event;
    if (existingEvents && existingEvents.length > 0) {
      event = existingEvents[0];
      console.log(`[AGENDA-IA] ⏭️ Evento já existe: ${event.id}`);
    } else {
      // Criar novo evento
      event = await base44.asServiceRole.entities.ScheduleEvent.create({
        created_by_type: from_type,
        created_by_id: from_id,
        assigned_user_id,
        title: agendaIntent.title,
        description: agendaIntent.description || '',
        start_at: startAt,
        timezone: agendaIntent.timezone || 'America/Sao_Paulo',
        status: autoCommit ? 'scheduled' : 'pending_review',
        event_type: 'lembrete',
        source_thread_id: thread_id,
        source_message_id: message_id,
        event_dedupe_key: eventDedupeKey,
        confidence_score: agendaIntent.confidence || 0.8,
        auto_committed: autoCommit
      });
      
      console.log(`[AGENDA-IA] ✅ Evento criado: ${event.id}`);
      
      // Criar lembretes
      const reminders = agendaIntent.reminders || [{ offset_minutes: 15, channel: 'internal' }];
      
      for (const reminder of reminders) {
        const sendAt = new Date(new Date(startAt).getTime() - reminder.offset_minutes * 60 * 1000).toISOString();
        const sendDedupeKey = `${event.id}_${assigned_user_id}_${reminder.offset_minutes}`;
        
        try {
          await base44.asServiceRole.entities.ScheduleReminder.create({
            event_id: event.id,
            target_user_id: assigned_user_id,
            offset_minutes: reminder.offset_minutes,
            send_at: sendAt,
            channel: reminder.channel || 'internal',
            status: 'pending',
            send_dedupe_key: sendDedupeKey
          });
          
          console.log(`[AGENDA-IA] 🔔 Lembrete criado: ${reminder.offset_minutes}min antes`);
        } catch (e) {
          if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
            console.log(`[AGENDA-IA] ⏭️ Lembrete duplicado ignorado`);
          } else {
            console.error(`[AGENDA-IA] ⚠️ Erro ao criar lembrete:`, e.message);
          }
        }
      }
    }
    
    // Limpar estado da conversa
    if (conversationState) {
      try {
        await base44.asServiceRole.entities.ScheduleConversationState.delete(conversationState.id);
      } catch (e) {}
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PASSO 7: ACK TO REQUESTER
    // ═══════════════════════════════════════════════════════════════════════
    const ackMessage = from_type === 'external_contact'
      ? `✅ Agendado: ${agendaIntent.title}
📅 ${agendaIntent.date} às ${agendaIntent.time}
👤 Responsável: ${agendaIntent.assigned_target}
🔔 Lembrete será enviado no horário.

Comandos disponíveis:
• "listar" - ver próximos
• "cancelar ${agendaIntent.title}" - remover`
      : `✅ Agendado para você: ${agendaIntent.title}
📅 ${agendaIntent.date} às ${agendaIntent.time}
🔔 Você será lembrado ${agendaIntent.reminders?.[0]?.offset_minutes || 15} min antes.`;
    
    return Response.json({
      success: true,
      action: agendaIntent.action,
      event_id: event.id,
      message_to_send: ackMessage
    });
    
  } catch (error) {
    console.error('[AGENDA-IA] ❌ Erro:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message,
      message_to_send: '❌ Erro ao processar agendamento. Tente novamente.'
    }, { status: 500 });
  }
});