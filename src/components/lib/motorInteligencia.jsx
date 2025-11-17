/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MOTOR DE INTELIGÊNCIA UNIFICADO V2                         ║
 * ║  Com Eventos Ricos e Processamento Contextualizado         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import eventBus, { EVENTOS } from './eventBus';
import { Cliente } from '@/entities/Cliente';
import { ClienteScore } from '@/entities/ClienteScore';
import { TarefaInteligente } from '@/entities/TarefaInteligente';
import { Orcamento } from '@/entities/Orcamento';
import { Venda } from '@/entities/Venda';
import { Interacao } from '@/entities/Interacao';

class MotorInteligenciaUnificado {
  constructor() {
    this.inicializado = false;
    this.configuracoes = {
      scoreClienteAutomatico: true,
      geracaoTarefasAutomatica: true,
      analiseInteligente: true
    };
  }

  /**
   * Inicializa o motor e registra todos os listeners
   */
  inicializar() {
    if (this.inicializado) return;

    console.log('🧠 [MotorInteligencia] Inicializando...');

    // Listeners para Clientes
    eventBus.on(EVENTOS.CLIENTE_CRIADO, this.handleClienteCriado.bind(this));
    eventBus.on(EVENTOS.CLIENTE_IMPORTADO, this.handleClienteImportado.bind(this));
    
    // Listeners para Orçamentos
    eventBus.on(EVENTOS.ORCAMENTO_CRIADO, this.handleOrcamentoCriado.bind(this));
    eventBus.on(EVENTOS.ORCAMENTO_STATUS_MUDOU, this.handleOrcamentoStatusMudou.bind(this));
    
    // Listeners para Interações
    eventBus.on(EVENTOS.INTERACAO_CRIADA, this.handleInteracaoCriada.bind(this));
    eventBus.on(EVENTOS.MENSAGEM_WHATSAPP_RECEBIDA, this.handleMensagemWhatsApp.bind(this));
    
    // Listeners para Tarefas
    eventBus.on(EVENTOS.TAREFA_CONCLUIDA, this.handleTarefaConcluida.bind(this));

    // Listeners para Google Sheets
    eventBus.on(EVENTOS.SHEETS_DADOS_LIDOS, this.handleSheetsDadosLidos.bind(this));

    this.inicializado = true;
    console.log('✅ [MotorInteligencia] Inicializado com sucesso');
  }

  /**
   * Handler: Cliente criado
   */
  async handleClienteCriado(data) {
    console.log('🧠 [MotorInteligencia] Processando cliente criado:', data.cliente.razao_social);
    
    if (this.configuracoes.scoreClienteAutomatico) {
      await this.calcularScoreCliente(data.cliente.id);
    }
  }

  /**
   * Handler: Cliente importado (EVENTO RICO)
   */
  async handleClienteImportado(data) {
    const { cliente, origem, contexto } = data;
    
    console.log('🧠 [MotorInteligencia] Processando cliente importado:', {
      cliente: cliente.razao_social,
      origem,
      contexto
    });
    
    // Calcula score inicial
    await this.calcularScoreCliente(cliente.id);
    
    // Gera tarefa de follow-up se for cliente novo
    if (this.configuracoes.geracaoTarefasAutomatica) {
      // Prioridade baseada no contexto
      const prioridadeExtra = contexto?.prioridade_sugerida === 'alta' ? 'alta' : 'media';
      
      await this.gerarTarefaFollowUpClienteNovo(cliente, {
        origem,
        planilha_nome: contexto?.planilha_nome,
        prioridade: prioridadeExtra
      });
    }
  }

  /**
   * Handler: Dados lidos do Google Sheets
   */
  async handleSheetsDadosLidos(data) {
    const { config, dados, total_linhas } = data;
    
    console.log(`🧠 [MotorInteligencia] Processando dados do Sheets: ${total_linhas} linhas`);
    
    // Aqui você pode adicionar lógica adicional de análise dos dados
    // antes mesmo de importá-los para as entidades
  }

  /**
   * Handler: Orçamento criado
   */
  async handleOrcamentoCriado(data) {
    console.log('🧠 [MotorInteligencia] Processando orçamento criado:', data.orcamento.numero_orcamento);
    
    // Atualiza score do cliente
    if (data.orcamento.cliente_id) {
      await this.calcularScoreCliente(data.orcamento.cliente_id);
    }
    
    // Gera tarefas de follow-up
    if (this.configuracoes.geracaoTarefasAutomatica) {
      await this.gerarTarefasOrcamento(data.orcamento);
    }
  }

  /**
   * Handler: Status do orçamento mudou
   */
  async handleOrcamentoStatusMudou(data) {
    console.log('🧠 [MotorInteligencia] Status do orçamento mudou:', 
      data.orcamento.numero_orcamento, 
      data.statusAnterior, 
      '->',
data.statusNovo
    );
    
    // Atualiza score
    if (data.orcamento.cliente_id) {
      await this.calcularScoreCliente(data.orcamento.cliente_id);
    }
    
    // Lógica específica por status
    if (data.statusNovo === 'enviado' && this.configuracoes.geracaoTarefasAutomatica) {
      await this.gerarTarefaFollowUpOrcamento(data.orcamento, 3); // Follow-up em 3 dias
    }
  }

