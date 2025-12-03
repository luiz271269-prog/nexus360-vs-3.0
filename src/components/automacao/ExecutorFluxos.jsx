
import { FlowTemplate } from "@/entities/FlowTemplate";
import { FlowExecution } from "@/entities/FlowExecution";
import { Contact } from "@/entities/Contact";
import { Cliente } from "@/entities/Cliente";
import { Orcamento } from "@/entities/Orcamento";
import { TarefaInteligente } from "@/entities/TarefaInteligente";
import { MessageThread } from "@/entities/MessageThread";
import { Message } from "@/entities/Message";
import { SubFlowTemplate } from "@/entities/SubFlowTemplate";
import { InvokeLLM } from "@/integrations/Core";

/**
 * ExecutorFluxos - Motor de Execução de Automações
 * Executa fluxos criados no FlowBuilder
 */
export class ExecutorFluxos {
  
  /**
   * Inicia execução de um fluxo
   */
  static async iniciarFluxo(flowTemplateId, contactId, contexto = {}) {
    try {
      console.log(`🚀 [Executor] Iniciando fluxo ${flowTemplateId} para contato ${contactId}`);
      
      // Buscar template do fluxo
      const flowTemplate = await FlowTemplate.get(flowTemplateId);
      
      if (!flowTemplate || !flowTemplate.ativo) {
        throw new Error("Fluxo não encontrado ou inativo");
      }
      
      // Criar execução
      const execution = await FlowExecution.create({
        flow_template_id: flowTemplateId,
        contact_id: contactId,
        status: 'ativo',
        current_step: 0,
        started_at: new Date().toISOString(),
        execution_history: [],
        variables: {
          ...contexto,
          data_inicio: new Date().toISOString()
        }
      });
      
      console.log(`✅ [Executor] Execução criada: ${execution.id}`);
      
      // Executar primeiro passo
      await this.executarProximoPasso(execution.id);
      
      return execution;
      
    } catch (error) {
      console.error("❌ [Executor] Erro ao iniciar fluxo:", error);
      throw error;
    }
  }

  /**
   * Executa o próximo passo do fluxo
   */
  static async executarProximoPasso(executionId) {
    let execution = null;
    
    try {
      execution = await FlowExecution.get(executionId);
      
      if (!execution || execution.status !== 'ativo') {
        console.log(`⏸️ [Executor] Execução ${executionId} não está ativa`);
        return;
      }
      
      const flowTemplate = await FlowTemplate.get(execution.flow_template_id);
      const steps = flowTemplate.steps || [];
      
      if (execution.current_step >= steps.length) {
        // Fluxo concluído
        await this.concluirFluxo(executionId);
        return;
      }
      
      const step = steps[execution.current_step];
      console.log(`⚙️ [Executor] Executando passo ${execution.current_step}: ${step.tipo}`);
      
      // Executar o passo
      const resultado = await this.executarPasso(step, execution);
      
      // Registrar no histórico
      const history = execution.execution_history || [];
      history.push({
        step_index: execution.current_step,
        step_type: step.tipo,
        executed_at: new Date().toISOString(),
        resultado,
        success: resultado.success !== false
      });
      
      // Determinar próxima ação
      let proximoPasso = execution.current_step + 1;
      let proximaExecucao = null;
      
      if (step.tipo === 'delay' || step.tipo === 'aguardar') {
        // Agendar próxima execução
        const delay = this.calcularDelay(step.config);
        proximaExecucao = new Date(Date.now() + delay).toISOString();
      }
      
      // Atualizar execução
      await FlowExecution.update(executionId, {
        current_step: proximoPasso,
        execution_history: history,
        next_action_at: proximaExecucao,
        variables: {
          ...execution.variables,
          ...resultado.variables
        }
      });
      
      // Se não há delay, executar próximo passo imediatamente
      if (!proximaExecucao && proximoPasso < steps.length) {
        await this.executarProximoPasso(executionId);
      }
      
    } catch (error) {
      console.error(`❌ [Executor] Erro ao executar passo:`, error);
      
      // Garantir que execution existe antes de usá-lo
      if (execution) {
        await FlowExecution.update(executionId, {
          status: 'erro',
          execution_history: [
            ...(execution.execution_history || []),
            {
              step_index: execution.current_step,
              executed_at: new Date().toISOString(),
              erro: error.message,
              success: false
            }
          ]
        });
      } else {
        // Se execution não existe, criar um log mínimo
        console.error(`❌ [Executor] Não foi possível carregar execução ${executionId}`);
      }
    }
  }

