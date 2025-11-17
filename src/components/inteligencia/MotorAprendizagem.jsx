/**
 * Motor de Aprendizagem - Sistema de Feedback Loop e Melhoria Contínua
 * Analisa padrões de sucesso/falha e ajusta comportamento da IA
 */

import { AprendizadoIA } from "@/entities/AprendizadoIA";
import { Interacao } from "@/entities/Interacao";
import { TarefaInteligente } from "@/entities/TarefaInteligente";
import { ClienteScore } from "@/entities/ClienteScore";
import { Orcamento } from "@/entities/Orcamento";
import { Venda } from "@/entities/Venda";
import { InvokeLLM } from "@/integrations/Core";

export class MotorAprendizagem {
  
  /**
   * Processa feedback de uma tarefa completada
   * Identifica padrões de sucesso/falha
   */
  static async processarFeedbackTarefa(tarefaId, resultado, observacoes) {
    try {
      console.log(`📚 [Aprendizagem] Processando feedback da tarefa ${tarefaId}`);
      
      const tarefa = await TarefaInteligente.get(tarefaId);
      if (!tarefa) return;
      
      // Buscar contexto da tarefa
      const contexto = await this.buscarContextoTarefa(tarefa);
      
      // Analisar efetividade da sugestão da IA
      const analise = await this.analisarEfetividadeSugestao(
        tarefa,
        resultado,
        observacoes,
        contexto
      );
      
      // Se identificou um padrão forte, salvar aprendizado
      if (analise.confianca >= 70) {
        await this.salvarAprendizado({
          tipo_aprendizado: 'eficacia_tarefa',
          contexto: {
            tipo_tarefa: tarefa.tipo_tarefa,
            segmento_cliente: contexto.cliente?.segmento,
            vendedor: tarefa.vendedor_responsavel,
            periodo: new Date().toISOString().slice(0, 7)
          },
          padrao_identificado: {
            descricao: analise.padrao_identificado,
            confianca: analise.confianca,
            exemplos: [{ tarefa_id: tarefaId, resultado, contexto: analise.fatores_sucesso }],
            metricas: {
              taxa_sucesso: analise.taxa_sucesso_estimada,
              impacto_esperado: analise.impacto_esperado
            }
          },
          aplicabilidade: {
            segmentos_aplicaveis: contexto.cliente?.segmento ? [contexto.cliente.segmento] : [],
            vendedores_aplicaveis: [tarefa.vendedor_responsavel],
            condicoes: analise.condicoes_aplicacao
          }
        });
      }
      
      // Atualizar score do cliente se aplicável
      if (tarefa.cliente_id) {
        await this.atualizarScoreComFeedback(tarefa.cliente_id, resultado, analise);
      }
      
      return analise;
      
    } catch (error) {
      console.error("❌ [Aprendizagem] Erro ao processar feedback:", error);
      return null;
    }
  }

  /**
   * Busca contexto completo da tarefa
   */
  static async buscarContextoTarefa(tarefa) {
    try {
      const contexto = { tarefa };
      
      // Cliente
      if (tarefa.cliente_id) {
        const { Cliente } = await import("@/entities/Cliente");
        contexto.cliente = await Cliente.get(tarefa.cliente_id);
        
        // Score do cliente
        const scores = await ClienteScore.filter({ cliente_id: tarefa.cliente_id }, '-data_calculo', 1);
        if (scores.length > 0) {
          contexto.score = scores[0];
        }
      }
      
      // Orçamento relacionado
      if (tarefa.orcamento_id) {
        contexto.orcamento = await Orcamento.get(tarefa.orcamento_id);
      }
      
      // Interações recentes com o cliente
      if (tarefa.cliente_nome) {
        const interacoes = await Interacao.filter(
          { cliente_nome: tarefa.cliente_nome },
          '-data_interacao',
          5
        );
        contexto.interacoes_recentes = interacoes;
      }
      
      return contexto;
      
    } catch (error) {
      console.error("❌ [Aprendizagem] Erro ao buscar contexto:", error);
      return { tarefa };
    }
  }

