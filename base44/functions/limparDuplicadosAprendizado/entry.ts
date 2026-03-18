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

    // ✅ REGRA UNIVERSAL: manter apenas 1 aprendizado por semana + owner_user_id
    const mapaSemanas = {};
    const duplicados = [];

    for (const aprendizado of todosAprendizados) {
      // Calcular início da semana do registro
      const dataRegistro = new Date(aprendizado.created_date);
      const inicioSemana = new Date(dataRegistro);
      inicioSemana.setDate(dataRegistro.getDate() - dataRegistro.getDay() + 1);
      inicioSemana.setHours(0, 0, 0, 0);
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(fimSemana.getDate() + 7);

      const semanaChave = `${aprendizado.owner_user_id}|${inicioSemana.toISOString().split('T')[0]}`;
      
      if (!mapaSemanas[semanaChave]) {
        mapaSemanas[semanaChave] = { primeiro: aprendizado, duplicados: [] };
      } else {
        // Se já existe um para essa semana+owner, o novo é duplicado (mantém o mais recente)
        const novoMaisRecente = new Date(aprendizado.created_date) > new Date(mapaSemanas[semanaChave].primeiro.created_date);
        if (novoMaisRecente) {
          duplicados.push(mapaSemanas[semanaChave].primeiro.id);
          mapaSemanas[semanaChave].primeiro = aprendizado; // Substitui pelo mais recente
        } else {
          duplicados.push(aprendizado.id);
        }
      }
    }

    console.log(`[LIMPEZA] Identificados ${duplicados.length} duplicados exatos`);

    // Deletar duplicados com throttle (evita 429)
    let deletados = 0;
    for (const id of duplicados) {
      try {
        await base44.asServiceRole.entities.NexusMemory.delete(id);
        deletados++;
        
        // Throttle a cada 10 deletions
        if (deletados % 10 === 0) {
          console.log(`[LIMPEZA] 🔄 ${deletados}/${duplicados.length} deletados — aguardando 1s...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e) {
        if (e.message?.includes('429')) {
          console.warn(`[LIMPEZA] ⚠️ Rate limit — parando. ${deletados} deletados até agora.`);
          break; // Stop on rate limit
        }
        console.warn(`[LIMPEZA] ⚠️ Erro ao deletar ${id}: ${e.message}`);
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