import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * SKILL: otimizar_performance_paginas
 * 
 * Identifica páginas com baixa performance e sugere otimizações.
 */

Deno.serve(async (req) => {
  const inicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dias_analise = 7 } = await req.json().catch(() => ({}));

    // Buscar logs de saúde recentes
    const dataLimite = new Date(Date.now() - dias_analise * 24 * 60 * 60 * 1000);
    const logs = await base44.asServiceRole.entities.SystemHealthLog.filter(
      { created_date: { $gte: dataLimite.toISOString() } },
      '-created_date',
      500
    );

    // Buscar audit logs para análise de acesso
    const audits = await base44.asServiceRole.entities.AuditLog.filter(
      { 
        entity_tipo: 'page_view',
        created_date: { $gte: dataLimite.toISOString() }
      },
      '-created_date',
      1000
    );

    // Agregar por página
    const paginasMap = {};
    
    audits.forEach(audit => {
      const pagina = audit.dados_evento?.page || 'unknown';
      if (!paginasMap[pagina]) {
        paginasMap[pagina] = {
          nome: pagina,
          total_visitas: 0,
          tempo_total_ms: 0,
          erros: 0
        };
      }
      paginasMap[pagina].total_visitas++;
      if (audit.dados_evento?.load_time_ms) {
        paginasMap[pagina].tempo_total_ms += audit.dados_evento.load_time_ms;
      }
      if (audit.dados_evento?.error) {
        paginasMap[pagina].erros++;
      }
    });

    // Calcular métricas e identificar gargalos
    const paginas = Object.values(paginasMap).map(p => ({
      ...p,
      tempo_medio_ms: p.total_visitas > 0 ? Math.round(p.tempo_total_ms / p.total_visitas) : 0,
      taxa_erro: p.total_visitas > 0 ? (p.erros / p.total_visitas * 100).toFixed(1) : 0
    }));

    // Identificar problemas
    const paginasLentas = paginas.filter(p => p.tempo_medio_ms > 3000).sort((a,b) => b.tempo_medio_ms - a.tempo_medio_ms);
    const paginasComErros = paginas.filter(p => parseFloat(p.taxa_erro) > 5).sort((a,b) => b.taxa_erro - a.taxa_erro);

    // Gerar recomendações
    const recomendacoes = [];
    
    paginasLentas.forEach(p => {
      recomendacoes.push({
        pagina: p.nome,
        problema: `Tempo médio de ${p.tempo_medio_ms}ms (>3s)`,
        sugestoes: [
          'Implementar lazy loading de componentes',
          'Adicionar paginação se lista grande',
          'Cachear queries pesadas com React Query',
          'Otimizar imagens (webp, lazy loading)'
        ]
      });
    });

    paginasComErros.forEach(p => {
      recomendacoes.push({
        pagina: p.nome,
        problema: `Taxa de erro ${p.taxa_erro}% (>5%)`,
        sugestoes: [
          'Verificar logs de runtime',
          'Adicionar error boundaries',
          'Validar dados antes de renderizar',
          'Checar dependências ausentes'
        ]
      });
    });

    const resultado = {
      success: true,
      periodo_analise: `${dias_analise} dias`,
      total_paginas_analisadas: paginas.length,
      paginas_lentas: paginasLentas.length,
      paginas_com_erros: paginasComErros.length,
      top_5_lentas: paginasLentas.slice(0, 5),
      top_5_erros: paginasComErros.slice(0, 5),
      recomendacoes: recomendacoes.slice(0, 10),
      metricas_gerais: {
        tempo_medio_geral: Math.round(paginas.reduce((sum, p) => sum + p.tempo_medio_ms, 0) / paginas.length),
        taxa_erro_geral: (paginas.reduce((sum, p) => sum + parseFloat(p.taxa_erro), 0) / paginas.length).toFixed(2)
      }
    };

    return Response.json({
      success: true,
      resultado,
      duration_ms: Date.now() - inicio
    });

  } catch (error) {
    console.error('[otimizarPerformance] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      duration_ms: Date.now() - inicio
    }, { status: 500 });
  }
});