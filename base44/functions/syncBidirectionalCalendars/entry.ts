import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 WORKER DE SINCRONIZAÇÃO BIDIRECIONAL - CALENDÁRIOS
// ═══════════════════════════════════════════════════════════════════════════
// Roda a cada 15 minutos via scheduled automation:
// 1. Para cada usuário com sync habilitado (processamento paralelo por batch)
// 2. Exporta eventos novos → Google/Outlook (com timeout)
// 3. Importa eventos externos → Nexus (se bidirectional)
// ═══════════════════════════════════════════════════════════════════════════

const BATCH_SIZE = 2; // Processa 2 usuários em paralelo (reduzido para evitar timeout)
const TIMEOUT_PER_USER_MS = 20000; // 20s por usuário
const MAX_TOTAL_MS = 80000; // 80s máximo total (antes do 90s limit)

Deno.serve(async (req) => {
  const tsStart = Date.now();
  
  // ✅ FIX: Em contexto agendado, req vem vazio
  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    console.log('[CALENDAR-WORKER] Contexto agendado detectado, usando createClient()');
    base44 = createClient();
  }
  
  try {
    console.log(`[CALENDAR-WORKER] 🚀 Iniciando sincronização bidirecional...`);
    
    // ✅ FIX: Buscar todos os users e filtrar em memória (evita nested field timeout)
    const allUsersRaw = await base44.asServiceRole.entities.User.list('-created_date', 200);
    
    const allUsers = (allUsersRaw || []).filter(user => {
      const config = user.calendar_sync_config;
      return config && (config.google_calendar_enabled || config.outlook_calendar_enabled);
    });
    
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
      errors: 0,
      skipped: 0
    };
    
    // ✅ FIX: Processar em batches paralelos para evitar CPU timeout
    console.log(`[CALENDAR-WORKER] 📦 Processando ${allUsers.length} usuários em batches de ${BATCH_SIZE}`);
    
    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
      // Check timeout global
      if (Date.now() - tsStart > MAX_TOTAL_MS) {
        console.warn('[CALENDAR-WORKER] ⏱️ Timeout global atingido, parando processamento');
        resultados.skipped = allUsers.length - i;
        break;
      }
      
      const batch = allUsers.slice(i, i + BATCH_SIZE);
      console.log(`[CALENDAR-WORKER] 📋 Batch ${Math.floor(i / BATCH_SIZE) + 1}: processando ${batch.length} usuários`);
      
      // Processar batch em paralelo
      const batchPromises = batch.map(user => syncUserWithTimeout(base44, user, TIMEOUT_PER_USER_MS));
      const batchResultados = await Promise.allSettled(batchPromises);
      
      // Agregar resultados do batch
      for (const resultado of batchResultados) {
        if (resultado.status === 'fulfilled') {
          const r = resultado.value;
          resultados.synced_to_calendars += r.synced || 0;
          resultados.imported_from_calendars += r.imported || 0;
          if (!r.success) resultados.errors++;
        } else {
          resultados.errors++;
          console.error('[CALENDAR-WORKER] Erro em promise:', resultado.reason?.message);
        }
      }
    }
    
    const duracao = Date.now() - tsStart;
    console.log(`[CALENDAR-WORKER] ✅ Concluído em ${duracao}ms | Exportados: ${resultados.synced_to_calendars} | Importados: ${resultados.imported_from_calendars} | Erros: ${resultados.errors} | Skipped: ${resultados.skipped}`);
    
    return Response.json({
      success: resultados.errors === 0,
      resultados,
      duration_ms: duracao
    });
    
  } catch (error) {
    console.error('[CALENDAR-WORKER] ❌ Erro crítico:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message,
      duration_ms: Date.now() - tsStart
    }, { status: 500 });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Sincronizar 1 usuário com timeout
// ═══════════════════════════════════════════════════════════════════════════

async function syncUserWithTimeout(base44, user, timeoutMs) {
  const resultado = {
    user_id: user.id,
    email: user.email,
    synced: 0,
    imported: 0,
    success: true
  };
  
  try {
    const syncDirection = user.calendar_sync_config?.sync_direction || 'bidirectional';
    
    // EXPORTAR: Nexus → Calendários
    if (syncDirection === 'bidirectional' || syncDirection === 'nexus_to_calendar') {
      try {
        const syncResult = await Promise.race([
          base44.asServiceRole.functions.invoke('syncScheduleToCalendars', {
            user_id_override: user.id
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Export timeout')), timeoutMs)
          )
        ]);
        
        if (syncResult.data?.total_synced) {
          resultado.synced = syncResult.data.total_synced;
        }
      } catch (e) {
        console.warn(`[CALENDAR-WORKER] ⚠️ Erro ao exportar para ${user.email}:`, e.message);
        resultado.success = false;
      }
    }
    
    // IMPORTAR: Calendários → Nexus
    if (syncDirection === 'bidirectional' || syncDirection === 'calendar_to_nexus') {
      try {
        const importResult = await Promise.race([
          base44.asServiceRole.functions.invoke('importFromCalendars', {
            user_id_override: user.id
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Import timeout')), timeoutMs)
          )
        ]);
        
        if (importResult.data?.total_imported) {
          resultado.imported = importResult.data.total_imported;
        }
      } catch (e) {
        console.warn(`[CALENDAR-WORKER] ⚠️ Erro ao importar para ${user.email}:`, e.message);
        resultado.success = false;
      }
    }
    
  } catch (e) {
    console.error(`[CALENDAR-WORKER] ❌ Erro geral ao processar ${user.email}:`, e.message);
    resultado.success = false;
  }
  
  return resultado;
}