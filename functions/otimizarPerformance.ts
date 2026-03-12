import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * SKILL: otimizar_performance_paginas
 * 
 * Identifica páginas com baixa performance e sugere otimizações.
 */

Deno.serve(async (req) => {
  const inicio = Date.now();
  const metricas = {
    paginas_analisadas: 0,
    gargalos_encontrados: 0,
    sugestoes_geradas: 0
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { periodo_dias = 7, threshold_ms = 3000 } = await req.json().catch(() => ({}));

    // Buscar logs de saúde do sistema
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodo_dias);

    const healthLogs = await base44.asServiceRole.entities.SystemHealthLog.filter({
      created_date: { $gte: dataInicio.toISOString() }
    }, '-created_date', 500);

    // Buscar logs de auditoria com tempos de resposta
    const auditLogs = await base44.asServiceRole.entities.AuditLog.filter({
      created_date: { $gte: dataInicio.toISOString() },
      action: 'page_view'
    }, '-created_date', 500);

    metricas.paginas_analisadas = new Set([
      ...healthLogs.map(l => l.dados_evento?.page),
      ...auditLogs.map(l => l.entity_id)
    ].filter(Boolean)).size;

    // Analisar performance por página
    const performanceMap = {};
    
    healthLogs.forEach(log => {
      if (log.dados_evento?.page && log.dados_evento?.load_time_ms) {
        const pagina = log.dados_evento.page;
        if (!performanceMap[pagina]) {
          performanceMap[pagina] = {
            nome: pagina,
            tempos: [],
            erros: 0
          };
        }
        performanceMap[pagina].tempos.push(log.dados_evento.load_time_ms);
      }
    });

    // Calcular médias e identificar gargalos
    const gargalos = Object.values(performanceMap)
      .map(p => {
        const tempoMedio = p.tempos.reduce((a, b) => a + b, 0) / p.tempos.length;
        const tempoMax = Math.max(...p.tempos);
        return {
          pagina: p.nome,
          tempo_medio_ms: Math.round(tempoMedio),
          tempo_max_ms: tempoMax,
          total_carregamentos: p.tempos.length,
          e_gargalo: tempoMedio > threshold_ms
        };
      })
      .filter(p => p.e_gargalo)
      .sort((a, b) => b.tempo_medio_ms - a.tempo_medio_ms);

    metricas.gargalos_encontrados = gargalos.length;

    // Gerar sugestões de otimização
    const sugestoes = gargalos.map(g => {
      const sugestoesLista = [];
      
      if (g.tempo_medio_ms > 5000) {
        sugestoesLista.push('Implementar lazy loading de componentes pesados');
        sugestoesLista.push('Otimizar queries ao banco de dados');
      }
      
      if (g.tempo_medio_ms > 3000) {
        sugestoesLista.push('Adicionar cache de dados frequentes');
        sugestoesLista.push('Reduzir número de chamadas API');
      }
      
      if (g.total_carregamentos > 100) {
        sugestoesLista.push('Página popular - considerar CDN para assets');
      }

      metricas.sugestoes_geradas += sugestoesLista.length;

      return {
        pagina: g.pagina,
        tempo_medio_ms: g.tempo_medio_ms,
        severidade: g.tempo_medio_ms > 5000 ? 'critica' : g.tempo_medio_ms > 3000 ? 'alta' : 'media',
        otimizacoes: sugestoesLista,
        impacto_estimado: `Redução de ${Math.round((g.tempo_medio_ms - 1000) / g.tempo_medio_ms * 100)}% no tempo de carregamento`
      };
    });

    return Response.json({
      success: true,
      metricas,
      duration_ms: Date.now() - inicio,
      gargalos,
      sugestoes_otimizacao: sugestoes,
      resumo: {
        total_paginas_lentas: gargalos.length,
        tempo_medio_geral: gargalos.length > 0 ?
          Math.round(gargalos.reduce((sum, g) => sum + g.tempo_medio_ms, 0) / gargalos.length) : 0,
        impacto_usuarios: gargalos.reduce((sum, g) => sum + g.total_carregamentos, 0)
      }
    });

  } catch (error) {
    console.error('[otimizarPerformance] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      metricas,
      duration_ms: Date.now() - inicio
    }, { status: 500 });
  }
});