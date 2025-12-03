import React from "react";
import { InvokeLLM } from "@/integrations/Core";
import { Cliente } from "@/entities/Cliente";
import { ClienteScore } from "@/entities/ClienteScore";
import { AutomationRule } from "@/entities/AutomationRule";
import { AutomationExecution } from "@/entities/AutomationExecution";
import { Vendedor } from "@/entities/Vendedor";
import { Venda } from "@/entities/Venda";
import { Orcamento } from "@/entities/Orcamento";
import { Interacao } from "@/entities/Interacao";
import { Message } from "@/entities/Message";

export class MotorInteligencia {
  
  static async calcularScoreCliente(clienteId) {
    try {
      const [cliente, vendas, orcamentos, interacoes] = await Promise.all([
        Cliente.filter({id: clienteId}),
        Venda.filter({cliente_nome: clienteId}),
        Orcamento.filter({cliente_nome: clienteId}),
        Interacao.filter({cliente_id: clienteId})
      ]);

      if (!cliente || cliente.length === 0) return null;

      const dadosCliente = cliente[0];
      
      const prompt = `
Analise os dados do cliente e calcule um score inteligente:

DADOS DO CLIENTE:
${JSON.stringify(dadosCliente, null, 2)}

HISTÓRICO DE VENDAS (${vendas.length} vendas):
${JSON.stringify(vendas.slice(-5), null, 2)}

ORÇAMENTOS (${orcamentos.length} orçamentos):
${JSON.stringify(orcamentos.slice(-3), null, 2)}

INTERAÇÕES (${interacoes.length} interações):
${JSON.stringify(interacoes.slice(-10), null, 2)}

Calcule scores de 0-100 para cada categoria:
1. ENGAGEMENT: Baseado na frequência e qualidade das interações
2. POTENCIAL_COMPRA: Baseado no histórico de compras e orçamentos
3. RISCO_CHURN: Risco de perder o cliente (tempo sem comprar, reclamações)
4. VALOR_CLIENTE: Valor financeiro atual e potencial

Também sugira a PRÓXIMA MELHOR AÇÃO específica para este cliente.
`;

      const resultado = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            score_engagement: {type: "number", minimum: 0, maximum: 100},
            score_potencial_compra: {type: "number", minimum: 0, maximum: 100},
            score_risco_churn: {type: "number", minimum: 0, maximum: 100},
            score_valor_cliente: {type: "number", minimum: 0, maximum: 100},
            proxima_melhor_acao: {type: "string"},
            motivo_score: {type: "string"},
            urgencia: {type: "string", enum: ["baixa", "media", "alta", "critica"]}
          },
          required: ["score_engagement", "score_potencial_compra", "score_risco_churn", "score_valor_cliente"]
        }
      });

      const scoreTotal = Math.round(
        (resultado.score_engagement * 0.25) +
        (resultado.score_potencial_compra * 0.35) +
        ((100 - resultado.score_risco_churn) * 0.25) +
        (resultado.score_valor_cliente * 0.15)
      );

      // Salvar ou atualizar score
      const scoresExistentes = await ClienteScore.filter({cliente_id: clienteId});
      const novoScore = {
        cliente_id: clienteId,
        score_total: scoreTotal * 10, // Convertendo para escala 0-1000
        score_engagement: resultado.score_engagement,
        score_potencial_compra: resultado.score_potencial_compra,
        score_risco_churn: resultado.score_risco_churn,
        score_valor_cliente: resultado.score_valor_cliente,
        proxima_melhor_acao: resultado.proxima_melhor_acao,
        motivo_score: resultado.motivo_score,
        data_calculo: new Date().toISOString()
      };

      if (scoresExistentes.length > 0) {
        await ClienteScore.update(scoresExistentes[0].id, novoScore);
      } else {
        await ClienteScore.create(novoScore);
      }

      // Verificar se deve disparar automações
      await this.verificarAutomacoesPorScore(clienteId, novoScore, resultado.urgencia);
      
      return novoScore;

    } catch (error) {
      console.error("Erro ao calcular score do cliente:", error);
      return null;
    }
  }

  static async verificarAutomacoesPorScore(clienteId, score, urgencia) {
    try {
      const regras = await AutomationRule.filter({ativo: true});
      
      for (const regra of regras) {
        if (regra.trigger.tipo === "score") {
          const deveExecutar = await this.avaliarCondicoesRegra(regra, {
            cliente_id: clienteId,
            score: score,
            urgencia: urgencia
          });

          if (deveExecutar) {
            await this.agendarExecucaoAutomacao(regra.id, clienteId, "cliente");
          }
        }
      }
    } catch (error) {
      console.error("Erro ao verificar automações por score:", error);
    }
  }

  static async avaliarCondicoesRegra(regra, dados) {
    if (!regra.condicoes || regra.condicoes.length === 0) return true;

    for (const condicao of regra.condicoes) {
      const valor = dados[condicao.campo];
      
      switch (condicao.operador) {
        case "maior_que":
          if (!(Number(valor) > Number(condicao.valor))) return false;
          break;
        case "menor_que":
          if (!(Number(valor) < Number(condicao.valor))) return false;
          break;
        case "igual":
          if (valor !== condicao.valor) return false;
          break;
        case "contem":
          if (!String(valor).includes(condicao.valor)) return false;
          break;
      }
    }
    
    return true;
  }

  static async agendarExecucaoAutomacao(ruleId, targetId, targetType) {
    try {
      await AutomationExecution.create({
        rule_id: ruleId,
        target_entity_id: targetId,
        target_entity_type: targetType,
        status: "agendado",
        agendado_para: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao agendar execução:", error);
    }
  }

  static async executarAutomacao(execution) {
    try {
      await AutomationExecution.update(execution.id, {
        status: "executando",
        executado_em: new Date().toISOString()
      });

      const regra = await AutomationRule.filter({id: execution.rule_id});
      if (!regra || regra.length === 0) return;

      const acaoRegra = regra[0];
      const acoesExecutadas = [];

      for (const acao of acaoRegra.acoes) {
        try {
          await this.executarAcao(acao, execution.target_entity_id, execution.target_entity_type);
          acoesExecutadas.push(`${acao.tipo}: sucesso`);
        } catch (error) {
          acoesExecutadas.push(`${acao.tipo}: erro - ${error.message}`);
        }
      }

      await AutomationExecution.update(execution.id, {
        status: "concluido",
        acoes_executadas: acoesExecutadas,
        resultado: {
          total_acoes: acaoRegra.acoes.length,
          sucessos: acoesExecutadas.filter(a => a.includes("sucesso")).length
        }
      });

      // Atualizar estatísticas da regra
      await AutomationRule.update(acaoRegra.id, {
        execucoes: (acaoRegra.execucoes || 0) + 1,
        ultima_execucao: new Date().toISOString()
      });

    } catch (error) {
      await AutomationExecution.update(execution.id, {
        status: "falhou",
        erro_detalhes: error.message
      });
    }
  }

  static async executarAcao(acao, targetId, targetType) {
    switch (acao.tipo) {
      case "enviar_whatsapp":
        await this.enviarWhatsAppAutomatico(targetId, acao.configuracao);
        break;
      case "criar_tarefa":
        await this.criarTarefaAutomatica(targetId, acao.configuracao);
        break;
      case "gerar_orcamento":
        await this.gerarOrcamentoAutomatico(targetId, acao.configuracao);
        break;
      case "agendar_followup":
        await this.agendarFollowupAutomatico(targetId, acao.configuracao);
        break;
      case "atualizar_status":
        await this.atualizarStatusAutomatico(targetId, targetType, acao.configuracao);
        break;
      case "notificar_vendedor":
        await this.notificarVendedorAutomatico(targetId, acao.configuracao);
        break;
    }
  }

  static async enviarWhatsAppAutomatico(clienteId, config) {
    const cliente = await Cliente.filter({id: clienteId});
    if (!cliente || cliente.length === 0) return;

    const mensagemPersonalizada = await this.personalizarMensagem(
      config.template, 
      cliente[0]
    );

    // Simular envio por enquanto
    console.log(`WhatsApp Automático para ${cliente[0].razao_social}: ${mensagemPersonalizada}`);
    
    // Registrar a interação
    await Interacao.create({
      cliente_id: clienteId,
      cliente_nome: cliente[0].razao_social,
      vendedor: "Sistema Automático",
      tipo_interacao: "whatsapp",
      data_interacao: new Date().toISOString(),
      resultado: "sucesso",
      observacoes: `Mensagem automática: ${mensagemPersonalizada}`,
      temperatura_cliente: "morno"
    });
  }

  static async personalizarMensagem(template, cliente) {
    const prompt = `
Personalize esta mensagem template para o cliente:

TEMPLATE: ${template}

DADOS DO CLIENTE:
- Nome: ${cliente.razao_social}
- Segmento: ${cliente.segmento}
- Status: ${cliente.status}
- Vendedor: ${cliente.vendedor_responsavel}

Mantenha o tom profissional mas amigável. Use o nome da empresa.
Retorne apenas a mensagem personalizada, sem explicações.
`;

    try {
      const resultado = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            mensagem_personalizada: {type: "string"}
          },
          required: ["mensagem_personalizada"]
        }
      });

      return resultado.mensagem_personalizada;
    } catch (error) {
      return template.replace(/\{[^}]+\}/g, cliente.razao_social);
    }
  }

  static async criarTarefaAutomatica(clienteId, config) {
    const cliente = await Cliente.filter({id: clienteId});
    if (!cliente || cliente.length === 0) return;

    const tarefa = `${config.tipo_tarefa}: ${cliente[0].razao_social} - ${config.descricao}`;
    
    // Simular criação de tarefa
    console.log(`Tarefa Criada: ${tarefa} para vendedor: ${cliente[0].vendedor_responsavel}`);
    
    return tarefa;
  }

  static async processarTodasAutomacoesPendentes() {
    try {
      const execucoesPendentes = await AutomationExecution.filter({
        status: "agendado"
      });

      for (const execucao of execucoesPendentes) {
        const agora = new Date();
        const agendadoPara = new Date(execucao.agendado_para);
        
        if (agora >= agendadoPara) {
          await this.executarAutomacao(execucao);
        }
      }
    } catch (error) {
      console.error("Erro ao processar automações pendentes:", error);
    }
  }

  static async recalcularTodosScores() {
    try {
      const clientes = await Cliente.list();
      
      for (const cliente of clientes) {
        await this.calcularScoreCliente(cliente.id);
        // Pequena pausa para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("Erro ao recalcular scores:", error);
    }
  }
}

export default MotorInteligencia;