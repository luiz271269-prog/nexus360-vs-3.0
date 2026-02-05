import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 WORKER DE SINCRONIZAÇÃO BIDIRECIONAL - CALENDÁRIOS
// ═══════════════════════════════════════════════════════════════════════════
// Roda a cada 15 minutos via scheduled automation:
// 1. Para cada usuário com sync habilitado
// 2. Exporta eventos novos → Google/Outlook
// 3. Importa eventos externos → Nexus (se bidirectional)
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    console.log(`[CALENDAR-WORKER] 🚀 Iniciando sincronização bidirecional...`);
    
    // Buscar usuários com sincronização habilitada
    const usersComGoogle = await base44.asServiceRole.entities.User.filter({
      'calendar_sync_config.google_calendar_enabled': true
    });
    
    const usersComOutlook = await base44.asServiceRole.entities.User.filter({
      'calendar_sync_config.outlook_calendar_enabled': true
    });
    
    // Unir e remover duplicatas
    const allUsers = [...new Map([
      ...(usersComGoogle || []).map(u => [u.id, u]),
      ...(usersComOutlook || []).map(u => [u.id, u])
    ].map(([id, user]) => [id, user])).values()];
    
    console.log(`[CALENDAR-WORKER] 👥 Encontrados ${allUsers.length} usuários com sync ativo`);
    
    if (allUsers.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhum usuário com sincronização habilitada' 
      });
    }
    
    const resultados = {
      total_users: allUsers.length,
      synced_to_calendars: 0,
      imported_from_calendars: 0,
      errors: 0
    };
    
    for (const user of allUsers) {
      try {
        const syncDirection = user.calendar_sync_config?.sync_direction || 'bidirectional';
        
        // EXPORTAR: Nexus → Calendários
        if (syncDirection === 'bidirectional' || syncDirection === 'nexus_to_calendar') {
          try {
            const syncResult = await base44.asServiceRole.functions.invoke('syncScheduleToCalendars', {
              user_id_override: user.id
            });
            
            if (syncResult.data?.total_synced) {
              resultados.synced_to_calendars += syncResult.data.total_synced;
            }
          } catch (e) {
            console.error(`[CALENDAR-WORKER] ❌ Erro ao exportar para ${user.email}:`, e.message);
            resultados.errors++;
          }
        }
        
        // IMPORTAR: Calendários → Nexus
        if (syncDirection === 'bidirectional' || syncDirection === 'calendar_to_nexus') {
          try {
            const importResult = await base44.asServiceRole.functions.invoke('importFromCalendars', {
              user_id_override: user.id
            });
            
            if (importResult.data?.total_imported) {
              resultados.imported_from_calendars += importResult.data.total_imported;
            }
          } catch (e) {
            console.error(`[CALENDAR-WORKER] ❌ Erro ao importar para ${user.email}:`, e.message);
            resultados.errors++;
          }
        }
        
      } catch (e) {
        console.error(`[CALENDAR-WORKER] ❌ Erro ao processar usuário ${user.email}:`, e.message);
        resultados.errors++;
      }
    }
    
    console.log(`[CALENDAR-WORKER] ✅ Concluído | Exportados: ${resultados.synced_to_calendars} | Importados: ${resultados.imported_from_calendars} | Erros: ${resultados.errors}`);
    
    return Response.json({
      success: true,
      resultados
    });
    
  } catch (error) {
    console.error('[CALENDAR-WORKER] ❌ Erro:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});