  /**
   * Handler: Interação criada
   */
  async handleInteracaoCriada(data) {
    console.log('🧠 [MotorInteligencia] Processando interação:', data.interacao.tipo_interacao);
    
    // Atualiza score do cliente
    if (data.interacao.cliente_id) {
      await this.calcularScoreCliente(data.interacao.cliente_id);
    }
  }

  /**
   * Handler: Mensagem WhatsApp recebida
   */
  async handleMensagemWhatsApp(data) {
    console.log('🧠 [MotorInteligencia] Analisando mensagem WhatsApp');
    
    if (this.configuracoes.analiseInteligente) {
      await this.analisarSentimentoMensagem(data.mensagem);
    }
  }

  /**
   * Handler: Tarefa concluída (feedback loop)
   */
  async handleTarefaConcluida(data) {
    console.log('🧠 [MotorInteligencia] Processando feedback de tarefa concluída');
    
    // Atualiza score baseado no resultado
    if (data.tarefa.cliente_id) {
      await this.calcularScoreCliente(data.tarefa.cliente_id);
    }
    
    // Aprende com o resultado (futuro: MLOps)
    await this.registrarAprendizado(data.tarefa);
  }

  /**
   * Calcula o score de um cliente
   */
  async calcularScoreCliente(clienteId) {
    try {
      console.log(`📊 [MotorInteligencia] Calculando score para cliente ${clienteId}`);
      
      const [cliente, interacoes, orcamentos, vendas] = await Promise.all([
        Cliente.get(clienteId),
        Interacao.filter({ cliente_id: clienteId }),
        Orcamento.filter({ cliente_id: clienteId }),
        Venda.filter({ cliente_id: clienteId })
      ]);

      // Score de Engagement (0-100)
      const diasUltimoContato = cliente.ultimo_contato ? 
        Math.floor((new Date() - new Date(cliente.ultimo_contato)) / (1000 * 60 * 60 * 24)) : 999;
      const scoreEngagement = Math.max(0, 100 - (diasUltimoContato * 2));

      // Score de Potencial de Compra (0-100)
      const totalOrcamentos = orcamentos.length;
      const orcamentosAbertos = orcamentos.filter(o => 
        ['enviado', 'negociando', 'liberado'].includes(o.status)
      ).length;
      const scorePotencial = Math.min(100, (totalOrcamentos * 10) + (orcamentosAbertos * 20));

      // Score de Urgência (0-100)
      const temOrcamentoVencendo = orcamentos.some(o => {
        if (!o.data_vencimento) return false;
        const diasAteVencer = Math.floor((new Date(o.data_vencimento) - new Date()) / (1000 * 60 * 60 * 24));
        return diasAteVencer >= 0 && diasAteVencer <= 7;
      });
      const scoreUrgencia = temOrcamentoVencendo ? 90 : Math.max(0, 100 - (diasUltimoContato * 3));

      // Score de Valor (0-100)
      const valorRecorrente = cliente.valor_recorrente_mensal || 0;
      const scoreValor = Math.min(100, (valorRecorrente / 10000) * 100);

      // Score Total (0-1000)
      const scoreTotal = scoreEngagement + scorePotencial + scoreUrgencia + scoreValor;

      // Classificação de Risco
      let riscoChurn = 'baixo';
      if (diasUltimoContato > 60) riscoChurn = 'critico';
      else if (diasUltimoContato > 30) riscoChurn = 'alto';
      else if (diasUltimoContato > 15) riscoChurn = 'medio';

      // Salva ou atualiza o score
      const scoresExistentes = await ClienteScore.filter({ cliente_id: clienteId });
      
      const dadosScore = {
        cliente_id: clienteId,
        cliente_nome: cliente.razao_social,
        score_total: scoreTotal,
        score_engagement: scoreEngagement,
        score_potencial_compra: scorePotencial,
        score_urgencia: scoreUrgencia,
        score_valor_cliente: scoreValor,
        risco_churn: riscoChurn,
        canal_preferido: this.determinarCanalPreferido(interacoes),
        motivo_score: `Score calculado baseado em ${interacoes.length} interações, ${orcamentos.length} orçamentos e ${vendas.length} vendas`,
        data_calculo: new Date().toISOString()
      };

      if (scoresExistentes.length > 0) {
        await ClienteScore.update(scoresExistentes[0].id, dadosScore);
      } else {
        await ClienteScore.create(dadosScore);
      }

      // Emite evento de score atualizado
      await eventBus.emit(EVENTOS.SCORE_ATUALIZADO, { clienteId, score: dadosScore });

      console.log(`✅ [MotorInteligencia] Score calculado: ${scoreTotal} (Cliente: ${cliente.razao_social})`);
      
    } catch (error) {
      console.error('❌ [MotorInteligencia] Erro ao calcular score:', error);
    }
  }

