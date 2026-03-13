// Automação: Sincronizar SkillRegistry.performance com SkillExecution real
// Executa: 1x/hora
// Objetivo: Manter registros de performance atualizados em vez de estáticos

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500, headers });
  }

  try {
    console.log('[SYNC-SKILL-REGISTRY] Iniciando sincronização de performance');
    
    // Buscar todas as skills ativas
    const skills = await base44.asServiceRole.entities.SkillRegistry.filter(
      { ativa: true },
      'skill_name',
      1000
    );

    if (!skills || skills.length === 0) {
      console.log('[SYNC-SKILL-REGISTRY] Nenhuma skill ativa encontrada');
      return Response.json({ 
        success: true, 
        message: 'Nenhuma skill para sincronizar',
        skills_processadas: 0
      }, { status: 200, headers });
    }

    const resultados = [];
    let skills_atualizadas = 0;
    let erros = 0;

    for (const skill of skills) {
      try {
        // Buscar execuções da skill nas últimas 24 horas
        const agora = new Date();
        const dia_atras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

        const execucoes = await base44.asServiceRole.entities.SkillExecution.filter(
          {
            skill_name: skill.skill_name,
            created_date: { $gte: dia_atras.toISOString() }
          },
          '-created_date',
          10000
        );

        const total = execucoes.length;
        const sucessos = execucoes.filter(e => e.success === true).length;
        const taxa_sucesso = total > 0 ? (sucessos / total) * 100 : 0;
        const tempo_medio_ms = total > 0
          ? execucoes.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / total
          : 0;

        // Atualizar SkillRegistry.performance
        await base44.asServiceRole.entities.SkillRegistry.update(skill.id, {
          performance: {
            total_execucoes: total,
            total_sucesso: sucessos,
            taxa_sucesso: Math.round(taxa_sucesso * 100) / 100, // 2 casas decimais
            tempo_medio_ms: Math.round(tempo_medio_ms)
          }
        });

        skills_atualizadas++;
        resultados.push({
          skill_name: skill.skill_name,
          total_execucoes: total,
          total_sucesso: sucessos,
          taxa_sucesso: `${taxa_sucesso.toFixed(1)}%`,
          tempo_medio_ms: Math.round(tempo_medio_ms)
        });

        console.log(`[SYNC-SKILL-REGISTRY] ✅ ${skill.skill_name}: ${total} execuções, ${sucessos} sucessos (${taxa_sucesso.toFixed(1)}%)`);

      } catch (e) {
        console.error(`[SYNC-SKILL-REGISTRY] ❌ Erro ao processar ${skill.skill_name}:`, e.message);
        erros++;
      }
    }

    console.log(`[SYNC-SKILL-REGISTRY] Concluído: ${skills_atualizadas} skills atualizadas, ${erros} erros`);

    return Response.json({
      success: true,
      message: `Sincronização concluída: ${skills_atualizadas} skills atualizadas`,
      skills_processadas: skills_atualizadas,
      erros,
      detalhes: resultados
    }, { status: 200, headers });

  } catch (error) {
    console.error('[SYNC-SKILL-REGISTRY] Erro geral:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});