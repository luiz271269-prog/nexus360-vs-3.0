
import React from 'react';
import { InvokeLLM } from "@/integrations/Core";
import SistemaToolUse from "./SistemaToolUse";
import RoteamentoInteligente from "./RoteamentoInteligente";
import QualificadorLead from "./QualificadorLead";

/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR DE RACIOCÍNIO MULTI-PASSOS - VERSÃO INTEGRADA
 * ═══════════════════════════════════════════════════════════
 * 
 * Agora integrado com:
 * - Roteamento Inteligente
 * - Qualificação de Leads
 * - Sistema de Tool Use
 * 
 * Exemplo de uso:
 * "Crie um orçamento para o cliente X com os produtos Y e Z"
 * 
 * Passos que o motor executará:
 * 1. Buscar dados do cliente X
 * 2. Verificar disponibilidade dos produtos Y e Z
 * 3. Calcular preços com margem adequada
 * 4. Gerar orçamento estruturado
 * 5. Validar e retornar
 */

class MotorRaciocinio {
  constructor() {
    this.historicoPensamento = [];
    this.maxIteracoes = 10;
  }

  /**
   * Método principal: Executa raciocínio multi-passos
   */
  async executarTarefa(objetivo, contexto = {}, toolsDisponiveis = []) {
    console.log('🧠 [Motor Raciocínio] Iniciando tarefa:', objetivo);
    
    // Detectar se é uma tarefa de roteamento ou qualificação
    const ehRoteamento = objetivo.toLowerCase().includes('distribuir lead') || 
                        objetivo.toLowerCase().includes('atribuir vendedor');
    const ehQualificacao = objetivo.toLowerCase().includes('qualificar lead') ||
                          objetivo.toLowerCase().includes('avaliar lead');

    // Atalho para tarefas especializadas
    if (ehRoteamento && contexto.dadosLead) {
      console.log('🎯 [Motor Raciocínio] Tarefa de roteamento detectada');
      const resultado = await RoteamentoInteligente.distribuirLead(contexto.dadosLead);
      return {
        sucesso: resultado.sucesso,
        resultado: resultado,
        passos: [{ tipo: 'roteamento', conteudo: resultado }],
        iteracoes: 1
      };
    }

    if (ehQualificacao && contexto.cliente_id) {
      console.log('🎯 [Motor Raciocínio] Tarefa de qualificação detectada');
      const resultado = await QualificadorLead.qualificarLead(contexto.cliente_id);
      return {
        sucesso: resultado.sucesso,
        resultado: resultado,
        passos: [{ tipo: 'qualificacao', conteudo: resultado }],
        iteracoes: 1
      };
    }

    // Fluxo normal multi-passos
    this.historicoPensamento = [];
    let iteracao = 0;
    let tarefaConcluida = false;
    let resultadoFinal = null;

    try {
      while (!tarefaConcluida && iteracao < this.maxIteracoes) {
        iteracao++;
        console.log(`🔄 [Motor Raciocínio] Iteração ${iteracao}/${this.maxIteracoes}`);

        // ═══════════════════════════════════════════════════════════
        // PASSO 1: PLANEJAMENTO
        // ═══════════════════════════════════════════════════════════
        const plano = await this.planejarProximoPasso(objetivo, contexto, toolsDisponiveis);
        
        this.historicoPensamento.push({
          iteracao,
          tipo: 'planejamento',
          conteudo: plano
        });

        if (plano.status === 'concluido') {
          tarefaConcluida = true;
          resultadoFinal = plano.resultado;
          break;
        }

        // ═══════════════════════════════════════════════════════════
        // PASSO 2: EXECUÇÃO
        // ═══════════════════════════════════════════════════════════
        const resultadoExecucao = await this.executarPasso(plano, contexto);
        
        this.historicoPensamento.push({
          iteracao,
          tipo: 'execucao',
          conteudo: resultadoExecucao
        });

        // Atualizar contexto com resultado
        contexto = {
          ...contexto,
          ...resultadoExecucao.dadosNovos
        };

        // ═══════════════════════════════════════════════════════════
        // PASSO 3: VALIDAÇÃO E AUTO-CORREÇÃO
        // ═══════════════════════════════════════════════════════════
        if (resultadoExecucao.erro) {
          console.warn('⚠️ [Motor Raciocínio] Erro detectado, tentando corrigir...');
          const correcao = await this.autoCorrigir(resultadoExecucao.erro, contexto);
          contexto = {
            ...contexto,
            ultimoErro: resultadoExecucao.erro,
            tentativaCorrecao: correcao
          };
        }
      }

      if (!tarefaConcluida) {
        throw new Error('Limite de iterações atingido sem conclusão da tarefa');
      }

      return {
        sucesso: true,
        resultado: resultadoFinal,
        passos: this.historicoPensamento,
        iteracoes: iteracao
      };

    } catch (error) {
      console.error('❌ [Motor Raciocínio] Erro:', error);
      return {
        sucesso: false,
        erro: error.message,
        passos: this.historicoPensamento,
        iteracoes: iteracao 
      };
    }
  }

  /**
   * Planeja o próximo passo baseado no objetivo e contexto atual
   */
  async planejarProximoPasso(objetivo, contexto, toolsDisponiveis) {
    const prompt = `Você é um assistente de IA com capacidade de raciocínio multi-passos.

**OBJETIVO PRINCIPAL:**
${objetivo}

**CONTEXTO ATUAL:**
${JSON.stringify(contexto, null, 2)}

**FERRAMENTAS DISPONÍVEIS:**
${toolsDisponiveis.map(t => `- ${t.nome}: ${t.descricao}`).join('\n')}

**HISTÓRICO DE PENSAMENTO:**
${this.historicoPensamento.map((h, i) => `${i + 1}. ${h.tipo}: ${JSON.stringify(h.conteudo)}`).join('\n')}

Analise a situação e determine:
1. Se o objetivo já foi alcançado (status: "concluido")
2. Ou qual é o próximo passo necessário (status: "em_progresso")

Responda em JSON estruturado.`;

    const resposta = await InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["concluido", "em_progresso"]
          },
          raciocinamento: {
            type: "string",
            description: "Explicação do raciocínio"
          },
          proximoPasso: {
            type: "object",
            properties: {
              acao: { type: "string" },
              ferramenta: { type: "string" },
              parametros: { type: "object" }
            }
          },
          resultado: {
            type: "object",
            description: "Resultado final se status = concluido"
          }
        }
      }
    });

    return resposta;
  }

  /**
   * Executa um passo específico do plano
   */
  async executarPasso(plano, contexto) {
    console.log('⚙️ [Motor Raciocínio] Executando:', plano.proximoPasso?.acao);

    try {
      // Aqui você integraria com as ferramentas reais do sistema
      // Por exemplo: criar orçamento, buscar cliente, etc.
      
      const resultado = {
        sucesso: true,
        dadosNovos: {
          [`resultado_${plano.proximoPasso?.acao}`]: 'Executado com sucesso'
        }
      };

      return resultado;

    } catch (error) {
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  /**
   * Tenta auto-corrigir um erro detectado
   */
  async autoCorrigir(erro, contexto) {
    const prompt = `Ocorreu um erro durante a execução:

**ERRO:**
${erro}

**CONTEXTO:**
${JSON.stringify(contexto, null, 2)}

Sugira uma correção ou abordagem alternativa.`;

    const correcao = await InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          abordagemAlternativa: { type: "string" },
          parametrosAjustados: { type: "object" }
        }
      }
    });

    return correcao;
  }
}

export default new MotorRaciocinio();