  /**
   * Gera tarefa de follow-up para cliente novo
   */
  async gerarTarefaFollowUpClienteNovo(cliente, contexto = {}) {
    try {
      const tarefaExistente = await TarefaInteligente.filter({
        cliente_id: cliente.id,
        status: 'pendente'
      });

      if (tarefaExistente.length > 0) {
        console.log('⚠️ [MotorInteligencia] Cliente já possui tarefa pendente');
        return;
      }

      const dataPrazo = new Date();
      dataPrazo.setDate(dataPrazo.getDate() + 2); // 2 dias

      const contextInfo = contexto.planilha_nome ? 
        ` (Importado de: ${contexto.planilha_nome})` : '';

      await TarefaInteligente.create({
        titulo: `Primeiro contato: ${cliente.razao_social}${contextInfo}`,
        descricao: `Cliente recém-cadastrado. Realizar primeiro contato para apresentação e qualificação.`,
        tipo_tarefa: 'ligacao_urgente',
        prioridade: contexto.prioridade || 'alta',
        cliente_id: cliente.id,
        cliente_nome: cliente.razao_social,
        vendedor_responsavel: cliente.vendedor_responsavel,
        data_prazo: dataPrazo.toISOString(),
        status: 'pendente',
        contexto_ia: {
          motivo_criacao: `Cliente novo ${contexto.origem ? `via ${contexto.origem}` : 'no sistema'}`,
          sugestoes_abordagem: [
            'Apresentar empresa e produtos',
            'Entender necessidades atuais',
            'Qualificar potencial de compra'
          ],
          origem_importacao: contexto.origem,
          planilha_origem: contexto.planilha_nome
        }
      });

      console.log(`✅ [MotorInteligencia] Tarefa criada para cliente novo: ${cliente.razao_social}`);
    } catch (error) {
      console.error('❌ [MotorInteligencia] Erro ao gerar tarefa:', error);
    }
  }

  /**
   * Gera tarefas de follow-up para orçamento
   */
  async gerarTarefasOrcamento(orcamento) {
    try {
      const dataPrazo = new Date();
      dataPrazo.setDate(dataPrazo.getDate() + 3);

      await TarefaInteligente.create({
        titulo: `Follow-up: Orçamento ${orcamento.numero_orcamento}`,
        descricao: `Acompanhar orçamento enviado para ${orcamento.cliente_nome}`,
        tipo_tarefa: 'follow_up_orcamento',
        prioridade: 'media',
        cliente_id: orcamento.cliente_id,
        cliente_nome: orcamento.cliente_nome,
        orcamento_id: orcamento.id,
        vendedor_responsavel: orcamento.vendedor,
        data_prazo: dataPrazo.toISOString(),
        status: 'pendente',
        contexto_ia: {
          motivo_criacao: 'Orçamento enviado - follow-up automático',
          sugestoes_abordagem: [
            'Confirmar recebimento',
            'Esclarecer dúvidas',
            'Negociar condições'
          ]
        }
      });

      console.log(`✅ [MotorInteligencia] Tarefa de follow-up criada para orçamento ${orcamento.numero_orcamento}`);
    } catch (error) {
      console.error('❌ [MotorInteligencia] Erro ao gerar tarefa de orçamento:', error);
    }
  }

  /**
   * Gera tarefa de follow-up para orçamento com delay
   */
  async gerarTarefaFollowUpOrcamento(orcamento, diasDelay = 3) {
    return this.gerarTarefasOrcamento(orcamento);
  }

  /**
   * Analisa sentimento de mensagem WhatsApp
   */
  async analisarSentimentoMensagem(mensagem) {
    try {
      // Implementação futura com InvokeLLM
      console.log('🧠 [MotorInteligencia] Análise de sentimento (placeholder)');
    } catch (error) {
      console.error('❌ [MotorInteligencia] Erro na análise de sentimento:', error);
    }
  }

  /**
   * Registra aprendizado baseado em feedback
   */
  async registrarAprendizado(tarefa) {
    try {
      // Implementação futura: salvar em AprendizadoIA
      console.log('📚 [MotorInteligencia] Registrando aprendizado (placeholder)');
    } catch (error) {
      console.error('❌ [MotorInteligencia] Erro ao registrar aprendizado:', error);
    }
  }

  /**
   * Determina canal preferido baseado em interações
   */
  determinarCanalPreferido(interacoes) {
    if (interacoes.length === 0) return 'whatsapp';
    
    const contagem = {};
    interacoes.forEach(i => {
      contagem[i.tipo_interacao] = (contagem[i.tipo_interacao] || 0) + 1;
    });
    
    return Object.keys(contagem).reduce((a, b) => contagem[a] > contagem[b] ? a : b);
  }
}

// Singleton
const motorInteligencia = new MotorInteligenciaUnificado();

export default motorInteligencia;