import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * AUTOMAÇÃO AGENDADA: Análise Diária de Contatos (Inteligência)
 * Roda a cada 15 min, processa lote de 12 contatos sem análise nas últimas 24h
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
    
    console.log('[CRON_ANALISE_DIARIA] Iniciando análise incremental de contatos...');
    
    // CONFIGURAÇÃO: 12 contatos por execução (15 em 15 min = 48 contatos/hora)
    const LOTE_SIZE = 12;
    
    // 1. Buscar contatos sem análise nas últimas 24h
    const dataLimite24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [contatos, analisesRecentes] = await Promise.all([
      base44.asServiceRole.entities.Contact.filter(
        {
          tipo_contato: { $in: ['lead', 'cliente'] },
          ultima_interacao: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() } // Últimos 90 dias
        },
        '-ultima_interacao',
        100
      ),
      base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
        {
          analyzed_at: { $gte: dataLimite24h.toISOString() }
        },
        null,
        500
      )
    ]);
    
    console.log(`[CRON_ANALISE_DIARIA] ${contatos.length} contatos ativos | ${analisesRecentes.length} análises recentes`);
    
    // 2. Filtrar contatos sem análise recente
    const idsComAnalise = new Set(analisesRecentes.map(a => a.contact_id));
    const contatosSemAnalise = contatos.filter(c => !idsComAnalise.has(c.id));
    
    console.log(`[CRON_ANALISE_DIARIA] ${contatosSemAnalise.length} contatos sem análise nas últimas 24h`);
    
    // 3. Pegar apenas o lote configurado (12 contatos)
    const lote = contatosSemAnalise.slice(0, LOTE_SIZE);
    
    let total_processados = 0;
    let total_sucesso = 0;
    let total_erros = 0;
    const erros_detalhes = [];
    
    // 4. Processar lote
    for (const contato of lote) {
      total_processados++;
      
      try {
        const resp = await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
          contact_id: contato.id
        });
        
        if (resp.data?.success || resp.success) {
          total_sucesso++;
          console.log(`[CRON_ANALISE_DIARIA] ✅ ${contato.nome} analisado`);
        } else {
          total_erros++;
          console.log(`[CRON_ANALISE_DIARIA] ⚠️ ${contato.nome} sem dados suficientes`);
        }
        
        // Delay anti-rate-limit
        if (total_processados < lote.length) {
          await new Promise(r => setTimeout(r, 300));
        }
        
      } catch (error) {
        total_erros++;
        erros_detalhes.push({
          contact_id: contato.id,
          nome: contato.nome,
          erro: error.message
        });
        console.error(`[CRON_ANALISE_DIARIA] ❌ Erro em ${contato.nome}:`, error.message);
      }
    }
    
    const pendentes_restantes = contatosSemAnalise.length - lote.length;
    
    console.log(`[CRON_ANALISE_DIARIA] ✅ Lote concluído: ${total_sucesso} sucesso | ${total_erros} erros | ${pendentes_restantes} pendentes`);
    
    // 5. Registrar execução
    ;(async () => {
      try {
        await base44.asServiceRole.entities.SkillExecution.create({
          skill_name: 'analise_diaria_contatos_incremental',
          triggered_by: 'automacao_agendada',
          execution_mode: 'autonomous_safe',
          context: {
            lote_size: LOTE_SIZE,
            total_sem_analise: contatosSemAnalise.length,
            intervalo_minutos: 15
          },
          success: true,
          duration_ms: Date.now() - _tsInicio,
          metricas: {
            processados: total_processados,
            sucesso: total_sucesso,
            erros: total_erros,
            pendentes_restantes,
            taxa_sucesso: total_processados > 0 ? (total_sucesso / total_processados) * 100 : 0
          }
        });
      } catch (e) {
        console.warn('[cronAnaliseDiariaContatos] SkillExecution falhou (non-blocking):', e.message);
      }
    })();
    
    return Response.json({
      success: true,
      total_processados,
      total_sucesso,
      total_erros,
      pendentes_restantes,
      erros_detalhes
    });
    
  } catch (error) {
    console.error('[CRON_ANALISE_DIARIA] Erro crítico:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});