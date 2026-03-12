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

    const { periodo_dias = 7 } = await req.json().catch(() => ({}));

    const dataLimite = new Date(Date.now() - periodo_dias * 24 * 60 * 60 * 1000);

    // Buscar dados
    const [usuarios, audits, healthLogs] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 500),
      base44.asServiceRole.entities.AuditLog.filter(
        { created_date: { $gte: dataLimite.toISOString() } },
        '-created_date',
        2000
      ),
      base44.asServiceRole.entities.SystemHealthLog.filter(
        { created_date: { $gte: dataLimite.toISOString() } },
        '-created_date',
        500
      )
    ]);

    // Métricas de adoção
    const usuariosAtivos = audits.reduce((set, a) => {
      if (a.usuario_id) set.add(a.usuario_id);
      return set;
    }, new Set()).size;

    const taxaAdocao = usuarios.length > 0 ? 
      (usuariosAtivos / usuarios.length * 100).toFixed(1) : 0;

    // Páginas mais usadas
    const paginasMap = {};
    audits.forEach(a => {
      const pagina = a.dados_evento?.page || 'unknown';
      paginasMap[pagina] = (paginasMap[pagina] || 0) + 1;
    });
    const topPaginas = Object.entries(paginasMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([nome, visitas]) => ({ nome, visitas }));

    // Horários de pico
    const horarioMap = {};
    audits.forEach(a => {
      if (a.created_date) {
        const hora = new Date(a.created_date).getHours();
        horarioMap[hora] = (horarioMap[hora] || 0) + 1;
      }
    });
    const horarioPico = Object.entries(horarioMap)
      .sort(([,a], [,b]) => b - a)[0];

    // Dispositivos
    const deviceMap = { mobile: 0, desktop: 0, unknown: 0 };
    audits.forEach(a => {
      const ua = a.dados_evento?.user_agent || '';
      if (/mobile|android|iphone/i.test(ua)) deviceMap.mobile++;
      else if (ua) deviceMap.desktop++;
      else deviceMap.unknown++;
    });

    // Erros críticos
    const errosCriticos = healthLogs
      .filter(log => log.severity === 'error' || log.severity === 'critical')
      .slice(0, 10);

    // Insights e recomendações
    const insights = [];
    
    if (parseFloat(taxaAdocao) < 50) {
      insights.push({
        tipo: 'alerta',
        titulo: 'Baixa Adoção',
        descricao: `Apenas ${taxaAdocao}% dos usuários ativos. Sugestão: enviar tutorial de onboarding.`
      });
    }

    if (deviceMap.mobile > deviceMap.desktop) {
      insights.push({
        tipo: 'info',
        titulo: 'Uso Mobile Predominante',
        descricao: `${((deviceMap.mobile / (deviceMap.mobile + deviceMap.desktop)) * 100).toFixed(1)}% mobile. Priorizar responsividade.`
      });
    }

    if (errosCriticos.length > 5) {
      insights.push({
        tipo: 'urgente',
        titulo: 'Erros Críticos Detectados',
        descricao: `${errosCriticos.length} erros no período. Revisar logs imediatamente.`
      });
    }

    const relatorio = {
      periodo: `${periodo_dias} dias`,
      gerado_em: new Date().toISOString(),
      metricas_chave: {
        total_usuarios: usuarios.length,
        usuarios_ativos: usuariosAtivos,
        taxa_adocao: `${taxaAdocao}%`,
        total_acessos: audits.length,
        horario_pico: horarioPico ? `${horarioPico[0]}h (${horarioPico[1]} acessos)` : 'N/A'
      },
      distribuicao_dispositivos: {
        mobile: deviceMap.mobile,
        desktop: deviceMap.desktop,
        percentual_mobile: `${((deviceMap.mobile / (deviceMap.mobile + deviceMap.desktop)) * 100).toFixed(1)}%`
      },
      top_paginas: topPaginas,
      erros_criticos: errosCriticos.length,
      insights,
      recomendacoes: insights.map(i => i.descricao)
    };

    return Response.json({
      success: true,
      relatorio,
      duration_ms: Date.now() - inicio,
      message: `✅ Relatório de ${periodo_dias} dias gerado com ${insights.length} insights.`
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