  /**
   * Executa um passo específico
   */
  static async executarPasso(step, execution) {
    const { tipo, config } = step;
    const contact = await Contact.get(execution.contact_id);
    
    switch (tipo) {
      case 'send_message':
      case 'enviar_whatsapp':
        return await this.executarEnviarMensagem(config, contact, execution);
      
      case 'enviar_email':
        return await this.executarEnviarEmail(config, contact, execution);
      
      case 'delay':
      case 'aguardar':
        return { success: true, aguardando: true };
      
      case 'criar_tarefa':
        return await this.executarCriarTarefa(config, contact, execution);
      
      case 'atualizar_cliente':
        return await this.executarAtualizarCliente(config, contact, execution);
      
      case 'criar_orcamento':
        return await this.executarCriarOrcamento(config, contact, execution);
      
      case 'condition':
      case 'condicional':
        return await this.executarCondicional(config, execution);
      
      case 'chamar_subfluxo':
      case 'executar_subfluxo':
        return await this.executarSubFluxo(config, contact, execution);
      
      case 'ai_response':
        return await this.executarRespostaIA(config, contact, execution);
      
      default:
        console.warn(`⚠️ [Executor] Tipo de passo desconhecido: ${tipo}`);
        return { success: false, erro: 'Tipo de passo não implementado' };
    }
  }

  /**
   * Envia mensagem WhatsApp
   */
  static async executarEnviarMensagem(config, contact, execution) {
    try {
      const mensagem = this.interpolarVariaveis(config.mensagem, execution.variables, contact);
      
      // Buscar thread ativa do contato
      const threads = await MessageThread.filter({ contact_id: contact.id, status: 'aberta' });
      const thread = threads[0];
      
      if (!thread) {
        throw new Error("Thread não encontrada para o contato");
      }
      
      // Criar mensagem
      await Message.create({
        thread_id: thread.id,
        sender_type: 'user',
        sender_id: execution.variables.user_id || 'sistema',
        recipient_type: 'contact',
        recipient_id: contact.id,
        content: mensagem,
        channel: 'whatsapp',
        status: 'enviada'
      });
      
      return {
        success: true,
        mensagem_enviada: mensagem
      };
      
    } catch (error) {
      console.error("❌ [Executor] Erro ao enviar mensagem:", error);
      return {
        success: false,
        erro: error.message
      };
    }
  }

  /**
   * Cria tarefa inteligente
   */
  static async executarCriarTarefa(config, contact, execution) {
    try {
      // Buscar cliente associado
      const clientes = await Cliente.filter({ razao_social: contact.empresa });
      const cliente = clientes[0];
      
      if (!cliente) {
        throw new Error("Cliente não encontrado");
      }
      
      const titulo = this.interpolarVariaveis(config.titulo, execution.variables, contact);
      const descricao = this.interpolarVariaveis(config.descricao || '', execution.variables, contact);
      
      const tarefa = await TarefaInteligente.create({
        titulo,
        descricao,
        tipo_tarefa: config.tipo_tarefa || 'follow_up_orcamento',
        prioridade: config.prioridade || 'media',
        cliente_id: cliente.id,
        cliente_nome: cliente.razao_social,
        vendedor_responsavel: contact.vendedor_responsavel || 'Sistema',
        data_prazo: config.data_prazo || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'pendente'
      });
      
      return {
        success: true,
        tarefa_id: tarefa.id,
        variables: {
          ultima_tarefa_criada: tarefa.id
        }
      };
      
    } catch (error) {
      console.error("❌ [Executor] Erro ao criar tarefa:", error);
      return {
        success: false,
        erro: error.message
      };
    }
  }

  /**
   * Executa sub-fluxo
   */
  static async executarSubFluxo(config, contact, execution) {
    try {
      const subFlow = await SubFlowTemplate.get(config.subfluxo_id);
      
      if (!subFlow || !subFlow.ativo) {
        throw new Error("Sub-fluxo não encontrado ou inativo");
      }
      
      console.log(`📦 [Executor] Executando sub-fluxo: ${subFlow.nome}`);
      
      // Executar cada passo do sub-fluxo
      const resultados = [];
      for (const step of subFlow.steps) {
        const resultado = await this.executarPasso(step, execution);
        resultados.push(resultado);
        
        if (!resultado.success) {
          break;
        }
      }
      
      return {
        success: resultados.every(r => r.success),
        subfluxo_executado: subFlow.nome,
        resultados
      };
      
    } catch (error) {
      console.error("❌ [Executor] Erro ao executar sub-fluxo:", error);
      return {
        success: false,
        erro: error.message
      };
    }
  }

  /**
   * Executa resposta com IA
   */
  static async executarRespostaIA(config, contact, execution) {
    try {
      const contexto = this.interpolarVariaveis(
        config.contexto || 'Responda ao cliente de forma profissional',
        execution.variables,
        contact
      );
      
      const resposta = await InvokeLLM({
        prompt: `${contexto}\n\nCliente: ${contact.nome}\nEmpresa: ${contact.empresa || 'N/A'}\n\nGere uma resposta apropriada.`,
        add_context_from_internet: false
      });
      
      return {
        success: true,
        resposta_ia: resposta,
        variables: {
          ultima_resposta_ia: resposta
        }
      };
      
    } catch (error) {
      console.error("❌ [Executor] Erro na resposta IA:", error);
      return {
        success: false,
        erro: error.message
      };
    }
  }

