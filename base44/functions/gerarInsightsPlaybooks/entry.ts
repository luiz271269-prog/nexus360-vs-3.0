import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  GERADOR DE INSIGHTS DE PLAYBOOKS                             ║
 * ║  Analisa desempenho e gera recomendações automáticas          ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { playbook_id, force_analysis = false } = payload;

    console.log('[INSIGHTS] Analisando playbook:', playbook_id);

    // 1. BUSCAR PLAYBOOK
    const playbook = await base44.asServiceRole.entities.FlowTemplate.get(playbook_id);

    if (!playbook) {
      throw new Error('Playbook não encontrado');
    }

    // 2. BUSCAR EXECUÇÕES
    const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
      flow_template_id: playbook_id
    }, '-updated_date', 500);

    if (execucoes.length < 10 && !force_analysis) {
      return Response.json({
        success: true,
        message: 'Dados insuficientes para análise (mínimo 10 execuções)',
        insights_gerados: 0
      }, { headers });
    }

    console.log(`[INSIGHTS] Analisando ${execucoes.length} execuções...`);

    // 3. CALCULAR MÉTRICAS
    const metricas = calcularMetricas(execucoes);

    // 4. ANALISAR PROBLEMAS POR STEP
    const problemasPorStep = analisarProblemasPorStep(execucoes, playbook.steps);

    // 5. GERAR INSIGHTS COM IA
    // Removed 'await' here because gerarInsightsComIA is now synchronous
    const insightsGerados = gerarInsightsComIA(
      base44,
      playbook,
      metricas,
      problemasPorStep,
      execucoes
    );

    // 6. SALVAR INSIGHTS NO BANCO
    const insightsSalvos = [];
    for (const insight of insightsGerados) {
      const insightSalvo = await base44.asServiceRole.entities.PlaybookInsight.create({
        playbook_id: playbook.id,
        playbook_nome: playbook.nome,
        insight_tipo: insight.tipo,
        descricao: insight.descricao,
        recomendacao_json: insight.recomendacao,
        confianca: insight.confianca,
        status: 'pendente',
        impacto_estimado: insight.impacto_estimado,
        dados_analise: {
          execucoes_analisadas: execucoes.length,
          taxa_abandono_atual: metricas.taxaAbandono,
          taxa_sucesso_atual: metricas.taxaSucesso,
          step_problematico: insight.step_index,
          exemplos_problemas: insight.exemplos
        },
        prioridade: insight.prioridade
      });

      insightsSalvos.push(insightSalvo);
    }

    // 7. GERAR NOTIFICAÇÕES PARA GESTORES
    if (insightsGerados.length > 0) {
      await gerarNotificacoesInsights(base44, playbook, insightsSalvos);
    }

    return Response.json({
      success: true,
      playbook_id: playbook.id,
      metricas,
      insights_gerados: insightsGerados.length,
      insights: insightsSalvos
    }, { headers });

  } catch (error) {
    console.error('[INSIGHTS] Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

function calcularMetricas(execucoes) {
  const total = execucoes.length;
  const concluidas = execucoes.filter(e => e.status === 'concluido').length;
  const canceladas = execucoes.filter(e => e.status === 'cancelado').length;
  const ativas = execucoes.filter(e => e.status === 'ativo').length;
  const erro = execucoes.filter(e => e.status === 'erro').length;

  return {
    total,
    concluidas,
    canceladas,
    ativas,
    erro,
    taxaSucesso: total > 0 ? (concluidas / total) * 100 : 0,
    taxaAbandono: total > 0 ? (canceladas / total) * 100 : 0,
    taxaErro: total > 0 ? (erro / total) * 100 : 0
  };
}

function analisarProblemasPorStep(execucoes, steps) {
  const problemas = {};

  for (let i = 0; i < steps.length; i++) {
    problemas[i] = {
      step_index: i,
      tipo_step: steps[i].type,
      abandonos: 0,
      tentativas_invalidas: 0,
      tempo_medio_resposta: 0,
      exemplos_problemas: []
    };
  }

  execucoes.forEach(exec => {
    if (exec.status === 'cancelado' && exec.current_step !== undefined) {
      const stepIndex = exec.current_step;
      if (problemas[stepIndex]) {
        problemas[stepIndex].abandonos++;

        if (exec.variables) {
          const campo = steps[stepIndex]?.campo;
          if (campo && exec.variables[`${campo}_tentativas`]) {
            problemas[stepIndex].tentativas_invalidas += exec.variables[`${campo}_tentativas`];
          }
        }
      }
    }
  });

  return problemas;
}

function gerarInsightsComIA(base44, playbook, metricas, problemasPorStep, execucoes) {
  const insights = [];

  // INSIGHT 1: Taxa de abandono alta em step específico
  Object.values(problemasPorStep).forEach(problema => {
    if (problema.abandonos > (execucoes.length * 0.2)) {
      const step = playbook.steps[problema.step_index];
      
      insights.push({
        tipo: 'melhoria_mensagem',
        step_index: problema.step_index,
        descricao: `Step ${problema.step_index} (${step.type}) tem alta taxa de abandono (${problema.abandonos} abandonos). Considere simplificar a mensagem ou reduzir opções.`,
        recomendacao: {
          step_index: problema.step_index,
          campo_modificar: 'texto',
          valor_anterior: step.texto || '',
          sugestao: 'Revisar texto para torná-lo mais claro e objetivo'
        },
        confianca: 0.75,
        prioridade: problema.abandonos > (execucoes.length * 0.3) ? 'alta' : 'media',
        impacto_estimado: {
          reducao_abandono_percentual: 15
        },
        exemplos: [`${problema.abandonos} usuários abandonaram neste ponto`]
      });
    }
  });

  // INSIGHT 2: Taxa de erro geral alta
  if (metricas.taxaErro > 10) {
    insights.push({
      tipo: 'otimizar_fluxo',
      step_index: null,
      descricao: `Taxa de erro de ${metricas.taxaErro.toFixed(1)}% está acima do esperado. Verifique validações e tratamento de erros.`,
      recomendacao: {
        acao: 'revisar_validacoes'
      },
      confianca: 0.85,
      prioridade: 'alta',
      impacto_estimado: {
        aumento_conversao_percentual: 20
      },
      exemplos: [`${metricas.erro} execuções terminaram em erro`]
    });
  }

  // INSIGHT 3: Muitas tentativas inválidas em inputs
  Object.values(problemasPorStep).forEach(problema => {
    if (problema.tentativas_invalidas > 0 && problema.tipo_step === 'input') {
      const step = playbook.steps[problema.step_index];
      
      insights.push({
        tipo: 'simplificar_input',
        step_index: problema.step_index,
        descricao: `Input no step ${problema.step_index} gera muitas tentativas inválidas. Considere adicionar exemplos ou simplificar opções.`,
        recomendacao: {
          step_index: problema.step_index,
          campo_modificar: 'opcoes',
          sugestao: 'Revisar opções válidas ou adicionar validação mais flexível'
        },
        confianca: 0.8,
        prioridade: 'media',
        impacto_estimado: {
          reducao_abandono_percentual: 10
        },
        exemplos: [`${problema.tentativas_invalidas} tentativas inválidas registradas`]
      });
    }
  });

  // INSIGHT 4: Taxa de sucesso baixa geral
  if (metricas.taxaSucesso < 50) {
    insights.push({
      tipo: 'otimizar_fluxo',
      step_index: null,
      descricao: `Taxa de sucesso de ${metricas.taxaSucesso.toFixed(1)}% está abaixo do ideal. Considere simplificar o fluxo ou adicionar mais fallbacks.`,
      recomendacao: {
        acao: 'simplificar_fluxo_completo'
      },
      confianca: 0.9,
      prioridade: 'critica',
      impacto_estimado: {
        aumento_conversao_percentual: 30
      },
      exemplos: [`Apenas ${metricas.concluidas} de ${metricas.total} execuções foram concluídas`]
    });
  }

  return insights;
}

async function gerarNotificacoesInsights(base44, playbook, insights) {
  // Buscar usuários admin para notificar
  const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

  for (const admin of admins) {
    for (const insight of insights) {
      if (insight.prioridade === 'critica' || insight.prioridade === 'alta') {
        await base44.asServiceRole.entities.NotificationEvent.create({
          tipo: 'insight_critico',
          titulo: `Insight: ${playbook.nome}`,
          mensagem: insight.descricao,
          prioridade: insight.prioridade === 'critica' ? 'critica' : 'alta',
          usuario_id: admin.id,
          usuario_nome: admin.full_name || admin.email,
          entidade_relacionada: 'PlaybookInsight',
          entidade_id: insight.id,
          acao_sugerida: {
            tipo: 'navegar',
            destino: `/PlaybooksAutomacao?playbook_id=${playbook.id}`
          },
          origem: 'gerarInsightsPlaybooks',
          metadata: {
            confianca: insight.confianca,
            impacto_estimado: insight.impacto_estimado
          },
          expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }
  }
}