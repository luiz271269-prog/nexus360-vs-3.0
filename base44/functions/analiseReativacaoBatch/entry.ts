import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SKILL SDR: Análise de Reativação em Lote
 * Análogo a analisarClientesEmLote, mas focado em reativação SDR
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
    
    const body = await req.json().catch(() => ({}));
    const {
      dias_inatividade = 30,
      limite = 100,
      modo = 'priorizacao' // 'priorizacao' | 'scheduled'
    } = body;
    
    console.log(`[ANALISE_REATIVACAO_BATCH] Modo: ${modo} | Inatividade: ${dias_inatividade}+ dias`);
    
    // 1. Detectar leads frios
    const detectarResp = await base44.asServiceRole.functions.invoke('detectarLeadsFrios', {
      dias_inatividade,
      limite
    });
    
    if (!detectarResp.data?.success) {
      throw new Error('Erro ao detectar leads frios');
    }
    
    const leads = detectarResp.data.leads || [];
    
    console.log(`[ANALISE_REATIVACAO_BATCH] ${leads.length} leads detectados`);
    
    // 2. Análise detalhada por classificação
    const distribuicao = {
      alto_potencial: leads.filter((l: any) => l.classificacao === 'alto_potencial'),
      medio_potencial: leads.filter((l: any) => l.classificacao === 'medio_potencial'),
      baixo_potencial: leads.filter((l: any) => l.classificacao === 'baixo_potencial')
    };
    
    // 3. Segmentação por tempo de inatividade (buckets)
    const buckets = {
      '30-60_dias': leads.filter((l: any) => l.dias_sem_contato >= 30 && l.dias_sem_contato < 60),
      '60-90_dias': leads.filter((l: any) => l.dias_sem_contato >= 60 && l.dias_sem_contato < 90),
      '90+_dias': leads.filter((l: any) => l.dias_sem_contato >= 90)
    };
    
    // 4. Calcular valor potencial recuperável
    const valor_potencial = leads.reduce((sum: number, l: any) => sum + (l.valor_orcamentos_abertos || 0), 0);
    
    // 5. Análise de motivos de inatividade
    const motivos = leads.reduce((acc: any, l: any) => {
      acc[l.motivo_inatividade] = (acc[l.motivo_inatividade] || 0) + 1;
      return acc;
    }, {});
    
    const metricas = {
      total_leads: leads.length,
      alto_potencial: distribuicao.alto_potencial.length,
      medio_potencial: distribuicao.medio_potencial.length,
      baixo_potencial: distribuicao.baixo_potencial.length,
      bucket_30_60: buckets['30-60_dias'].length,
      bucket_60_90: buckets['60-90_dias'].length,
      bucket_90_plus: buckets['90+_dias'].length,
      valor_potencial,
      motivos_inatividade: motivos
    };
    
    console.log(`[ANALISE_REATIVACAO_BATCH] ✅ Análise concluída:`, metricas);
    
    // 6. Registrar execução (mesmo padrão de analisarClientesEmLote)
    ;(async () => {
      try {
        await base44.asServiceRole.entities.SkillExecution.create({
          skill_name: 'analise_reativacao_batch',
          triggered_by: modo === 'scheduled' ? 'automacao_agendada' : 'user_action',
          execution_mode: 'autonomous_safe',
          context: {
            dias_inatividade,
            limite,
            modo
          },
          success: true,
          duration_ms: Date.now() - _tsInicio,
          metricas: {
            total_leads: metricas.total_leads,
            alto_potencial: metricas.alto_potencial,
            medio_potencial: metricas.medio_potencial,
            baixo_potencial: metricas.baixo_potencial,
            bucket_30_60: metricas.bucket_30_60,
            bucket_60_90: metricas.bucket_60_90,
            bucket_90_plus: metricas.bucket_90_plus,
            valor_potencial: metricas.valor_potencial
          }
        });
      } catch (e) {
        console.warn('[analiseReativacaoBatch] SkillExecution falhou (non-blocking):', e.message);
      }
    })();
    
    return Response.json({
      success: true,
      leads,
      distribuicao,
      buckets,
      valor_potencial,
      metricas
    });
    
  } catch (error) {
    console.error('[ANALISE_REATIVACAO_BATCH] Erro crítico:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});