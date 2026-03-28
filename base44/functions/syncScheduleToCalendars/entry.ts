import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ═══════════════════════════════════════════════════════════════════════════
// 📅 SINCRONIZAR AGENDA → CALENDÁRIOS EXTERNOS
// ═══════════════════════════════════════════════════════════════════════════
// Sincroniza eventos do ScheduleEvent para Google Calendar e Outlook
// Direção: Nexus360 → Calendários Externos
// ═══════════════════════════════════════════════════════════════════════════

async function syncToGoogleCalendar(base44, user, events) {
  if (!user.calendar_sync_config?.google_calendar_enabled) {
    return { synced: 0, errors: 0, message: 'Google Calendar desabilitado' };
  }
  
  try {
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');
    const calendarId = user.calendar_sync_config.google_calendar_id || 'primary';
    
    let synced = 0;
    let errors = 0;
    
    for (const event of events) {
      try {
        // Verificar se já foi sincronizado
        if (event.google_calendar_event_id) {
          continue; // Já sincronizado
        }
        
        // Criar evento no Google Calendar
        const startDateTime = new Date(event.start_at);
        const endDateTime = event.end_at ? new Date(event.end_at) : new Date(startDateTime.getTime() + 60 * 60 * 1000);
        
        const googleEvent = {
          summary: event.title,
          description: `${event.description || ''}\n\n🤖 Criado via Agenda IA Nexus`,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: event.timezone || 'America/Sao_Paulo'
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: event.timezone || 'America/Sao_Paulo'
          },
          reminders: {
            useDefault: false,
            overrides: event.reminders?.map(r => ({
              method: 'popup',
              minutes: r.offset_minutes
            })) || [{ method: 'popup', minutes: 15 }]
          }
        };
        
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(googleEvent)
          }
        );
        
        if (!response.ok) {
          const error = await response.text();
          console.error(`[GOOGLE-SYNC] ❌ Erro ao criar evento:`, error);
          errors++;
          continue;
        }
        
        const createdEvent = await response.json();
        
        // Atualizar ScheduleEvent com ID do Google
        await base44.asServiceRole.entities.ScheduleEvent.update(event.id, {
          google_calendar_event_id: createdEvent.id,
          synced_to_google_at: new Date().toISOString()
        });
        
        synced++;
        console.log(`[GOOGLE-SYNC] ✅ Evento sincronizado: ${event.title}`);
        
      } catch (e) {
        console.error(`[GOOGLE-SYNC] ❌ Erro:`, e.message);
        errors++;
      }
    }
    
    return { synced, errors, provider: 'google' };
    
  } catch (e) {
    console.error(`[GOOGLE-SYNC] ❌ Erro geral:`, e.message);
    return { synced: 0, errors: events.length, message: e.message };
  }
}

