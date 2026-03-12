import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * SKILL: gerar_relatorio_uso
 * 
 * Gera relatório executivo de uso do sistema com insights de adoção.
 */

Deno.serve(async (req) => {
  const inicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { periodo_dias = 7, formato = 'json' } = await req.json().catch(() => ({}));

    // Calcular período
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodo_dias);
    const dataFim = new Date();

    // 1. Buscar dados gerais
    const [usuarios, auditLogs, healthLogs] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.AuditLog.filter({
        created_date: { $gte: dataInicio.toISOString() }
      }, '-created_date', 1000),
      base44.asServiceRole.entities.SystemHealthLog.filter({
        created_date: { $gte: dataInicio.toISOString() }
      }, '-created_date', 500)
    ]);

    // 2. Calcular KPIs principais
    const usuariosAtivos = new Set(auditLogs.map(l => l.usuario_id).filter(Boolean));
    const paginasAcessadas = new Set(auditLogs.map(l => l.entity_id || l.dados_evento?.page).filter(Boolean));

    const kpis = {
      usuarios_totais: usuarios.length,
      usuarios_ativos: usuariosAtivos.size,
      taxa_adocao: `${(usuariosAtivos.size / usuarios.length * 100).toFixed(1)}%`,
      total_acessos: auditLogs.length,
      paginas_unicas: paginasAcessadas.size,
      media_acessos_por_usuario: usuariosAtivos.size > 0 ?
        Math.round(auditLogs.length / usuariosAtivos.size) : 0
    };

    // 3. Top páginas por acesso
    const paginasMap = {};
    auditLogs.forEach(log => {
      const pagina = log.entity_id || log.dados_evento?.page || 'unknown';
      paginasMap[pagina] = (paginasMap[pagina] || 0) + 1;
    });

    const topPaginas = Object.entries(paginasMap)
      .map(([nome, acessos]) => ({ nome, acessos }))
      .sort((a, b) => b.acessos - a.acessos)
      .slice(0, 10);

    // 4. Análise de dispositivos
    const dispositivosMap = { desktop: 0, mobile: 0, tablet: 0 };
    auditLogs.forEach(log => {
      const ua = log.dados_evento?.user_agent || '';
      if (ua.includes('Mobile')) dispositivosMap.mobile++;
      else if (ua.includes('Tablet')) dispositivosMap.tablet++;
      else dispositivosMap.desktop++;
    });

    // 5. Saúde do sistema
    const errosCount = healthLogs.filter(l => 
      l.dados_evento?.severity === 'error' || l.dados_evento?.status === 'error'
    ).length;

    const saudeGeral = {
      total_logs: healthLogs.length,
      erros: errosCount,
      taxa_saude: `${((healthLogs.length - errosCount) / healthLogs.length * 100).toFixed(1)}%`
    };

    // 6. Insights e recomendações
    const insights = [];

    if (parseFloat(kpis.taxa_adocao) < 80) {
      insights.push({
        tipo: 'adocao_baixa',
        severidade: 'alta',
        mensagem: `Taxa de adoção de ${kpis.taxa_adocao} está abaixo do ideal (80%)`,
        recomendacao: 'Considerar campanha de treinamento ou comunicação interna'
      });
    }

    if (dispositivosMap.mobile / auditLogs.length > 0.3) {
      insights.push({
        tipo: 'trafego_mobile_alto',
        severidade: 'media',
        mensagem: `${(dispositivosMap.mobile / auditLogs.length * 100).toFixed(1)}% do tráfego vem de mobile`,
        recomendacao: 'Priorizar otimizações de responsividade mobile'
      });
    }

    if (errosCount > healthLogs.length * 0.1) {
      insights.push({
        tipo: 'alta_taxa_erro',
        severidade: 'critica',
        mensagem: `${(errosCount / healthLogs.length * 100).toFixed(1)}% dos logs são erros`,
        recomendacao: 'Investigar e corrigir problemas de estabilidade urgentemente'
      });
    }

    // 7. Montar relatório
    const relatorio = {
      metadata: {
        periodo: `${dataInicio.toLocaleDateString()} a ${dataFim.toLocaleDateString()}`,
        gerado_em: new Date().toISOString(),
        gerado_por: user.full_name,
        dias_analisados: periodo_dias
      },
      kpis_principais: kpis,
      top_10_paginas: topPaginas,
      distribuicao_dispositivos: dispositivosMap,
      saude_sistema: saudeGeral,
      insights,
      recomendacoes_priorizadas: insights
        .filter(i => i.severidade === 'critica' || i.severidade === 'alta')
        .map(i => i.recomendacao)
    };

    return Response.json({
      success: true,
      duration_ms: Date.now() - inicio,
      relatorio,
      formato
    });

  } catch (error) {
    console.error('[gerarRelatorioUso] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      duration_ms: Date.now() - inicio
    }, { status: 500 });
  }
});