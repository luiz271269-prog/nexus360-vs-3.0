import { InvokeLLM } from "@/integrations/Core";
import { Cliente } from "@/entities/Cliente";
import { Interacao } from "@/entities/Interacao";

/**
 * ═══════════════════════════════════════════════════════════
 * SISTEMA DE QUALIFICAÇÃO AUTOMÁTICA DE LEADS
 * ═══════════════════════════════════════════════════════════
 * 
 * Baseado na metodologia BANT (Budget, Authority, Need, Timing)
 * adaptada para B2B moderno.
 * 
 * Gera um Score de Qualificação (0-100) baseado em:
 * - Critérios BANT
 * - Histórico de interações
 * - Sentimento e urgência
 * - Perfil comportamental
 */

class QualificadorLead {
  /**
   * Qualifica um lead automaticamente
   */
  static async qualificarLead(clienteId) {
    console.log('🎯 [Qualificador] Iniciando qualificação do lead:', clienteId);

    try {
      // ═══════════════════════════════════════════════════════════
      // PASSO 1: Buscar Dados do Lead
      // ═══════════════════════════════════════════════════════════
      const cliente = await Cliente.get(clienteId);
      if (!cliente) {
        throw new Error('Cliente não encontrado');
      }

      const interacoes = await Interacao.filter({ cliente_id: clienteId }, '-data_interacao', 10);

      // ═══════════════════════════════════════════════════════════
      // PASSO 2: Análise com IA
      // ═══════════════════════════════════════════════════════════
      const prompt = `Analise este lead B2B e atribua um Score de Qualificação (0-100) baseado na metodologia BANT adaptada.

**DADOS DO LEAD:**
- Nome: ${cliente.razao_social}
- Segmento: ${cliente.segmento}
- Status Atual: ${cliente.status}
- Última Interação: ${cliente.ultimo_contato}

**HISTÓRICO DE INTERAÇÕES (${interacoes.length}):**
${interacoes.map((i, idx) => `
${idx + 1}. ${new Date(i.data_interacao).toLocaleDateString()} - ${i.tipo_interacao}
   Resultado: ${i.resultado}
   Observações: ${i.observacoes || 'N/A'}
   Sentimento IA: ${i.analise_ia?.sentimento || 'N/A'}
   Urgência: ${i.analise_ia?.urgencia || 'N/A'}
`).join('\n')}

**CRITÉRIOS BANT:**
1. Budget (Orçamento): O lead tem capacidade financeira?
2. Authority (Autoridade): Está falando com o tomador de decisão?
3. Need (Necessidade): A necessidade é clara e urgente?
4. Timing (Momento): Quando pretende comprar?

**TAREFA:**
Com base nos dados acima, avalie cada critério BANT e gere um score final.`;

      const resultado = await InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            score_final: {
              type: "number",
              minimum: 0,
              maximum: 100,
              description: "Score de qualificação final"
            },
            criterios_bant: {
              type: "object",
              properties: {
                budget_confirmado: {
                  type: "boolean"
                },
                budget_score: {
                  type: "number",
                  minimum: 0,
                  maximum: 25
                },
                autoridade_confirmada: {
                  type: "boolean"
                },
                autoridade_score: {
                  type: "number",
                  minimum: 0,
                  maximum: 25
                },
                necessidade_clara: {
                  type: "boolean"
                },
                necessidade_score: {
                  type: "number",
                  minimum: 0,
                  maximum: 25
                },
                timing_compra: {
                  type: "string",
                  enum: ["imediato", "1-3_meses", "3-6_meses", "indefinido"]
                },
                timing_score: {
                  type: "number",
                  minimum: 0,
                  maximum: 25
                }
              }
            },
            perfil_identificado: {
              type: "string",
              enum: ["analitico", "pragmatico", "relacional", "inovador"]
            },
            justificativa: {
              type: "string",
              description: "Justificativa do score atribuído"
            },
            proxima_acao_recomendada: {
              type: "string",
              description: "Próxima ação que o vendedor deve tomar"
            },
            pronto_para_handoff: {
              type: "boolean",
              description: "Se o lead está pronto para ser transferido para vendedor humano"
            }
          },
          required: ["score_final", "criterios_bant", "justificativa", "pronto_para_handoff"]
        }
      });

      console.log('✅ [Qualificador] Lead qualificado:', resultado);

      // ═══════════════════════════════════════════════════════════
      // PASSO 3: Atualizar Cliente com Score
      // ═══════════════════════════════════════════════════════════
      await Cliente.update(clienteId, {
        score_qualificacao_lead: resultado.score_final,
        data_ultima_qualificacao: new Date().toISOString(),
        perfil_cliente: resultado.perfil_identificado,
        criterios_qualificacao: {
          budget_confirmado: resultado.criterios_bant.budget_confirmado,
          autoridade_confirmada: resultado.criterios_bant.autoridade_confirmada,
          necessidade_clara: resultado.criterios_bant.necessidade_clara,
          timing_compra: resultado.criterios_bant.timing_compra
        },
        status: resultado.pronto_para_handoff ? 'Lead Qualificado' : cliente.status
      });

      return {
        sucesso: true,
        score: resultado.score_final,
        pronto_handoff: resultado.pronto_para_handoff,
        detalhes: resultado
      };

    } catch (error) {
      console.error('❌ [Qualificador] Erro:', error);
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  /**
   * Qualifica múltiplos leads em lote
   */
  static async qualificarLote(clienteIds) {
    const resultados = [];
    
    for (const id of clienteIds) {
      try {
        const resultado = await this.qualificarLead(id);
        resultados.push({ cliente_id: id, ...resultado });
      } catch (error) {
        resultados.push({ cliente_id: id, sucesso: false, erro: error.message });
      }
    }

    return resultados;
  }
}

export default QualificadorLead;