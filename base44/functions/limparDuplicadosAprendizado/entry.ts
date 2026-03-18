// FUNÇÃO CIRÚRGICA: Limpar aprendizado_semanal duplicados (gerados pelo loop 16-18/03)
// Executa UMA VEZ, após deploy
// Remove: registros IDÊNTICOS (mesmos dados contexto), mantém: registros ÚNICOS (dados diferentes)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ✅ ADMIN-ONLY
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[LIMPEZA] Iniciando limpeza de aprendizado_semanal...');

    // Buscar TODOS os aprendizados do sistema (sem limit)
    const todosAprendizados = await base44.asServiceRole.entities.NexusMemory.filter({
      owner_user_id: 'system',
      tipo: 'aprendizado_semanal'
    }, '-created_date', 500);

    console.log(`[LIMPEZA] Encontrados ${todosAprendizados.length} aprendizados total`);

    // Agrupar por semana (usando score_utilidade como chave, pois duplicados terão valor idêntico)
    const mapaSemanas = {};
    const duplicados = [];

    for (const aprendizado of todosAprendizados) {
      const semanaChave = aprendizado.contexto?.semana_fim || 'desconhecida';
      const score = aprendizado.score_utilidade || 0;
      
      if (!mapaSemanas[semanaChave]) {
        mapaSemanas[semanaChave] = { primeiro: aprendizado, duplicados: [] };
      } else {
        // Se score e dados são IDÊNTICOS, é duplicado
        if (
          mapaSemanas[semanaChave].primeiro.score_utilidade === score &&
          JSON.stringify(mapaSemanas[semanaChave].primeiro.contexto) === 
          JSON.stringify(aprendizado.contexto)
        ) {
          mapaSemanas[semanaChave].duplicados.push(aprendizado.id);
          duplicados.push(aprendizado.id);
        }
      }
    }

    console.log(`[LIMPEZA] Identificados ${duplicados.length} duplicados exatos`);

    // Deletar duplicados
    let deletados = 0;
    for (const id of duplicados) {
      try {
        await base44.asServiceRole.entities.NexusMemory.delete(id);
        deletados++;
      } catch (e) {
        console.warn(`[LIMPEZA] ⚠️ Falha ao deletar ${id}: ${e.message}`);
      }
    }

    console.log(`[LIMPEZA] ✅ ${deletados} registros duplicados removidos`);

    return Response.json({
      success: true,
      total_aprendizados: todosAprendizados.length,
      duplicados_encontrados: duplicados.length,
      deletados: deletados,
      semanas_unicas: Object.keys(mapaSemanas).length
    });

  } catch (error) {
    console.error('[LIMPEZA] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});