async function syncToOutlook(base44, user, events) {
  if (!user.calendar_sync_config?.outlook_calendar_enabled) {
    return { synced: 0, errors: 0, message: 'Outlook desabilitado' };
  }
  
  if (!user.calendar_sync_config?.outlook_refresh_token) {
    return { synced: 0, errors: 0, message: 'Outlook não autorizado (falta refresh_token)' };
  }
  
  try {
    // Obter access token usando refresh token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${Deno.env.get('MICROSOFT_TENANT_ID')}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('MICROSOFT_CLIENT_ID'),
          client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET'),
          refresh_token: user.calendar_sync_config.outlook_refresh_token,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access'
        })
      }
    );
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error(`[OUTLOOK-SYNC] ❌ Erro ao renovar token:`, error);
      return { synced: 0, errors: events.length, message: 'Erro ao renovar token do Outlook' };
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // Atualizar refresh token se veio novo
    if (tokenData.refresh_token) {
      await base44.asServiceRole.entities.User.update(user.id, {
        'calendar_sync_config.outlook_refresh_token': tokenData.refresh_token,
        'calendar_sync_config.outlook_token_expires_at': new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      });
    }
    
    let synced = 0;
    let errors = 0;
    
    for (const event of events) {
      try {
        if (event.outlook_calendar_event_id) {
          continue; // Já sincronizado
        }
        
        const startDateTime = new Date(event.start_at);
        const endDateTime = event.end_at ? new Date(event.end_at) : new Date(startDateTime.getTime() + 60 * 60 * 1000);
        
        const outlookEvent = {
          subject: event.title,
          body: {
            contentType: 'Text',
            content: `${event.description || ''}\n\n🤖 Criado via Agenda IA Nexus`
          },
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: event.timezone || 'America/Sao_Paulo'
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: event.timezone || 'America/Sao_Paulo'
          },
          isReminderOn: true,
          reminderMinutesBeforeStart: event.reminders?.[0]?.offset_minutes || 15
        };
        
        const response = await fetch(
          'https://graph.microsoft.com/v1.0/me/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(outlookEvent)
          }
        );
        
        if (!response.ok) {
          const error = await response.text();
          console.error(`[OUTLOOK-SYNC] ❌ Erro ao criar evento:`, error);
          errors++;
          continue;
        }
        
        const createdEvent = await response.json();
        
        await base44.asServiceRole.entities.ScheduleEvent.update(event.id, {
          outlook_calendar_event_id: createdEvent.id,
          synced_to_outlook_at: new Date().toISOString()
        });
        
        synced++;
        console.log(`[OUTLOOK-SYNC] ✅ Evento sincronizado: ${event.title}`);
        
      } catch (e) {
        console.error(`[OUTLOOK-SYNC] ❌ Erro:`, e.message);
        errors++;
      }
    }
    
    return { synced, errors, provider: 'outlook' };
    
  } catch (e) {
    console.error(`[OUTLOOK-SYNC] ❌ Erro geral:`, e.message);
    return { synced: 0, errors: events.length, message: e.message };
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = await req.json();
    const { user_id_override } = payload; // Admin pode sincronizar para outros
    
    // Determinar qual usuário sincronizar
    const targetUserId = user.role === 'admin' && user_id_override ? user_id_override : user.id;
    const targetUser = targetUserId === user.id 
      ? user 
      : await base44.asServiceRole.entities.User.get(targetUserId);
    
    console.log(`[CALENDAR-SYNC] 🚀 Sincronizando para: ${targetUser.full_name || targetUser.email}`);
    
    // Buscar eventos para sincronizar
    const syncMode = targetUser.calendar_sync_config?.sync_mode || 'apenas_meus';
    let eventsQuery = {};
    
    if (syncMode === 'apenas_meus') {
      eventsQuery.assigned_user_id = targetUserId;
    } else if (syncMode === 'meu_setor') {
      // Buscar todos os usuários do mesmo setor
      const usuarios = await base44.asServiceRole.entities.User.filter({
        attendant_sector: targetUser.attendant_sector
      });
      const userIds = usuarios.map(u => u.id);
      eventsQuery.assigned_user_id = { $in: userIds };
    }
    // Se 'todos', não filtra por usuário
    
    // Apenas eventos futuros e não cancelados
    eventsQuery.status = { $in: ['scheduled', 'pending_review'] };
    eventsQuery.start_at = { $gte: new Date().toISOString() };
    
    const events = await base44.asServiceRole.entities.ScheduleEvent.filter(eventsQuery, 'start_at', 100);
    
    console.log(`[CALENDAR-SYNC] 📋 Encontrados ${events?.length || 0} eventos para sincronizar`);
    
    if (!events || events.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhum evento para sincronizar',
        google: { synced: 0 },
        outlook: { synced: 0 }
      });
    }
    
    // Sincronizar para provedores habilitados
    const results = {
      google: { synced: 0, errors: 0 },
      outlook: { synced: 0, errors: 0 }
    };
    
    if (targetUser.calendar_sync_config?.google_calendar_enabled) {
      results.google = await syncToGoogleCalendar(base44, targetUser, events);
    }
    
    if (targetUser.calendar_sync_config?.outlook_calendar_enabled) {
      results.outlook = await syncToOutlook(base44, targetUser, events);
    }
    
    // Atualizar last_sync_at
    await base44.asServiceRole.entities.User.update(targetUserId, {
      'calendar_sync_config.last_sync_at': new Date().toISOString()
    });
    
    console.log(`[CALENDAR-SYNC] ✅ Concluído | Google: ${results.google.synced} | Outlook: ${results.outlook.synced}`);
    
    return Response.json({
      success: true,
      results,
      total_synced: results.google.synced + results.outlook.synced,
      total_errors: results.google.errors + results.outlook.errors
    });
    
  } catch (error) {
    console.error('[CALENDAR-SYNC] ❌ Erro:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});