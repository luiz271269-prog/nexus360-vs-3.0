import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * SKILL: analisar_analytics_aplicacao
 * 
 * Analisa métricas de uso da aplicação e gera insights acionáveis.
 * Dados fornecidos pelo Base44 Analytics via audit logs e system health.
 */

Deno.serve(async (req) => {
  const inicio = Date.now();
  const metricas = {
    total_usuarios: 0,
    paginas_analisadas: 0,
    insights_gerados: 0
  };

  try {
    const base44 = createClientFromRequest(req);
    const { periodo_dias = 7 } = await req.json().catch(() => ({}));

    // Calcular timestamp de início do período
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodo_dias);

    // 1. Buscar todos os usuários para análise de adoção
    const usuarios = await base44.asServiceRole.entities.User.list();
    metricas.total_usuarios = usuarios.length;

    // 2. Buscar logs de auditoria do período (acesso a páginas)
    const auditLogs = await base44.asServiceRole.entities.AuditLog.filter({
      created_date: { $gte: dataInicio.toISOString() }
    }, '-created_date', 1000);

    // 3. Agregar dados por página
    const paginasMap = {};
    const usuariosAtivos = new Set();
    
    auditLogs.forEach(log => {
      if (log.entity_tipo === 'page_view' || log.action?.includes('view')) {
        const pagina = log.entity_id || log.dados_evento?.page || 'unknown';
        
        if (!paginasMap[pagina]) {
          paginasMap[pagina] = {
            nome: pagina,
            total_visitas: 0,
            usuarios_unicos: new Set(),
            dispositivos: { desktop: 0, mobile: 0 },
            erros: 0
          };
        }
        
        paginasMap[pagina].total_visitas++;
        
        if (log.usuario_id) {
          paginasMap[pagina].usuarios_unicos.add(log.usuario_id);
          usuariosAtivos.add(log.usuario_id);
        }
        
        // Detectar dispositivo (baseado em user_agent se disponível)
        const isMobile = log.dados_evento?.dispositivo === 'mobile' || 
                        log.dados_evento?.user_agent?.includes('Mobile');
        paginasMap[pagina].dispositivos[isMobile ? 'mobile' : 'desktop']++;
      }
      
      // Detectar erros
      if (log.action?.includes('error') || log.dados_evento?.error) {
        const pagina = log.entity_id || 'unknown';
        if (paginasMap[pagina]) {
          paginasMap[pagina].erros++;
        }
      }
    });

    // 4. Converter map em array e ordenar
    const paginasAnalise = Object.values(paginasMap).map(p => ({
      ...p,
      usuarios_unicos: p.usuarios_unicos.size,
      taxa_mobile: p.total_visitas > 0 ? 
        (p.dispositivos.mobile / p.total_visitas * 100).toFixed(1) : 0,
      taxa_erro: p.total_visitas > 0 ?
        (p.erros / p.total_visitas * 100).toFixed(1) : 0
    })).sort((a, b) => b.total_visitas - a.total_visitas);

    metricas.paginas_analisadas = paginasAnalise.length;

    // 5. Gerar insights
    const insights = [];

    // Insight 1: Páginas mais acessadas
    const top5Paginas = paginasAnalise.slice(0, 5);
    insights.push({
      tipo: 'top_paginas',
      titulo: 'Páginas Mais Acessadas',
      dados: top5Paginas,
      acao_sugerida: 'Priorizar otimização e melhorias nas páginas com maior tráfego'
    });

    // Insight 2: Páginas com alta taxa de erro
    const paginasComErro = paginasAnalise
      .filter(p => parseFloat(p.taxa_erro) > 5)
      .slice(0, 5);
    
    if (paginasComErro.length > 0) {
      insights.push({
        tipo: 'paginas_com_erro',
        titulo: 'Páginas com Alta Taxa de Erro',
        dados: paginasComErro,
        acao_sugerida: 'Investigar e corrigir bugs urgentemente',
        severidade: 'alta'
      });
      metricas.insights_gerados++;
    }

    // Insight 3: Taxa de adoção
    const taxaAdocao = (usuariosAtivos.size / metricas.total_usuarios * 100).toFixed(1);
    insights.push({
      tipo: 'adocao',
      titulo: 'Taxa de Adoção do Sistema',
      dados: {
        usuarios_totais: metricas.total_usuarios,
        usuarios_ativos: usuariosAtivos.size,
        taxa_adocao: `${taxaAdocao}%`,
        periodo_dias
      },
      acao_sugerida: taxaAdocao < 80 ? 
        'Baixa adoção. Considerar treinamento ou campanha de engajamento' :
        'Boa adoção. Manter estratégia atual'
    });

    // Insight 4: Análise mobile vs desktop
    const totalVisitas = paginasAnalise.reduce((sum, p) => sum + p.total_visitas, 0);
    const visitasMobile = paginasAnalise.reduce((sum, p) => sum + p.dispositivos.mobile, 0);
    const taxaMobile = (visitasMobile / totalVisitas * 100).toFixed(1);
    
    insights.push({
      tipo: 'dispositivos',
      titulo: 'Distribuição por Dispositivo',
      dados: {
        total_visitas: totalVisitas,
        mobile: visitasMobile,
        desktop: totalVisitas - visitasMobile,
        taxa_mobile: `${taxaMobile}%`
      },
      acao_sugerida: taxaMobile > 30 ?
        'Alto tráfego mobile. Priorizar otimizações de responsividade' :
        'Tráfego predominante desktop. Focar em UX desktop'
    });

    metricas.insights_gerados = insights.length;

    // 6. Resumo executivo
    const resumo = {
      periodo: `Últimos ${periodo_dias} dias`,
      metricas_principais: {
        total_visitas: totalVisitas,
        usuarios_ativos: usuariosAtivos.size,
        taxa_adocao: `${taxaAdocao}%`,
        paginas_criticas: paginasComErro.length,
        taxa_mobile: `${taxaMobile}%`
      },
      top_3_paginas: top5Paginas.slice(0, 3).map(p => ({
        nome: p.nome,
        visitas: p.total_visitas,
        usuarios: p.usuarios_unicos
      })),
      alertas_criticos: paginasComErro.length > 0 ? [
        `${paginasComErro.length} páginas com taxa de erro > 5%`
      ] : []
    };

    return Response.json({
      success: true,
      metricas,
      duration_ms: Date.now() - inicio,
      resumo,
      insights,
      detalhamento_paginas: paginasAnalise
    });

  } catch (error) {
    console.error('[analisarAnalytics] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      metricas,
      duration_ms: Date.now() - inicio
    }, { status: 500 });
  }
});