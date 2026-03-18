import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ═══════════════════════════════════════════════════════════════════════════
// 📥 IMPORTAR DE CALENDÁRIOS → AGENDA NEXUS
// ═══════════════════════════════════════════════════════════════════════════
// Sincronização reversa: busca eventos do Google/Outlook e cria no ScheduleEvent
// Direção: Calendários Externos → Nexus360
// ═══════════════════════════════════════════════════════════════════════════

async function importFromGoogle(base44, user) {
  if (!user.calendar_sync_config?.google_calendar_enabled) {
    return { imported: 0, errors: 0 };
  }
  
  try {
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');
    const calendarId = user.calendar_sync_config.google_calendar_id || 'primary';
    
    // Buscar eventos futuros (próximos 30 dias)
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?` +
      `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Google API retornou ${response.status}`);
    }
    
    const data = await response.json();
    const events = data.items || [];
    
    let imported = 0;
    let errors = 0;
    
    for (const googleEvent of events) {
      try {
        // Verificar se já foi importado
        const existing = await base44.asServiceRole.entities.ScheduleEvent.filter({
          google_calendar_event_id: googleEvent.id
        }, '-created_date', 1);
        
        if (existing && existing.length > 0) {
          continue; // Já importado
        }
        
        // Criar evento no Nexus
        const startAt = googleEvent.start.dateTime || googleEvent.start.date;
        const endAt = googleEvent.end.dateTime || googleEvent.end.date;
        
        const eventDedupeKey = `import_google_${user.id}_${startAt}_${(googleEvent.summary || '').toLowerCase().replace(/\s+/g, '_')}`;
        
        await base44.asServiceRole.entities.ScheduleEvent.create({
          created_by_type: 'internal_user',
          created_by_id: user.id,
          assigned_user_id: user.id,
          title: googleEvent.summary || 'Evento sem título',
          description: googleEvent.description || '',
          start_at: startAt,
          end_at: endAt,
          timezone: googleEvent.start.timeZone || 'America/Sao_Paulo',
          status: 'scheduled',
          event_type: 'compromisso',
          google_calendar_event_id: googleEvent.id,
          event_dedupe_key: eventDedupeKey,
          auto_committed: true,
          confidence_score: 1.0
        });
        
        imported++;
        console.log(`[GOOGLE-IMPORT] ✅ Importado: ${googleEvent.summary}`);
        
      } catch (e) {
        if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
          console.log(`[GOOGLE-IMPORT] ⏭️ Evento duplicado ignorado`);
        } else {
          console.error(`[GOOGLE-IMPORT] ❌ Erro:`, e.message);
          errors++;
        }
      }
    }
    
    return { imported, errors, provider: 'google' };
    
  } catch (e) {
    console.error(`[GOOGLE-IMPORT] ❌ Erro geral:`, e.message);
    return { imported: 0, errors: 0, message: e.message };
  }
}

async function importFromOutlook(base44, user) {
  if (!user.calendar_sync_config?.outlook_calendar_enabled || !user.calendar_sync_config?.outlook_refresh_token) {
    return { imported: 0, errors: 0 };
  }
  
  try {
    // Renovar token
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
      throw new Error('Erro ao renovar token do Outlook');
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // Buscar eventos
    const startDateTime = new Date().toISOString();
    const endDateTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'outlook.timezone="America/Sao_Paulo"'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Microsoft Graph retornou ${response.status}`);
    }
    
    const data = await response.json();
    const events = data.value || [];
    
    let imported = 0;
    let errors = 0;
    
    for (const outlookEvent of events) {
      try {
        const existing = await base44.asServiceRole.entities.ScheduleEvent.filter({
          outlook_calendar_event_id: outlookEvent.id
        }, '-created_date', 1);
        
        if (existing && existing.length > 0) {
          continue;
        }
        
        const startAt = outlookEvent.start.dateTime;
        const endAt = outlookEvent.end.dateTime;
        const eventDedupeKey = `import_outlook_${user.id}_${startAt}_${(outlookEvent.subject || '').toLowerCase().replace(/\s+/g, '_')}`;
        
        await base44.asServiceRole.entities.ScheduleEvent.create({
          created_by_type: 'internal_user',
          created_by_id: user.id,
          assigned_user_id: user.id,
          title: outlookEvent.subject || 'Evento sem título',
          description: outlookEvent.body?.content || '',
          start_at: startAt,
          end_at: endAt,
          timezone: outlookEvent.start.timeZone || 'America/Sao_Paulo',
          status: 'scheduled',
          event_type: 'compromisso',
          outlook_calendar_event_id: outlookEvent.id,
          event_dedupe_key: eventDedupeKey,
          auto_committed: true,
          confidence_score: 1.0
        });
        
        imported++;
        console.log(`[OUTLOOK-IMPORT] ✅ Importado: ${outlookEvent.subject}`);
        
      } catch (e) {
        if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
          console.log(`[OUTLOOK-IMPORT] ⏭️ Duplicado ignorado`);
        } else {
          console.error(`[OUTLOOK-IMPORT] ❌ Erro:`, e.message);
          errors++;
        }
      }
    }
    
    return { imported, errors, provider: 'outlook' };
    
  } catch (e) {
    console.error(`[OUTLOOK-IMPORT] ❌ Erro geral:`, e.message);
    return { imported: 0, errors: 0, message: e.message };
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[CALENDAR-IMPORT] 🚀 Importando eventos para: ${user.full_name || user.email}`);
    
    const results = {
      google: { imported: 0, errors: 0 },
      outlook: { imported: 0, errors: 0 }
    };
    
    // Importar de provedores habilitados
    if (user.calendar_sync_config?.google_calendar_enabled) {
      results.google = await importFromGoogle(base44, user);
    }
    
    if (user.calendar_sync_config?.outlook_calendar_enabled) {
      results.outlook = await importFromOutlook(base44, user);
    }
    
    console.log(`[CALENDAR-IMPORT] ✅ Concluído | Google: ${results.google.imported} | Outlook: ${results.outlook.imported}`);
    
    return Response.json({
      success: true,
      results,
      total_imported: results.google.imported + results.outlook.imported,
      total_errors: results.google.errors + results.outlook.errors
    });
    
  } catch (error) {
    console.error('[CALENDAR-IMPORT] ❌ Erro:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});