  /**
   * Executa atualização de cliente
   */
  static async executarAtualizarCliente(config, contact, execution) {
    try {
      const clientes = await Cliente.filter({ razao_social: contact.empresa });
      const cliente = clientes[0];
      
      if (!cliente) {
        throw new Error("Cliente não encontrado");
      }
      
      await Cliente.update(cliente.id, config.campos);
      
      return {
        success: true,
        cliente_atualizado: cliente.id
      };
      
    } catch (error) {
      return {
        success: false,
        erro: error.message
      };
    }
  }

  /**
   * Executa criação de orçamento
   */
  static async executarCriarOrcamento(config, contact, execution) {
    try {
      const clientes = await Cliente.filter({ razao_social: contact.empresa });
      const cliente = clientes[0];
      
      if (!cliente) {
        throw new Error("Cliente não encontrado");
      }
      
      const orcamento = await Orcamento.create({
        cliente_nome: cliente.razao_social,
        vendedor: contact.vendedor_responsavel || 'Sistema',
        data_orcamento: new Date().toISOString().slice(0, 10),
        valor_total: config.valor_total || 0,
        status: 'rascunho',
        observacoes: `Criado automaticamente via fluxo ${execution.flow_template_id}`
      });
      
      return {
        success: true,
        orcamento_id: orcamento.id,
        variables: {
          ultimo_orcamento_criado: orcamento.id
        }
      };
      
    } catch (error) {
      return {
        success: false,
        erro: error.message
      };
    }
  }

  /**
   * Executa condicional
   */
  static async executarCondicional(config, execution) {
    try {
      const valor1 = this.resolverVariavel(config.campo, execution.variables);
      const valor2 = config.valor;
      const operador = config.operador;
      
      let resultado = false;
      
      switch (operador) {
        case '==':
        case 'igual':
          resultado = valor1 == valor2;
          break;
        case '!=':
        case 'diferente':
          resultado = valor1 != valor2;
          break;
        case '>':
        case 'maior':
          resultado = parseFloat(valor1) > parseFloat(valor2);
          break;
        case '<':
        case 'menor':
          resultado = parseFloat(valor1) < parseFloat(valor2);
          break;
        case 'contem':
          resultado = String(valor1).includes(String(valor2));
          break;
      }
      
      return {
        success: true,
        condicao_resultado: resultado,
        variables: {
          ultima_condicao: resultado
        }
      };
      
    } catch (error) {
      return {
        success: false,
        erro: error.message
      };
    }
  }

  /**
   * Envia email
   */
  static async executarEnviarEmail(config, contact, execution) {
    // Implementar integração de email
    return {
      success: true,
      email_enviado: true
    };
  }

  /**
   * Conclui execução do fluxo
   */
  static async concluirFluxo(executionId) {
    try {
      await FlowExecution.update(executionId, {
        status: 'concluido',
        completed_at: new Date().toISOString()
      });
      
      console.log(`✅ [Executor] Fluxo ${executionId} concluído`);
      
    } catch (error) {
      console.error("❌ [Executor] Erro ao concluir fluxo:", error);
    }
  }

  /**
   * Interpola variáveis em templates
   */
  static interpolarVariaveis(template, variables, contact) {
    if (!template) return '';
    
    let resultado = template;
    
    // Variáveis do contato
    resultado = resultado.replace(/\{\{nome\}\}/g, contact?.nome || 'Cliente');
    resultado = resultado.replace(/\{\{empresa\}\}/g, contact?.empresa || '');
    resultado = resultado.replace(/\{\{telefone\}\}/g, contact?.telefone || '');
    
    // Variáveis customizadas
    for (const [key, value] of Object.entries(variables || {})) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      resultado = resultado.replace(regex, String(value));
    }
    
    // Data/hora
    resultado = resultado.replace(/\{\{data_hoje\}\}/g, new Date().toLocaleDateString('pt-BR'));
    resultado = resultado.replace(/\{\{hora_agora\}\}/g, new Date().toLocaleTimeString('pt-BR'));
    
    return resultado;
  }

  /**
   * Resolve variável do contexto
   */
  static resolverVariavel(caminho, variables) {
    const partes = caminho.split('.');
    let valor = variables;
    
    for (const parte of partes) {
      valor = valor?.[parte];
    }
    
    return valor;
  }

  /**
   * Calcula delay em milissegundos
   */
  static calcularDelay(config) {
    const tempo = parseInt(config.tempo || config.duracao || 1);
    const unidade = config.unidade || 'minutos';
    
    switch (unidade) {
      case 'segundos':
        return tempo * 1000;
      case 'minutos':
        return tempo * 60 * 1000;
      case 'horas':
        return tempo * 60 * 60 * 1000;
      case 'dias':
        return tempo * 24 * 60 * 60 * 1000;
      default:
        return tempo * 60 * 1000; // Default: minutos
    }
  }
}

export default ExecutorFluxos;
