
import { Cliente } from "@/entities/Cliente";
import { Venda } from "@/entities/Venda";
import { Orcamento } from "@/entities/Orcamento";
import { Interacao } from "@/entities/Interacao";
import { ClienteScore } from "@/entities/ClienteScore";
import { TarefaInteligente } from "@/entities/TarefaInteligente";
import { AprendizadoIA } from "@/entities/AprendizadoIA";
import { PromptTemplate } from "@/entities/PromptTemplate";
import { EventoSistema } from "@/entities/EventoSistema";
import { InvokeLLM } from "@/integrations/Core";
import NexusEngineV3 from './NexusEngineV3'; // Added import for NexusEngineV3

/**
 * MotorInteligenciaV3 - Motor Cognitivo Completo com Aprendizado Contínuo
 * 
 * Arquitetura:
 * 1. Event-Driven: Reage a eventos do sistema (EventoSistema)
 * 2. Pattern Learning: Identifica e armazena padrões (AprendizadoIA)
 * 3. Template-Based: Usa PromptTemplate para otimização
 * 4. Batch Processing: Processa múltiplos clientes eficientemente
 * 5. Self-Improving: Melhora com base em resultados reais
 */
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MOTOR INTELIGÊNCIA V3 - INTEGRADO COM NKDB                ║
 * ║  Agora registra TUDO na Nexus Knowledge Base                ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export default class MotorInteligenciaV3 {
  
  /**
   * NÚCLEO 1: Processador de Eventos (Event Loop)
   * Monitora EventoSistema e dispara análises apropriadas
   */
  static async processarEventosPendentes() {
    console.log("🔄 [MotorIA] Iniciando processamento de eventos...");
    
    try {
      // Buscar eventos não processados
      const eventos = await EventoSistema.filter({
        processado: false
      }, '-timestamp', 100);
      
      if (eventos.length === 0) {
        console.log("✅ [MotorIA] Nenhum evento pendente");
        return { processados: 0, gerados: 0 };
      }
      
      console.log(`📊 [MotorIA] ${eventos.length} eventos pendentes`);
      
      let tarefasGeradas = 0;
      let scoresAtualizados = 0;
      
      for (const evento of eventos) {
        try {
          const resultado = await this.processarEvento(evento);
          tarefasGeradas += resultado.tarefasGeradas || 0;
          scoresAtualizados += resultado.scoresAtualizados || 0;
          
          // Marcar evento como processado
          await EventoSistema.update(evento.id, {
            processado: true,
            resultados_processamento: resultado
          });
          
        } catch (error) {
          console.error(`❌ [MotorIA] Erro ao processar evento ${evento.id}:`, error);
        }
      }
      
      console.log(`✅ [MotorIA] Processados: ${eventos.length} eventos, ${tarefasGeradas} tarefas, ${scoresAtualizados} scores`);
      
      return {
        processados: eventos.length,
        tarefasGeradas,
        scoresAtualizados
      };
      
    } catch (error) {
      console.error("❌ [MotorIA] Erro no processamento de eventos:", error);
      throw error;
    }
  }
  
  /**
   * Processar um evento específico
   */
  static async processarEvento(evento) {
    const { tipo_evento, entidade_tipo, entidade_id, dados_evento } = evento;
    
    let resultado = {
      tarefasGeradas: 0,
      scoresAtualizados: 0,
      acoes: []
    };
    
    switch (tipo_evento) {
      case 'mensagem_whatsapp_recebida':
        resultado = await this.processarMensagemWhatsApp(dados_evento);
        break;
        
      case 'orcamento_status_mudou':
        resultado = await this.processarMudancaOrcamento(entidade_id, dados_evento);
        break;
        
      case 'interacao_criada':
        resultado = await this.processarNovaInteracao(entidade_id, dados_evento);
        break;
        
      case 'tarefa_concluida':
        resultado = await this.processarTarefaConcluida(entidade_id, dados_evento);
        break;
        
      case 'venda_criada':
        resultado = await this.processarNovaVenda(entidade_id, dados_evento);
        break;
        
      default:
        console.log(`⚠️ [MotorIA] Tipo de evento não tratado: ${tipo_evento}`);
    }
    
    return resultado;
  }
  
  /**
   * NÚCLEO 2: Análise Completa de Cliente (Batch-Optimized)
   */
  static async analisarClientesEmLote(clienteIds = null) {
    console.log("🧠 [MotorIA] Iniciando análise em lote...");
    
    try {
      // Se não especificado, analisar todos os clientes ativos
      let clientes;
      if (clienteIds) {
        clientes = await Promise.all(
          clienteIds.map(id => Cliente.get(id))
        );
      } else {
        clientes = await Cliente.filter({ status: "Ativo" });
      }
      
      console.log(`📊 [MotorIA] Analisando ${clientes.length} clientes...`);
      
      // Carregar TODOS os dados relacionados em uma única operação
      const [todasVendas, todosOrcamentos, todasInteracoes] = await Promise.all([
        Venda.list('-data_venda', 5000),
        Orcamento.list('-data_orcamento', 5000),
        Interacao.list('-data_interacao', 5000)
      ]);
      
      // Organizar por cliente
      const dadosPorCliente = {};
      clientes.forEach(c => {
        dadosPorCliente[c.id] = {
          cliente: c,
          vendas: todasVendas.filter(v => v.cliente_nome === c.razao_social),
          orcamentos: todosOrcamentos.filter(o => o.cliente_nome === c.razao_social),
          interacoes: todasInteracoes.filter(i => i.cliente_nome === c.razao_social)
        };
      });
      
      // Processar em paralelo (but limited to avoid API overload)
      const BATCH_SIZE = 5;
      const resultados = [];
      
      for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(cliente => 
          this.analisarClienteIndividual(dadosPorCliente[cliente.id])
        );
        
        const batchResultados = await Promise.all(batchPromises);
        resultados.push(...batchResultados);
        
        // Small delay between batches
        if (i + BATCH_SIZE < clientes.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`✅ [MotorIA] Análise em lote concluída: ${resultados.length} clientes`);
      return resultados;
      
    } catch (error) {
      console.error("❌ [MotorIA] Erro na análise em lote:", error);
      throw error;
    }
  }
  
  /**
   * Análise individual - AGORA REGISTRA INSIGHTS NA NKDB
   */
  static async analisarClienteIndividual(dados) {
    const { cliente, vendas, orcamentos, interacoes } = dados;
    
    try {
      // Buscar template de prompt otimizado
      const templates = await PromptTemplate.filter({
        categoria: "analise_cliente",
        ativo: true
      }, '-metricas_performance.taxa_sucesso', 1);
      
      const template = templates[0];
      
      if (!template) {
        console.warn("⚠️ [MotorIA] Nenhum PromptTemplate encontrado, usando default");
        return await this.analisarClienteDefault(cliente, vendas, orcamentos, interacoes);
      }
      
      // Preencher template com dados
      const prompt = this.preencherTemplate(template.template_texto, {
        cliente_nome: cliente.razao_social,
        total_vendas: vendas.length,
        valor_total_vendas: vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0),
        orcamentos_abertos: orcamentos.filter(o => !['aprovado', 'rejeitado', 'vencido'].includes(o.status)).length,
        ultima_interacao: interacoes[0]?.data_interacao || 'Nenhuma',
        tipo_cliente: cliente.segmento || 'PME',
        historico_interacoes: JSON.stringify(interacoes.slice(0, 5))
      });
      
      // Invocar LLM
      const analise = await InvokeLLM({
        prompt,
        response_json_schema: template.schema_resposta,
        ...template.parametros_llm
      });
      
      // ═══════════════════════════════════════════════════════════
      // 🆕 REGISTRAR ANÁLISE NA NKDB
      // ═══════════════════════════════════════════════════════════
      await NexusEngineV3.registrarConhecimento({
        titulo: `Análise de Cliente: ${cliente.razao_social}`,
        tipo_registro: 'insight_cliente',
        categoria: 'inteligencia',
        conteudo: JSON.stringify(analise, null, 2),
        conteudo_estruturado: analise,
        entidade_origem: 'Cliente',
        id_entidade_origem: cliente.id,
        relevancia_score: analise.score_total || 50,
        confianca_ia: 85,
        tags: ['analise', 'score', cliente.segmento || 'PME'],
        origem_ia: {
          motor_gerador: 'MotorInteligenciaV3',
          timestamp_geracao: new Date().toISOString(),
          prompt_usado: prompt.substring(0, 200) + '...',
          modelo_llm: 'gpt-4o-mini'
        }
      });
      
      // Criar ou atualizar ClienteScore
      const scoreExistente = await ClienteScore.filter({ cliente_id: cliente.id }, null, 1);
      
      const scoreData = {
        cliente_id: cliente.id,
        cliente_nome: cliente.razao_social,
        score_total: this.calcularScoreTotal(analise),
        score_engagement: analise.score_engagement || 50,
        score_potencial_compra: analise.score_potencial_compra || 50,
        score_urgencia: analise.score_urgencia || 50,
        score_valor_cliente: analise.score_valor_cliente || 50,
        score_satisfacao: analise.score_satisfacao || 50,
        risco_churn: analise.risco_churn || 'medio',
        probabilidade_compra_30dias: analise.probabilidade_compra_30dias || 30,
        sentimento_geral: analise.sentimento_geral || 'neutro',
        proxima_melhor_acao: analise.proxima_melhor_acao || 'Ligar para o cliente',
        canal_preferido: analise.canal_preferido || 'telefone',
        melhor_horario_contato: analise.melhor_horario_contato || '14h-16h',
        perfil_compra: analise.perfil_compra || 'planejado',
        motivo_score: analise.motivo_score || '',
        insights_comportamentais: analise.insights_comportamentais || [],
        oportunidades_upsell: analise.oportunidades_upsell || [],
        alertas_ativos: this.gerarAlertas(analise, cliente, orcamentos, interacoes),
        data_calculo: new Date().toISOString()
      };
      
      if (scoreExistente.length > 0) {
        await ClienteScore.update(scoreExistente[0].id, scoreData);
      } else {
        await ClienteScore.create(scoreData);
      }
      
      // Registrar aprendizado se descobriu algo novo
      await this.registrarAprendizado(analise, cliente, dados);
      
      return {
        cliente_id: cliente.id,
        score: scoreData.score_total,
        analise
      };
      
    } catch (error) {
      console.error(`❌ [MotorIA] Erro ao analisar cliente ${cliente.razao_social}:`, error);
      return null;
    }
  }
  
  /**
   * NÚCLEO 3: Geração Inteligente de Tarefas
   */
  static async gerarTarefasUrgentes(opcoes = {}) {
    console.log("🎯 [MotorIA] Gerando tarefas urgentes...");
    
    try {
      // Buscar clientes com alto score de urgência ou risco
      const scores = await ClienteScore.list('-score_urgencia', 50);
      const clientesUrgentes = scores.filter(s => 
        s.score_urgencia >= 70 || 
        s.risco_churn === 'alto' || 
        s.risco_churn === 'critico'
      );
      
      console.log(`📊 [MotorIA] ${clientesUrgentes.length} clientes urgentes identificados`);
      
      let tarefasCriadas = 0;
      
      for (const score of clientesUrgentes) {
        // Verificar se já existe tarefa pendente para este cliente
        const tarefasExistentes = await TarefaInteligente.filter({
          cliente_id: score.cliente_id,
          status: 'pendente'
        });
        
        if (tarefasExistentes.length > 0) {
          console.log(`⏭️ [MotorIA] Cliente ${score.cliente_nome} já tem tarefa pendente`);
          continue;
        }
        
        // Gerar tarefa com base na próxima melhor ação
        const tarefa = await this.criarTarefaInteligente({
          cliente_id: score.cliente_id,
          cliente_nome: score.cliente_nome,
          score: score,
          tipo_sugerido: this.inferirTipoTarefa(score),
          prioridade: this.calcularPrioridade(score)
        });
        
        if (tarefa) {
          tarefasCriadas++;
        }
      }
      
      console.log(`✅ [MotorIA] ${tarefasCriadas} tarefas urgentes geradas`);
      return tarefasCriadas;
      
    } catch (error) {
      console.error("❌ [MotorIA] Erro ao gerar tarefas:", error);
      throw error;
    }
  }
  
  /**
   * Criar tarefa inteligente - AGORA REGISTRA NA NKDB
   */
  static async criarTarefaInteligente(params) {
    const { cliente_id, cliente_nome, score, tipo_sugerido, prioridade } = params;
    
    try {
      // Buscar cliente e dados relacionados
      const [cliente, orcamentos, interacoes] = await Promise.all([
        Cliente.get(cliente_id),
        Orcamento.filter({ cliente_nome }, '-data_orcamento', 5),
        Interacao.filter({ cliente_nome }, '-data_interacao', 10)
      ]);
      
      // Gerar contexto da IA
      const contextoIA = await this.gerarContextoTarefa({
        cliente,
        score,
        orcamentos,
        interacoes,
        tipo_tarefa: tipo_sugerido
      });
      
      // Calcular prazo baseado na urgência
      const prazo = this.calcularPrazo(score.score_urgencia);
      
      const tarefa = await TarefaInteligente.create({
        titulo: contextoIA.titulo,
        descricao: contextoIA.descricao,
        tipo_tarefa: tipo_sugerido,
        prioridade: prioridade,
        cliente_id: cliente_id,
        cliente_nome: cliente_nome,
        orcamento_id: orcamentos[0]?.id || null,
        vendedor_responsavel: cliente.vendedor_responsavel,
        data_prazo: prazo,
        status: 'pendente',
        contexto_ia: contextoIA,
        metricas: {
          score_urgencia: score.score_urgencia,
          probabilidade_fechamento: score.probabilidade_compra_30dias || 50,
          valor_potencial: this.estimarValorPotencial(cliente, orcamentos)
        }
      });
      
      // ═══════════════════════════════════════════════════════════
      // 🆕 REGISTRAR CRIAÇÃO DE TAREFA NA NKDB
      // ═══════════════════════════════════════════════════════════
      await NexusEngineV3.registrarConhecimento({
        titulo: `Tarefa Gerada: ${contextoIA.titulo}`,
        tipo_registro: 'resultado_acao',
        categoria: 'estrategia',
        conteudo: `Tarefa criada para ${cliente_nome}: ${contextoIA.descricao}`,
        conteudo_estruturado: {
          tarefa_id: tarefa.id,
          tipo_tarefa: tipo_sugerido,
          prioridade: prioridade,
          score_urgencia: score.score_urgencia,
          contexto: contextoIA
        },
        entidade_origem: 'TarefaInteligente',
        id_entidade_origem: tarefa.id,
        relevancia_score: score.score_urgencia || 50,
        confianca_ia: 80,
        tags: ['tarefa', tipo_sugerido, prioridade],
        origem_ia: {
          motor_gerador: 'MotorInteligenciaV3',
          timestamp_geracao: new Date().toISOString()
        }
      });
      
      console.log(`✅ [MotorIA] Tarefa criada: ${tarefa.titulo}`);
      return tarefa;
      
    } catch (error) {
      console.error(`❌ [MotorIA] Erro ao criar tarefa para ${cliente_nome}:`, error);
      return null;
    }
  }
  
  /**
   * NÚCLEO 4: Processamento de Feedback (Aprendizado)
   */
  static async processarFeedbackTarefa(tarefaId, observacoes, resultado) {
    console.log(`🔄 [MotorIA] Processando feedback da tarefa ${tarefaId}...`);
    
    try {
      const tarefa = await TarefaInteligente.get(tarefaId);
      if (!tarefa) {
        throw new Error("Tarefa não encontrada");
      }
      
      // Extrair insights das observações usando NLP
      const insights = await InvokeLLM({
        prompt: `Analise estas observações de um vendedor após uma interação com cliente:

"${observacoes}"

Resultado da ação: ${resultado}

Extraia:
1. Sentimento demonstrado pelo cliente
2. Objeções mencionadas
3. Interesses demonstrados
4. Concorrentes mencionados
5. Próximos passos sugeridos
6. Tags relevantes

Seja objetivo e preciso.`,
        response_json_schema: {
          type: "object",
          properties: {
            sentimento: { type: "string", enum: ["muito_negativo", "negativo", "neutro", "positivo", "muito_positivo"] },
            objecoes: { type: "array", items: { type: "string" } },
            interesses: { type: "array", items: { type: "string" } },
            concorrentes: { type: "array", items: { type: "string" } },
            proximos_passos: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            probabilidade_fechamento: { type: "number", description: "0-100" }
          }
        }
      });
      
      // Atualizar tarefa
      await TarefaInteligente.update(tarefaId, {
        status: 'concluida',
        resultado_execucao: {
          sucesso: resultado !== 'sem_contato' && resultado !== 'nao_interessado',
          observacoes: observacoes,
          resultado: resultado,
          insights: insights,
          data_execucao: new Date().toISOString()
        }
      });
      
      // ═══════════════════════════════════════════════════════════
      // 🆕 REGISTRAR FEEDBACK NA NKDB
      // ═══════════════════════════════════════════════════════════
      await NexusEngineV3.registrarConhecimento({
        titulo: `Feedback de Tarefa: ${tarefa.titulo}`,
        tipo_registro: 'feedback_vendedor',
        categoria: 'inteligencia',
        conteudo: observacoes,
        conteudo_estruturado: {
          tarefa_id: tarefaId,
          resultado: resultado,
          insights: insights,
          observacoes: observacoes
        },
        entidade_origem: 'TarefaInteligente',
        id_entidade_origem: tarefaId,
        relevancia_score: resultado === 'venda_fechada' ? 100 : 50,
        confianca_ia: 90,
        tags: ['feedback', resultado, ...(insights.tags || [])], // Ensure tags is an array
        origem_ia: {
          motor_gerador: 'MotorInteligenciaV3',
          modelo_llm: 'gpt-4o-mini'
        }
      });
      
      // Registrar padrão de sucesso/falha no NexusEngineV3
      const sucesso = resultado !== 'sem_contato' && resultado !== 'nao_interessado';
      await NexusEngineV3.registrarFeedback(tarefaId, sucesso, {
        resultado,
        insights,
        observacoes
      });
      
      // Atualizar score do cliente com base no feedback
      const scores = await ClienteScore.filter({ cliente_id: tarefa.cliente_id }, null, 1);
      if (scores.length > 0) {
        const scoreAtual = scores[0];
        const novoScore = await this.recalcularScoreComFeedback(
          scoreAtual,
          insights,
          resultado
        );
        await ClienteScore.update(scoreAtual.id, novoScore);
      }
      
      // Registrar padrão de aprendizado
      await this.registrarPadraoTarefa(tarefa, insights, resultado);
      
      // Gerar tarefa de follow-up se necessário
      if (insights.proximos_passos && resultado === 'interessado') {
        await this.gerarTarefaFollowUp(tarefa, insights);
      }
      
      console.log(`✅ [MotorIA] Feedback processado e aprendizado registrado`);
      return { success: true, insights };
      
    } catch (error) {
      console.error("❌ [MotorIA] Erro ao processar feedback:", error);
      throw error;
    }
  }
  
  /**
   * NÚCLEO 5: Sistema de Aprendizado de Padrões
   */
  static async registrarAprendizado(analise, cliente, dados) {
    try {
      // Identificar padrões interessantes
      const padroes = [];
      
      // Padrão 1: Cliente com alto engagement mas sem compras recentes
      if (analise.score_engagement > 70 && dados.vendas.length === 0) {
        padroes.push({
          tipo: 'padrao_cliente',
          descricao: 'Alto engagement sem conversão',
          contexto: { segmento: cliente.segmento },
          acao_sugerida: 'Oferecer trial ou demonstração'
        });
      }
      
      // Padrão 2: Horário preferencial de resposta
      if (dados.interacoes.length >= 5) {
        const horarios = dados.interacoes.map(i => {
          const d = new Date(i.data_interacao);
          return d.getHours();
        });
        const horarioMaisComum = this.moda(horarios);
        
        if (horarioMaisComum !== null) { // Check for null as moda might return null
          padroes.push({
            tipo: 'timing_contato',
            descricao: `Cliente responde melhor às ${horarioMaisComum}h`,
            contexto: { cliente_id: cliente.id, horario_otimo: horarioMaisComum } // Added horario_otimo to context
          });
        }
      }
      
      // Salvar padrões descobertos
      for (const padrao of padroes) {
        await AprendizadoIA.create({
          tipo_aprendizado: padrao.tipo,
          contexto: padrao.contexto,
          padrao_identificado: {
            descricao: padrao.descricao,
            confianca: 75,
            exemplos: [{ cliente_id: cliente.id, analise_resumo: analise.motivo_score }]
          },
          ativo: true,
          data_descoberta: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error("❌ [MotorIA] Erro ao registrar aprendizado:", error);
    }
  }
  
  /**
   * Aplicar aprendizados acumulados a uma nova análise
   */
  static async aplicarAprendizadosAcumulados(cliente, analise) {
    try {
      const aprendizados = await AprendizadoIA.filter({
        ativo: true
      });
      
      // Filtrar aprendizados aplicáveis
      const aplicaveis = aprendizados.filter(a => {
        if (a.contexto?.segmentos_aplicaveis) { // Changed from aplicabilidade to contexto
          return a.contexto.segmentos_aplicaveis.includes(cliente.segmento);
        }
        return true;
      });
      
      // Ajustar análise com base nos aprendizados
      for (const aprendizado of aplicaveis) {
        if (aprendizado.tipo_aprendizado === 'timing_contato') {
          // Sobrescrever melhor horário com o aprendido
          if (aprendizado.contexto?.horario_otimo) { // Changed from padrao_identificado to contexto
            analise.melhor_horario_contato = `${aprendizado.contexto.horario_otimo}h-${aprendizado.contexto.horario_otimo + 2}h`; // Adjusted to match format
          }
        }
        
        if (aprendizado.tipo_aprendizado === 'eficacia_tarefa') {
          // Ajustar tipo de tarefa sugerida com base no que funciona melhor
          if (aprendizado.padrao_identificado?.tipo_tarefa_eficaz) {
            analise.tipo_tarefa_sugerida = aprendizado.padrao_identificado.tipo_tarefa_eficaz;
          }
        }
      }
      
      return analise;
      
    } catch (error) {
      console.error("❌ [MotorIA] Erro ao aplicar aprendizados:", error);
      return analise;
    }
  }
  
  // ===== FUNÇÕES AUXILIARES =====
  
  static calcularScoreTotal(analise) {
    const pesos = {
      engagement: 0.2,
      potencial_compra: 0.3,
      urgencia: 0.25,
      valor_cliente: 0.15,
      satisfacao: 0.1
    };
    
    return Math.round(
      (analise.score_engagement || 50) * pesos.engagement +
      (analise.score_potencial_compra || 50) * pesos.potencial_compra +
      (analise.score_urgencia || 50) * pesos.urgencia +
      (analise.score_valor_cliente || 50) * pesos.valor_cliente +
      (analise.score_satisfacao || 50) * pesos.satisfacao
    );
  }
  
  static gerarAlertas(analise, cliente, orcamentos, interacoes) {
    const alertas = [];
    
    // Alerta de risco de churn
    if (analise.risco_churn === 'alto' || analise.risco_churn === 'critico') {
      alertas.push({
        tipo: 'risco_churn',
        mensagem: `Cliente ${cliente.razao_social} apresenta risco ${analise.risco_churn} de churn`,
        prioridade: 'alta',
        data_criacao: new Date().toISOString()
      });
    }
    
    // Alerta de orçamentos parados
    const orcamentosParados = orcamentos.filter(o => 
      o.status === 'enviado' && 
      (new Date().getTime() - new Date(o.data_orcamento).getTime()) > 7 * 24 * 60 * 60 * 1000
    );
    
    if (orcamentosParados.length > 0) {
      alertas.push({
        tipo: 'orcamento_parado',
        mensagem: `${orcamentosParados.length} orçamento(s) sem resposta há mais de 7 dias`,
        prioridade: 'media',
        data_criacao: new Date().toISOString()
      });
    }
    
    // Alerta de oportunidade de upsell
    if (analise.oportunidades_upsell && analise.oportunidades_upsell.length > 0) {
      alertas.push({
        tipo: 'oportunidade_upsell',
        mensagem: `Oportunidades identificadas: ${analise.oportunidades_upsell.join(', ')}`,
        prioridade: 'media',
        data_criacao: new Date().toISOString()
      });
    }
    
    return alertas;
  }
  
  static inferirTipoTarefa(score) {
    if (score.risco_churn === 'alto' || score.risco_churn === 'critico') {
      return 'reativacao_cliente';
    }
    
    if (score.score_potencial_compra >= 70) {
      return 'reuniao_fechamento';
    }
    
    if (score.score_urgencia >= 70) {
      return 'ligacao_urgente';
    }
    
    return 'follow_up_orcamento';
  }
  
  static calcularPrioridade(score) {
    const scoreTotal = score.score_total || 50;
    const urgencia = score.score_urgencia || 50;
    
    const prioridadeNumerica = (scoreTotal + urgencia) / 2;
    
    if (prioridadeNumerica >= 80) return 'critica';
    if (prioridadeNumerica >= 65) return 'alta';
    if (prioridadeNumerica >= 40) return 'media';
    return 'baixa';
  }
  
  static calcularPrazo(scoreUrgencia) {
    const agora = new Date();
    let diasParaPrazo;
    
    if (scoreUrgencia >= 80) {
      diasParaPrazo = 1; // Amanhã
    } else if (scoreUrgencia >= 60) {
      diasParaPrazo = 3; // 3 dias
    } else {
      diasParaPrazo = 7; // 1 semana
    }
    
    agora.setDate(agora.getDate() + diasParaPrazo);
    return agora.toISOString();
  }
  
  static estimarValorPotencial(cliente, orcamentos) {
    const orcamentosAtivos = orcamentos.filter(o => 
      !['aprovado', 'rejeitado', 'vencido'].includes(o.status)
    );
    
    if (orcamentosAtivos.length > 0) {
      return orcamentosAtivos.reduce((sum, o) => sum + (o.valor_total || 0), 0);
    }
    
    return cliente.valor_recorrente_mensal || 0;
  }
  
  static preencherTemplate(template, vars) {
    let resultado = template;
    for (const [key, value] of Object.entries(vars)) {
      resultado = resultado.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return resultado;
  }
  
  static moda(array) {
    const frequencia = {};
    let maxFreq = 0;
    let moda = null;
    
    array.forEach(item => {
      frequencia[item] = (frequencia[item] || 0) + 1;
      if (frequencia[item] > maxFreq) {
        maxFreq = frequencia[item];
        moda = item;
      }
    });
    
    return moda;
  }
  
  /**
   * PROCESSADORES ESPECÍFICOS DE EVENTOS
   */
  
  static async processarMensagemWhatsApp(dadosMensagem) {
    // Implementação completa no próximo bloco
    return { tarefasGeradas: 0, scoresAtualizados: 1, acoes: ['analise_sentimento'] };
  }
  
  static async processarMudancaOrcamento(orcamentoId, dados) {
    // Se mudou para "enviado" há 3 dias, gerar tarefa de follow-up
    const orcamento = await Orcamento.get(orcamentoId);
    if (!orcamento) return { tarefasGeradas: 0 };
    
    if (dados.status_novo === 'enviado') {
      // Agendar verificação de follow-up
      const clientes = await Cliente.filter({ razao_social: orcamento.cliente_nome }, null, 1);
      if (clientes.length > 0) {
        // Gerar evento futuro para follow-up
        await EventoSistema.create({
          tipo_evento: 'follow_up_orcamento_necessario',
          entidade_tipo: 'Orcamento',
          entidade_id: orcamentoId,
          dados_evento: { cliente_id: clientes[0].id, dias_decorridos: 0 },
          origem: 'automacao',
          processado: false,
          timestamp: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 dias
        });
      }
    }
    
    return { tarefasGeradas: 0, scoresAtualizados: 0, acoes: ['agendar_follow_up'] };
  }
  
  static async processarNovaInteracao(interacaoId, dados) {
    // Recalcular score do cliente
    const interacao = await Interacao.get(interacaoId);
    if (!interacao) return { scoresAtualizados: 0 };
    
    const clientes = await Cliente.filter({ razao_social: interacao.cliente_nome }, null, 1);
    if (clientes.length === 0) return { scoresAtualizados: 0 };
    
    // Analisar e atualizar score
    await this.analisarClienteIndividual({
      cliente: clientes[0],
      vendas: await Venda.filter({ cliente_nome: clientes[0].razao_social }),
      orcamentos: await Orcamento.filter({ cliente_nome: clientes[0].razao_social }),
      interacoes: await Interacao.filter({ cliente_nome: clientes[0].razao_social })
    });
    
    return { scoresAtualizados: 1, tarefasGeradas: 0 };
  }
  
  static async processarTarefaConcluida(tarefaId, dados) {
    // O processamento principal já é feito em processarFeedbackTarefa
    // Aqui apenas registramos métricas
    return { tarefasGeradas: 0, scoresAtualizados: 0, acoes: ['metricas_atualizadas'] };
  }
  
  static async processarNovaVenda(vendaId, dados) {
    // Atualizar score do cliente positivamente
    const venda = await Venda.get(vendaId);
    if (!venda) return { scoresAtualizados: 0 };
    
    const scores = await ClienteScore.filter({ cliente_nome: venda.cliente_nome }, null, 1);
    if (scores.length > 0) {
      await ClienteScore.update(scores[0].id, {
        score_valor_cliente: Math.min(100, (scores[0].score_valor_cliente || 0) + 10),
        score_satisfacao: Math.min(100, (scores[0].score_satisfacao || 0) + 5),
        alertas_ativos: (scores[0].alertas_ativos || []).filter(a => a.tipo !== 'risco_churn')
      });
    }
    
    return { scoresAtualizados: 1, tarefasGeradas: 0, acoes: ['celebrar_venda'] };
  }
  
  static async gerarContextoTarefa(params) {
    const { cliente, score, orcamentos, interacoes, tipo_tarefa } = params;
    
    // Gerar contexto rico usando LLM
    const contexto = await InvokeLLM({
      prompt: `Você é um assistente de vendas especializado. Gere um contexto rico para uma tarefa de ${tipo_tarefa}.

Cliente: ${cliente.razao_social}
Segmento: ${cliente.segmento}
Score de Urgência: ${score.score_urgencia}/100
Risco de Churn: ${score.risco_churn}
Próxima Melhor Ação: ${score.proxima_melhor_acao}
Orçamentos Abertos: ${orcamentos.filter(o => !['aprovado', 'rejeitado', 'vencido'].includes(o.status)).length}
Última Interação: ${interacoes[0]?.observacoes || 'Nenhuma'}

Gere:
1. Um título claro e acionável para a tarefa
2. Uma descrição detalhada com contexto
3. 3 sugestões de abordagem
4. Pontos-chave para discutir
5. Motivação por que esta tarefa é prioritária`,
      response_json_schema: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string" },
          sugestoes_abordagem: { type: "array", items: { type: "string" } },
          pontos_discussao: { type: "array", items: { type: "string" } },
          motivo_criacao: { type: "string" }
        },
        required: ["titulo", "descricao", "sugestoes_abordagem", "pontos_discussao", "motivo_criacao"]
      }
    });
    
    return {
      ...contexto,
      score_urgencia: score.score_urgencia,
      historico_relevante: interacoes.slice(0, 3).map(i => ({
        data: i.data_interacao,
        tipo: i.tipo_interacao,
        resultado: i.resultado
      }))
    };
  }
  
  static async gerarTarefaFollowUp(tarefaOriginal, insights) {
    // Calcular prazo baseado nos próximos passos sugeridos
    const diasAteFollowUp = this.extrairDiasDosProximosPassos(insights.proximos_passos);
    const prazo = new Date();
    prazo.setDate(prazo.getDate() + diasAteFollowUp);
    
    await TarefaInteligente.create({
      titulo: `Follow-up: ${tarefaOriginal.cliente_nome}`,
      descricao: `Follow-up da interação anterior. ${insights.proximos_passos}`,
      tipo_tarefa: 'follow_up_orcamento',
      prioridade: 'media',
      cliente_id: tarefaOriginal.cliente_id,
      cliente_nome: tarefaOriginal.cliente_nome,
      orcamento_id: tarefaOriginal.orcamento_id,
      vendedor_responsavel: tarefaOriginal.vendedor_responsavel,
      data_prazo: prazo.toISOString(),
      status: 'pendente',
      contexto_ia: {
        motivo_criacao: "Gerada automaticamente com base no feedback da tarefa anterior",
        sugestoes_abordagem: insights.interesses.map(i => `Explorar interesse em: ${i}`),
        pontos_discussao: insights.objecoes.map(o => `Endereçar objeção: ${o}`),
        historico_relevante: [{
          tarefa_anterior_id: tarefaOriginal.id,
          resultado: tarefaOriginal.resultado_execucao?.resultado,
          insights: insights
        }]
      }
    });
  }
  
  static async recalcularScoreComFeedback(scoreAtual, insights, resultado) {
    // Ajustar scores baseado no feedback
    let ajustes = { ...scoreAtual }; // Start with current scores
    
    // Sentimento
    const sentimentoMap = {
      'muito_positivo': +15,
      'positivo': +10,
      'neutro': 0,
      'negativo': -10,
      'muito_negativo': -15
    };
    const ajusteSentimento = sentimentoMap[insights.sentimento] || 0;
    
    ajustes.score_engagement = Math.max(0, Math.min(100, (scoreAtual.score_engagement || 50) + ajusteSentimento));
    ajustes.score_satisfacao = Math.max(0, Math.min(100, (scoreAtual.score_satisfacao || 50) + ajusteSentimento));
    
    // Resultado
    if (resultado === 'venda_fechada') {
      ajustes.score_potencial_compra = 95;
      ajustes.score_valor_cliente = Math.min(100, (scoreAtual.score_valor_cliente || 50) + 20);
      ajustes.risco_churn = 'baixo';
    } else if (resultado === 'interessado') {
      ajustes.score_potencial_compra = Math.min(100, (scoreAtual.score_potencial_compra || 50) + 15);
      ajustes.probabilidade_compra_30dias = Math.min(95, insights.probabilidade_fechamento || 70);
    } else if (resultado === 'nao_interessado') {
      ajustes.score_potencial_compra = Math.max(10, (scoreAtual.score_potencial_compra || 50) - 20);
      ajustes.risco_churn = 'alto';
    }
    
    // Atualizar próxima melhor ação
    if (insights.proximos_passos) {
      ajustes.proxima_melhor_acao = insights.proximos_passos;
    }

    // Recalcular score_total based on adjusted individual scores
    ajustes.score_total = this.calcularScoreTotal(ajustes);
    
    return ajustes;
  }
  
  static async registrarPadraoTarefa(tarefa, insights, resultado) {
    // Registrar padrão de eficácia de tarefa
    const sucesso = resultado === 'venda_fechada' || resultado === 'interessado';
    
    const padroes = await AprendizadoIA.filter({
      tipo_aprendizado: 'eficacia_tarefa',
      'contexto.tipo_tarefa': tarefa.tipo_tarefa
    });
    
    if (padroes.length > 0) {
      // Atualizar padrão existente
      const padrao = padroes[0];
      const nAplicacoes = (padrao.impacto_medido?.n_aplicacoes || 0) + 1;
      const taxaSucessoAtual = padrao.impacto_medido?.taxa_sucesso_depois || 50;
      const novaTaxaSucesso = (taxaSucessoAtual * (nAplicacoes - 1) + (sucesso ? 100 : 0)) / nAplicacoes;
      
      await AprendizadoIA.update(padrao.id, {
        'impacto_medido.n_aplicacoes': nAplicacoes,
        'impacto_medido.taxa_sucesso_depois': novaTaxaSucesso,
        ultima_validacao: new Date().toISOString()
      });
    } else {
      // Criar novo padrão
      await AprendizadoIA.create({
        tipo_aprendizado: 'eficacia_tarefa',
        contexto: {
          tipo_tarefa: tarefa.tipo_tarefa,
          prioridade: tarefa.prioridade
        },
        padrao_identificado: {
          descricao: `Eficácia de tarefas do tipo ${tarefa.tipo_tarefa}`,
          confianca: 60,
          exemplos: [{ tarefa_id: tarefa.id, resultado }]
        },
        impacto_medido: {
          n_aplicacoes: 1,
          taxa_sucesso_depois: sucesso ? 100 : 0
        },
        ativo: true,
        data_descoberta: new Date().toISOString()
      });
    }
  }
  
  static extrairDiasDosProximosPassos(texto) {
    // Tentar extrair número de dias do texto
    const match = texto.match(/(\d+)\s*(dia|dias|day|days)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    
    // Padrões comuns
    if (/amanhã|tomorrow/i.test(texto)) return 1;
    if (/semana|week/i.test(texto)) return 7;
    if (/mês|month/i.test(texto)) return 30;
    
    return 3; // Padrão: 3 dias
  }
  
  static async analisarClienteDefault(cliente, vendas, orcamentos, interacoes) {
    // Fallback simples se não houver template
    const scoreEngagement = Math.min(100, interacoes.length * 10);
    const scorePotencial = orcamentos.length > 0 ? 70 : 40;
    const scoreUrgencia = orcamentos.filter(o => o.status === 'enviado').length * 20;
    
    // Basic calculation for score_valor_cliente
    const totalVendasValue = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const scoreValorCliente = Math.min(100, Math.round(totalVendasValue / 1000)); // Assuming 1000 is a baseline for value
    
    const analise = {
      score_engagement: scoreEngagement,
      score_potencial_compra: scorePotencial,
      score_urgencia: scoreUrgencia,
      score_valor_cliente: scoreValorCliente,
      score_satisfacao: 50, // Default if no specific data
      risco_churn: 'medio',
      probabilidade_compra_30dias: 30,
      sentimento_geral: 'neutro',
      proxima_melhor_acao: "Entrar em contato com o cliente",
      canal_preferido: 'telefone',
      melhor_horario_contato: '14h-16h',
      perfil_compra: 'planejado',
      motivo_score: 'Análise básica por falta de template específico.',
      insights_comportamentais: [],
      oportunidades_upsell: [],
      alertas_ativos: []
    };
    
    const scoreTotal = this.calcularScoreTotal(analise);

    return {
      cliente_id: cliente.id,
      score: scoreTotal,
      analise: {
        ...analise,
        score_total: scoreTotal // Add calculated total score to the analysis object
      }
    };
  }
}