  /**
   * Analisa a efetividade da sugestão da IA
   */
  static async analisarEfetividadeSugestao(tarefa, resultado, observacoes, contexto) {
    try {
      const prompt = `Você é um analista de performance de IA especializado em vendas. Analise a efetividade de uma sugestão da IA.

TAREFA SUGERIDA PELA IA:
${JSON.stringify(tarefa, null, 2)}

RESULTADO DA EXECUÇÃO:
${resultado}

OBSERVAÇÕES DO VENDEDOR:
${observacoes}

CONTEXTO DO CLIENTE:
${JSON.stringify(contexto, null, 2)}

INSTRUÇÕES:
1. Determine se a sugestão da IA foi efetiva (sucesso/fracasso/parcial)
2. Identifique os FATORES que contribuíram para o resultado
3. Se possível, identifique um PADRÃO reutilizável
4. Estime a taxa de sucesso desse tipo de tarefa em contextos similares
5. Sugira condições de aplicação para melhorar a precisão futura

Retorne uma análise estruturada.`;

      const analise = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            efetividade: { type: "string", enum: ["sucesso", "fracasso", "parcial"] },
            fatores_sucesso: { type: "array", items: { type: "string" } },
            fatores_falha: { type: "array", items: { type: "string" } },
            padrao_identificado: { type: "string" },
            confianca: { type: "number", minimum: 0, maximum: 100 },
            taxa_sucesso_estimada: { type: "number", minimum: 0, maximum: 100 },
            impacto_esperado: { type: "string" },
            condicoes_aplicacao: { type: "object" }
          }
        }
      });
      
      return analise;
      
    } catch (error) {
      console.error("❌ [Aprendizagem] Erro ao analisar efetividade:", error);
      return {
        efetividade: "desconhecida",
        confianca: 0,
        taxa_sucesso_estimada: 50
      };
    }
  }

  /**
   * Salva um novo aprendizado
   */
  static async salvarAprendizado(dados) {
    try {
      const aprendizado = await AprendizadoIA.create({
        tipo_aprendizado: dados.tipo_aprendizado,
        contexto: dados.contexto,
        padrao_identificado: dados.padrao_identificado,
        aplicabilidade: dados.aplicabilidade,
        impacto_medido: {
          taxa_sucesso_antes: 0,
          taxa_sucesso_depois: dados.padrao_identificado.metricas?.taxa_sucesso || 0,
          melhoria_percentual: 0,
          n_aplicacoes: 1
        },
        ativo: true,
        data_descoberta: new Date().toISOString()
      });
      
      console.log("✅ [Aprendizagem] Novo aprendizado salvo:", aprendizado.id);
      return aprendizado;
      
    } catch (error) {
      console.error("❌ [Aprendizagem] Erro ao salvar aprendizado:", error);
      return null;
    }
  }

  /**
   * Atualiza score do cliente com base no feedback
   */
  static async atualizarScoreComFeedback(clienteId, resultado, analise) {
    try {
      const scores = await ClienteScore.filter({ cliente_id: clienteId }, '-data_calculo', 1);
      
      if (scores.length === 0) return;
      
      const scoreAtual = scores[0];
      let ajuste = 0;
      
      // Ajustar score baseado no resultado
      if (analise.efetividade === 'sucesso') {
        ajuste = 5; // Aumenta o score de engajamento
      } else if (analise.efetividade === 'fracasso') {
        ajuste = -3; // Reduz levemente
      }
      
      await ClienteScore.update(scoreAtual.id, {
        score_engagement: Math.max(0, Math.min(100, scoreAtual.score_engagement + ajuste)),
        data_calculo: new Date().toISOString()
      });
      
      console.log(`📊 [Aprendizagem] Score do cliente ${clienteId} ajustado em ${ajuste}`);
      
    } catch (error) {
      console.error("❌ [Aprendizagem] Erro ao atualizar score:", error);
    }
  }

  /**
   * Busca aprendizados aplicáveis ao contexto atual
   */
  static async buscarAprendizadosAplicaveis(contexto) {
    try {
      const filtros = { ativo: true };
      
      const aprendizados = await AprendizadoIA.filter(filtros, '-data_descoberta', 20);
      
      // Filtrar por contexto
      const aplicaveis = aprendizados.filter(a => {
        if (!a.aplicabilidade) return false;
        
        // Verificar segmento
        if (contexto.segmento && a.aplicabilidade.segmentos_aplicaveis?.length > 0) {
          if (!a.aplicabilidade.segmentos_aplicaveis.includes(contexto.segmento)) {
            return false;
          }
        }
        
        // Verificar vendedor
        if (contexto.vendedor && a.aplicabilidade.vendedores_aplicaveis?.length > 0) {
          if (!a.aplicabilidade.vendedores_aplicaveis.includes(contexto.vendedor)) {
            return false;
          }
        }
        
        return true;
      });
      
      // Ordenar por confiança
      return aplicaveis.sort((a, b) => 
        (b.padrao_identificado?.confianca || 0) - (a.padrao_identificado?.confianca || 0)
      );
      
    } catch (error) {
      console.error("❌ [Aprendizagem] Erro ao buscar aprendizados:", error);
      return [];
    }
  }

  /**
   * Analisa padrões de comportamento de clientes
   */
  static async analisarPadroesClientes() {
    try {
      console.log("🔍 [Aprendizagem] Analisando padrões de clientes...");
      
      // Buscar dados dos últimos 90 dias
      const dataLimite = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const [interacoes, orcamentos, vendas] = await Promise.all([
        Interacao.filter({ data_interacao: { $gte: dataLimite } }, '-data_interacao', 500),
        Orcamento.filter({ data_orcamento: { $gte: dataLimite } }, '-data_orcamento', 500),
        Venda.filter({ data_venda: { $gte: dataLimite } }, '-data_venda', 200)
      ]);
      
      // Preparar dados para análise
      const dadosAnalise = {
        total_interacoes: interacoes.length,
        total_orcamentos: orcamentos.length,
        total_vendas: vendas.length,
        taxa_conversao_global: orcamentos.length > 0 ? (vendas.length / orcamentos.length * 100).toFixed(2) : 0,
        
        // Padrões por segmento
        por_segmento: this.agruparPorSegmento(interacoes, orcamentos, vendas),
        
        // Padrões temporais
        melhor_dia_semana: this.identificarMelhorDia(interacoes),
        melhor_horario: this.identificarMelhorHorario(interacoes),
        
        // Canais mais efetivos
        efetividade_canais: this.analisarEfetividadeCanais(interacoes, vendas)
      };
      
      // Usar IA para identificar insights
      const insights = await this.gerarInsights(dadosAnalise);
      
      // Salvar aprendizados significativos
      if (insights.padroes_fortes?.length > 0) {
        for (const padrao of insights.padroes_fortes) {
          await this.salvarAprendizado({
            tipo_aprendizado: 'padrao_cliente',
            contexto: {
              periodo_analise: '90_dias',
              data_analise: new Date().toISOString()
            },
            padrao_identificado: padrao,
            aplicabilidade: {
              segmentos_aplicaveis: padrao.segmentos || [],
              condicoes: padrao.condicoes || {}
            }
          });
        }
      }
      
      return insights;
      
    } catch (error) {
      console.error("❌ [Aprendizagem] Erro ao analisar padrões:", error);
      return null;
    }
  }

  /**
   * Agrupa dados por segmento
   */
  static agruparPorSegmento(interacoes, orcamentos, vendas) {
    const segmentos = {};
    
    // Agrupar orçamentos por segmento (assumindo que temos essa info via cliente)
    orcamentos.forEach(orc => {
      // Aqui precisaríamos buscar o cliente, mas para performance vamos simplificar
      const segmento = 'Geral'; // Placeholder
      if (!segmentos[segmento]) {
        segmentos[segmento] = { orcamentos: 0, vendas: 0, taxa_conversao: 0 };
      }
      segmentos[segmento].orcamentos++;
    });
    
    return segmentos;
  }

  /**
   * Identifica melhor dia da semana
   */
  static identificarMelhorDia(interacoes) {
    const dias = {};
    
    interacoes.forEach(i => {
      if (!i.data_interacao) return;
      const data = new Date(i.data_interacao);
      const dia = data.getDay(); // 0 = Domingo, 6 = Sábado
      dias[dia] = (dias[dia] || 0) + 1;
    });
    
    const melhorDia = Object.entries(dias).sort((a, b) => b[1] - a[1])[0];
    const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    return melhorDia ? nomesDias[parseInt(melhorDia[0])] : 'Não identificado';
  }

  /**
   * Identifica melhor horário
   */
  static identificarMelhorHorario(interacoes) {
    const horarios = {};
    
    interacoes.forEach(i => {
      if (!i.data_interacao) return;
      const data = new Date(i.data_interacao);
      const hora = data.getHours();
      const periodo = hora < 12 ? 'Manhã' : hora < 18 ? 'Tarde' : 'Noite';
      horarios[periodo] = (horarios[periodo] || 0) + 1;
    });
    
    const melhorPeriodo = Object.entries(horarios).sort((a, b) => b[1] - a[1])[0];
    return melhorPeriodo ? melhorPeriodo[0] : 'Não identificado';
  }

  /**
   * Analisa efetividade dos canais
   */
  static analisarEfetividadeCanais(interacoes, vendas) {
    const canais = {};
    
    interacoes.forEach(i => {
      const canal = i.tipo_interacao || 'desconhecido';
      if (!canais[canal]) {
        canais[canal] = { total: 0, conversoes: 0 };
      }
      canais[canal].total++;
    });
    
    // Calcular taxa de conversão por canal (simplificado)
    Object.keys(canais).forEach(canal => {
      canais[canal].taxa_conversao = ((canais[canal].conversoes / canais[canal].total) * 100).toFixed(2);
    });
    
    return canais;
  }

  /**
   * Gera insights usando IA
   */
  static async gerarInsights(dadosAnalise) {
    try {
      const prompt = `Você é um analista de dados especializado em vendas. Analise os seguintes dados e identifique padrões fortes e acionáveis.

DADOS:
${JSON.stringify(dadosAnalise, null, 2)}

INSTRUÇÕES:
1. Identifique padrões com confiança >= 70%
2. Para cada padrão, sugira ações práticas
3. Priorize insights que possam ser automatizados
4. Considere sazonalidade e tendências

Retorne uma lista de padrões fortes identificados.`;

      const insights = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            padroes_fortes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  descricao: { type: "string" },
                  confianca: { type: "number" },
                  acao_sugerida: { type: "string" },
                  segmentos: { type: "array", items: { type: "string" } },
                  condicoes: { type: "object" }
                }
              }
            },
            resumo_geral: { type: "string" }
          }
        }
      });
      
      return insights;
      
    } catch (error) {
      console.error("❌ [Aprendizagem] Erro ao gerar insights:", error);
      return { padroes_fortes: [] };
    }
  }
}

export default MotorAprendizagem;