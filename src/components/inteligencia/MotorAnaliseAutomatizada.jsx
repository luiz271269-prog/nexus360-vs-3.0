import { base44 } from "@/api/base44Client";
import { InvokeLLM } from "@/integrations/Core";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MOTOR DE ANÁLISE AUTOMATIZADA V3.0                        ║
 * ║  Análises profundas e contínuas do CRM                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export default class MotorAnaliseAutomatizada {

  /**
   * Análise Completa do CRM - Dashboard Executivo
   */
  static async analisarCRMCompleto() {
    try {
      console.log('[MotorAnalise] 🔍 Iniciando análise completa do CRM...');

      // Carregar todos os dados necessários
      const [clientes, orcamentos, vendas, interacoes, scores, tarefas] = await Promise.all([
        base44.entities.Cliente.list('-updated_date', 500),
        base44.entities.Orcamento.list('-created_date', 500),
        base44.entities.Venda.list('-data_venda', 500),
        base44.entities.Interacao.list('-data_interacao', 1000),
        base44.entities.ClienteScore.list('-score_total', 200),
        base44.entities.TarefaInteligente.filter({ status: 'pendente' })
      ]);

      // Preparar contexto rico
      const contexto = this.prepararContextoAnalise({
        clientes,
        orcamentos,
        vendas,
        interacoes,
        scores,
        tarefas
      });

      // Gerar análise com IA
      const analise = await InvokeLLM({
        prompt: this.gerarPromptAnaliseCompleta(contexto),
        response_json_schema: {
          type: "object",
          properties: {
            // Saúde Geral
            saude_geral_crm: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 100 },
                status: { type: "string", enum: ["critico", "atencao", "saudavel", "excelente"] },
                diagnostico: { type: "string" }
              }
            },

            // Alertas Críticos
            alertas_criticos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string" },
                  gravidade: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
                  titulo: { type: "string" },
                  descricao: { type: "string" },
                  acao_recomendada: { type: "string" },
                  impacto_estimado: { type: "string" }
                }
              }
            },

            // Oportunidades Identificadas
            oportunidades: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string" },
                  titulo: { type: "string" },
                  descricao: { type: "string" },
                  potencial_receita: { type: "number" },
                  probabilidade: { type: "number" },
                  acao_recomendada: { type: "string" }
                }
              }
            },

            // Tendências
            tendencias: {
              type: "object",
              properties: {
                vendas_proximo_mes: {
                  type: "object",
                  properties: {
                    valor_estimado: { type: "number" },
                    confianca: { type: "number" },
                    justificativa: { type: "string" }
                  }
                },
                taxa_conversao: {
                  type: "object",
                  properties: {
                    atual: { type: "number" },
                    tendencia: { type: "string", enum: ["crescendo", "estavel", "declinando"] },
                    previsao_3_meses: { type: "number" }
                  }
                },
                churn_risk: {
                  type: "object",
                  properties: {
                    clientes_em_risco: { type: "number" },
                    valor_em_risco: { type: "number" },
                    principais_motivos: {
                      type: "array",
                      items: { type: "string" }
                    }
                  }
                }
              }
            },

            // Recomendações Estratégicas
            recomendacoes_estrategicas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string" },
                  recomendacao: { type: "string" },
                  impacto_esperado: { type: "string" },
                  prioridade: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
                  esforco: { type: "string", enum: ["baixo", "medio", "alto"] }
                }
              }
            },

            // Performance por Segmento
            performance_segmentos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  segmento: { type: "string" },
                  faturamento: { type: "number" },
                  crescimento: { type: "number" },
                  taxa_conversao: { type: "number" },
                  avaliacao: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Salvar análise na NKDB
      await base44.entities.BaseConhecimento.create({
        titulo: `Análise Automática CRM - ${new Date().toLocaleDateString('pt-BR')}`,
        tipo_registro: 'analise_sentimento',
        categoria: 'inteligencia',
        conteudo: JSON.stringify(analise, null, 2),
        conteudo_estruturado: analise,
        tags: ['analise_automatica', 'crm', 'dashboard'],
        relevancia_score: 100,
        confianca_ia: analise.saude_geral_crm?.score || 80,
        origem_ia: {
          motor_gerador: 'MotorAnaliseAutomatizada',
          timestamp_geracao: new Date().toISOString()
        }
      });

      console.log('[MotorAnalise] ✅ Análise completa finalizada');

      return analise;

    } catch (error) {
      console.error('[MotorAnalise] ❌ Erro na análise completa:', error);
      throw error;
    }
  }

  /**
   * Análise de Risco de Churn - Identificação Precoce
   */
  static async analisarRiscoChurn() {
    try {
      console.log('[MotorAnalise] ⚠️ Analisando risco de churn...');

      const [clientes, interacoes, orcamentos, vendas, scores] = await Promise.all([
        base44.entities.Cliente.list(),
        base44.entities.Interacao.list('-data_interacao', 1000),
        base44.entities.Orcamento.list('-created_date', 300),
        base44.entities.Venda.list('-data_venda', 300),
        base44.entities.ClienteScore.list()
      ]);

      const clientesEmRisco = [];
      const agora = new Date();

      for (const cliente of clientes) {
        // Calcular dias sem contato
        const interacoesCliente = interacoes.filter(i => i.cliente_nome === cliente.razao_social);
        const ultimaInteracao = interacoesCliente[0];
        const diasSemContato = ultimaInteracao ?
          Math.floor((agora - new Date(ultimaInteracao.data_interacao)) / (1000 * 60 * 60 * 24)) :
          999;

        // Buscar score
        const score = scores.find(s => s.cliente_id === cliente.id);

        // Critérios de risco
        const riscos = [];
        let pontuacaoRisco = 0;

        if (diasSemContato > 30) {
          riscos.push(`${diasSemContato} dias sem contato`);
          pontuacaoRisco += 30;
        }

        if (score && score.risco_churn === 'alto' || score?.risco_churn === 'critico') {
          riscos.push(`IA detectou risco de churn: ${score.risco_churn}`);
          pontuacaoRisco += 40;
        }

        const orcamentosRecentes = orcamentos.filter(o =>
          o.cliente_nome === cliente.razao_social &&
          o.status === 'rejeitado'
        ).length;

        if (orcamentosRecentes >= 2) {
          riscos.push(`${orcamentosRecentes} orçamentos recusados`);
          pontuacaoRisco += 20;
        }

        // Verificar queda no valor de compras
        const vendasCliente = vendas
          .filter(v => v.cliente_nome === cliente.razao_social)
          .sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda));

        if (vendasCliente.length >= 3) {
          const valorUltimas3 = vendasCliente.slice(0, 3).reduce((sum, v) => sum + (v.valor_total || 0), 0) / 3;
          const valorAnteriores3 = vendasCliente.slice(3, 6).reduce((sum, v) => sum + (v.valor_total || 0), 0) / 3;

          if (valorUltimas3 < valorAnteriores3 * 0.7) {
            riscos.push('Queda de 30% no ticket médio');
            pontuacaoRisco += 25;
          }
        }

        if (pontuacaoRisco >= 40) {
          clientesEmRisco.push({
            cliente,
            pontuacaoRisco,
            riscos,
            score: score?.score_total || 0,
            diasSemContato,
            valorEmRisco: cliente.valor_recorrente_mensal || 0
          });
        }
      }

      // Ordenar por pontuação de risco (maior primeiro)
      clientesEmRisco.sort((a, b) => b.pontuacaoRisco - a.pontuacaoRisco);

      console.log(`[MotorAnalise] ⚠️ ${clientesEmRisco.length} clientes em risco de churn identificados`);

      return {
        total_em_risco: clientesEmRisco.length,
        valor_total_em_risco: clientesEmRisco.reduce((sum, c) => sum + c.valorEmRisco, 0),
        clientes: clientesEmRisco.slice(0, 10) // Top 10 mais críticos
      };

    } catch (error) {
      console.error('[MotorAnalise] ❌ Erro na análise de churn:', error);
      return { total_em_risco: 0, valor_total_em_risco: 0, clientes: [] };
    }
  }

  /**
   * Análise de Oportunidades de Upsell/Cross-sell
   */
  static async identificarOportunidadesUpsell() {
    try {
      console.log('[MotorAnalise] 💰 Identificando oportunidades de upsell...');

      const [clientes, vendas, orcamentos, scores] = await Promise.all([
        base44.entities.Cliente.list(),
        base44.entities.Venda.list('-data_venda', 500),
        base44.entities.Orcamento.list('-created_date', 300),
        base44.entities.ClienteScore.list()
      ]);

      const oportunidades = [];

      for (const cliente of clientes) {
        const score = scores.find(s => s.cliente_id === cliente.id);
        const vendasCliente = vendas.filter(v => v.cliente_nome === cliente.razao_social);
        const orcamentosCliente = orcamentos.filter(o => o.cliente_nome === cliente.razao_social);

        // Critérios para upsell
        const criterios = {
          alto_score: score && score.score_potencial_compra > 70,
          compras_recorrentes: vendasCliente.length >= 3,
          ticket_crescente: this.verificarTendenciaCrescente(vendasCliente),
          orcamentos_ativos: orcamentosCliente.filter(o =>
            ['enviado', 'negociando'].includes(o.status)
          ).length > 0
        };

        const pontuacao = Object.values(criterios).filter(Boolean).length;

        if (pontuacao >= 2) {
          const ticketMedio = vendasCliente.length > 0 ?
            vendasCliente.reduce((sum, v) => sum + (v.valor_total || 0), 0) / vendasCliente.length :
            0;

          oportunidades.push({
            cliente,
            pontuacao,
            criterios,
            ticket_medio: ticketMedio,
            potencial_upsell: ticketMedio * 1.5, // Estimativa: 50% a mais
            score_potencial: score?.score_potencial_compra || 0
          });
        }
      }

      oportunidades.sort((a, b) => b.potencial_upsell - a.potencial_upsell);

      console.log(`[MotorAnalise] 💎 ${oportunidades.length} oportunidades de upsell identificadas`);

      return {
        total_oportunidades: oportunidades.length,
        potencial_total: oportunidades.reduce((sum, o) => sum + o.potencial_upsell, 0),
        top_oportunidades: oportunidades.slice(0, 15)
      };

    } catch (error) {
      console.error('[MotorAnalise] ❌ Erro ao identificar upsell:', error);
      return { total_oportunidades: 0, potencial_total: 0, top_oportunidades: [] };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS AUXILIARES
  // ═══════════════════════════════════════════════════════════

  static prepararContextoAnalise(dados) {
    const agora = new Date();
    const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);

    // Vendas do mês atual vs mês passado
    const vendasMesAtual = dados.vendas.filter(v =>
      new Date(v.data_venda) >= new Date(agora.getFullYear(), agora.getMonth(), 1)
    );
    const vendasMesPassado = dados.vendas.filter(v => {
      const dataVenda = new Date(v.data_venda);
      return dataVenda >= mesPassado && dataVenda < new Date(agora.getFullYear(), agora.getMonth(), 1);
    });

    return {
      // Resumo Geral
      total_clientes: dados.clientes.length,
      clientes_ativos: dados.clientes.filter(c => c.status === 'Ativo').length,
      total_vendas_mes: vendasMesAtual.length,
      faturamento_mes_atual: vendasMesAtual.reduce((sum, v) => sum + (v.valor_total || 0), 0),
      faturamento_mes_passado: vendasMesPassado.reduce((sum, v) => sum + (v.valor_total || 0), 0),

      // Pipeline
      total_orcamentos: dados.orcamentos.length,
      orcamentos_em_negociacao: dados.orcamentos.filter(o => o.status === 'negociando').length,
      valor_pipeline: dados.orcamentos
        .filter(o => !['rejeitado', 'vencido'].includes(o.status))
        .reduce((sum, o) => sum + (o.valor_total || 0), 0),

      // Taxa de Conversão
      taxa_conversao_geral: dados.orcamentos.length > 0 ?
        (dados.vendas.length / dados.orcamentos.length) * 100 : 0,

      // Scores
      score_medio_clientes: dados.scores.length > 0 ?
        dados.scores.reduce((sum, s) => sum + (s.score_total || 0), 0) / dados.scores.length : 0,
      clientes_alta_urgencia: dados.scores.filter(s => s.score_urgencia >= 70).length,
      clientes_risco_churn: dados.scores.filter(s =>
        s.risco_churn === 'alto' || s.risco_churn === 'critico'
      ).length,

      // Tarefas e Atividades
      tarefas_pendentes: dados.tarefas.length,
      tarefas_criticas: dados.tarefas.filter(t => t.prioridade === 'critica').length,

      // Atividades Recentes
      interacoes_ultima_semana: dados.interacoes.filter(i => {
        const diasAtras = Math.floor((agora - new Date(i.data_interacao)) / (1000 * 60 * 60 * 24));
        return diasAtras <= 7;
      }).length
    };
  }

  static gerarPromptAnaliseCompleta(contexto) {
    return `Você é um analista sênior de CRM e vendas B2B especializado em diagnóstico empresarial.

**DADOS DO CRM:**
${JSON.stringify(contexto, null, 2)}

**SUA MISSÃO:**
Analise profundamente a saúde do CRM e forneça insights acionáveis:

1. **Saúde Geral do CRM:** Avalie de 0-100 e diagnostique o estado atual
2. **Alertas Críticos:** Identifique problemas urgentes que precisam de atenção IMEDIATA
3. **Oportunidades:** Detecte chances de aumentar receita (upsell, cross-sell, reativação)
4. **Tendências:** Preveja vendas, taxa de conversão e riscos de churn
5. **Recomendações Estratégicas:** Ações concretas priorizadas por impacto vs esforço
6. **Performance por Segmento:** Analise qual segmento está performando melhor

**CONTEXTO IMPORTANTE:**
- Taxa de conversão saudável B2B: 20-30%
- Churn aceitável B2B: < 5% ao ano
- Score de cliente saudável: > 600/1000
- Pipeline saudável: 3-5x da meta mensal

Seja específico, quantitativo e focado em ações concretas.`;
  }

  static verificarTendenciaCrescente(vendas) {
    if (vendas.length < 3) return false;

    const vendasOrdenadas = vendas
      .sort((a, b) => new Date(a.data_venda) - new Date(b.data_venda));

    const primeiraMetade = vendasOrdenadas.slice(0, Math.floor(vendas.length / 2));
    const segundaMetade = vendasOrdenadas.slice(Math.floor(vendas.length / 2));

    const mediaPrimeira = primeiraMetade.reduce((sum, v) => sum + (v.valor_total || 0), 0) / primeiraMetade.length;
    const mediaSegunda = segundaMetade.reduce((sum, v) => sum + (v.valor_total || 0), 0) / segundaMetade.length;

    return mediaSegunda > mediaPrimeira * 1.1; // Crescimento de 10%+
  }
}