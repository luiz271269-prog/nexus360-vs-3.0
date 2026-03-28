// LIMPEZA P1: Remover 8 registros zerados de aprendizado de 16/03
// owner_user_id = 'system', tipo = 'aprendizado_semanal', criados em 16/03 (antes de 18/03)
// Esses registros dizem "zero decisões, zero atividade" — ruído para o sistema

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ✅ ADMIN-ONLY
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[LIMPEZA-P1] Iniciando remoção de aprendizados zerados...');

    // Data limite: 18/03/2026 00:00 (tudo ANTES disso será deletado)
    const dataLimite = new Date('2026-03-18T00:00:00Z');

    // Buscar aprendizados zerados (criados antes de 18/03)
    const aprendizadosZerados = await base44.asServiceRole.entities.NexusMemory.filter({
      owner_user_id: 'system',
      tipo: 'aprendizado_semanal',
      created_date: { $lt: dataLimite.toISOString() }
    }, '-created_date', 100);

    console.log(`[LIMPEZA-P1] Encontrados ${aprendizadosZerados.length} aprendizados anteriores a 18/03`);

    // Validar que são realmente zerados (score baixo ou contexto vazio)
    const zeradosConfirmados = aprendizadosZerados.filter(
      a => (a.score_utilidade || 0) < 20 || !a.conteudo || a.conteudo.includes('zero')
    );

    console.log(`[LIMPEZA-P1] Desses, ${zeradosConfirmados.length} confirmados como zerados (score < 20 ou conteúdo vazio)`);

    // Deletar com throttle
    let deletados = 0;
    for (const aprendizado of zeradosConfirmados) {
      try {
        await base44.asServiceRole.entities.NexusMemory.delete(aprendizado.id);
        deletados++;
        console.log(`[LIMPEZA-P1] ✅ Deletado: ${aprendizado.id} (criado em ${new Date(aprendizado.created_date).toLocaleDateString('pt-BR')})`);
        
        // Throttle a cada 5 deletions
        if (deletados % 5 === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (e) {
        if (e.message?.includes('429')) {
          console.warn(`[LIMPEZA-P1] ⚠️ Rate limit — parando. ${deletados} deletados até agora.`);
          break;
        }
        console.warn(`[LIMPEZA-P1] ⚠️ Erro ao deletar ${aprendizado.id}: ${e.message}`);
      }
    }

    console.log(`[LIMPEZA-P1] ✅ CONCLUÍDO: ${deletados}/${zeradosConfirmados.length} aprendizados zerados removidos`);

    return Response.json({
      success: true,
      encontrados: aprendizadosZerados.length,
      zerados_confirmados: zeradosConfirmados.length,
      deletados: deletados,
      data_limite: dataLimite.toISOString()
    });

  } catch (error) {
    console.error('[LIMPEZA-P1] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});