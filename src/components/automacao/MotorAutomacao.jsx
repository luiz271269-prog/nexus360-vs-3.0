import { AutomationRule } from "@/entities/AutomationRule";
import { AutomationExecution } from "@/entities/AutomationExecution";
import { Cliente } from "@/entities/Cliente";
import { Orcamento } from "@/entities/Orcamento";
import { Venda } from "@/entities/Venda";
import { Vendedor } from "@/entities/Vendedor";
import { Interacao } from "@/entities/Interacao";
import { TarefaInteligente } from "@/entities/TarefaInteligente";
import { InvokeLLM } from "@/integrations/Core";

export class MotorAutomacao {
  
  static async executarTodasRegras() {
    try {
      console.log("🤖 Iniciando execução de todas as regras de automação...");
      
      const regrasAtivas = await AutomationRule.filter({ ativa: true });
      const resultados = {
        total_regras: regrasAtivas.length,
        executadas: 0,
        falharam: 0,
        criadas: 0,
        detalhes: []
      };

      for (const regra of regrasAtivas) {
        try {
          const resultado = await this.executarRegra(regra);
          if (resultado.sucesso) {
            resultados.executadas++;
            resultados.criadas += resultado.itens_criados || 0;
          } else {
            resultados.falharam++;
          }
          resultados.detalhes.push(resultado);
        } catch (error) {
          console.error(`Erro ao executar regra ${regra.nome}:`, error);
          resultados.falharam++;
          resultados.detalhes.push({
            regra: regra.nome,
            sucesso: false,
            erro: error.message
          });
        }
      }

      console.log("✅ Automação concluída:", resultados);
      return resultados;
      
    } catch (error) {
      console.error("Erro geral no motor de automação:", error);
      return { erro: error.message };
    }
  }

  static async executarRegra(regra) {
    const inicioExecucao = Date.now();
    
    try {
      console.log(`⚡ Executando regra: ${regra.nome}`);
      
      let resultado = { sucesso: false, detalhes: "", itens_criados: 0 };

      // Executar baseado na categoria da regra
      switch (regra.categoria) {
        case 'follow_up':
          resultado = await this.executarFollowUp(regra);
          break;
        case 'alertas':
          resultado = await this.executarAlertas(regra);
          break;
        case 'scoring':
          resultado = await this.executarScoring(regra);
          break;
        case 'tarefas':
          resultado = await this.executarCriacaoTarefas(regra);
          break;
        case 'comunicacao':
          resultado = await this.executarComunicacao(regra);
          break;
        default:
          throw new Error(`Categoria de regra não suportada: ${regra.categoria}`);
      }

      // Registrar execução
      await AutomationExecution.create({
        rule_id: regra.id,
        rule_name: regra.nome,
        target_entity_type: regra.gatilho.configuracao?.entidade || 'sistema',
        status: resultado.sucesso ? 'concluido' : 'falhou',
        executado_em: new Date().toISOString(),
        resultado: resultado.detalhes,
        acoes_executadas: resultado.acoes || [],
        tempo_processamento: Math.round((Date.now() - inicioExecucao) / 1000)
      });

      // Atualizar estatísticas da regra
      await AutomationRule.update(regra.id, {
        contador_execucoes: (regra.contador_execucoes || 0) + 1,
        ultima_execucao: new Date().toISOString()
      });

      return {
        regra: regra.nome,
        categoria: regra.categoria,
        sucesso: resultado.sucesso,
        detalhes: resultado.detalhes,
        itens_criados: resultado.itens_criados
      };

    } catch (error) {
      console.error(`Erro na execução da regra ${regra.nome}:`, error);
      
      await AutomationExecution.create({
        rule_id: regra.id,
        rule_name: regra.nome,
        target_entity_type: 'sistema',
        status: 'falhou',
        executado_em: new Date().toISOString(),
        erro_detalhes: error.message,
        tempo_processamento: Math.round((Date.now() - inicioExecucao) / 1000)
      });

      return {
        regra: regra.nome,
        sucesso: false,
        erro: error.message
      };
    }
  }

  // === EXECUÇÃO DE FOLLOW-UP ===
  static async executarFollowUp(regra) {
    const orcamentosSemFollowUp = await Orcamento.filter({
      status: "Em Aberto"
    });

    let tarefasCriadas = 0;
    const acoes = [];

    for (const orcamento of orcamentosSemFollowUp) {
      const dataOrcamento = new Date(orcamento.data_orcamento);
      const diasSemContato = Math.floor((Date.now() - dataOrcamento.getTime()) / (1000 * 60 * 60 * 24));

      if (diasSemContato >= 7) { // 7 dias sem follow-up
        try {
          await TarefaInteligente.create({
            titulo: `Follow-up URGENTE: Orçamento ${orcamento.numero_orcamento}`,
            descricao: `Orçamento de R$ ${orcamento.valor_total?.toLocaleString('pt-BR')} sem contato há ${diasSemContato} dias.`,
            tipo_tarefa: "follow_up_orcamento",
            prioridade: diasSemContato > 14 ? "critica" : "alta",
            cliente_id: orcamento.cliente_nome,
            cliente_nome: orcamento.cliente_nome,
            orcamento_id: orcamento.id,
            vendedor_responsavel: orcamento.vendedor,
            data_prazo: new Date().toISOString(),
            contexto_ia: {
              motivo_criacao: `Automação: ${diasSemContato} dias sem follow-up`,
              score_urgencia: Math.min(100, diasSemContato * 5),
              sugestoes_abordagem: [
                "Ligar imediatamente para o cliente",
                "Verificar se ainda há interesse na proposta",
                "Perguntar sobre prazos e objeções",
                "Oferecer reunião para esclarecimentos"
              ]
            }
          });
          
          tarefasCriadas++;
          acoes.push(`Tarefa criada para orçamento ${orcamento.numero_orcamento}`);
        } catch (error) {
          console.error("Erro ao criar tarefa de follow-up:", error);
        }
      }
    }

    return {
      sucesso: true,
      detalhes: `${tarefasCriadas} tarefas de follow-up criadas para orçamentos em aberto`,
      itens_criados: tarefasCriadas,
      acoes
    };
  }

  // === EXECUÇÃO DE ALERTAS ===
  static async executarAlertas(regra) {
    const hoje = new Date();
    const vendedores = await Vendedor.list();
    let alertasCriados = 0;
    const acoes = [];

    for (const vendedor of vendedores) {
      // Verificar metas do vendedor
      const vendasDoMes = await Venda.filter({
        vendedor: vendedor.nome,
        mes_referencia: hoje.toISOString().slice(0, 7)
      });

      const faturamentoAtual = vendasDoMes.reduce((sum, v) => sum + (v.valor_total || 0), 0);
      const metaMensal = vendedor.meta_mensal || 0;
      const percentualMeta = metaMensal > 0 ? (faturamentoAtual / metaMensal) * 100 : 0;

      // Dia do mês atual
      const diaAtual = hoje.getDate();
      const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      const percentualMesDecorrido = (diaAtual / diasNoMes) * 100;

      // Se está abaixo da meta esperada para o período
      if (percentualMeta < percentualMesDecorrido - 20) {
        try {
          await TarefaInteligente.create({
            titulo: `ALERTA: ${vendedor.nome} abaixo da meta`,
            descricao: `Faturamento: R$ ${faturamentoAtual.toLocaleString('pt-BR')} (${percentualMeta.toFixed(1)}% da meta). Meta: R$ ${metaMensal.toLocaleString('pt-BR')}`,
            tipo_tarefa: "ligacao_urgente",
            prioridade: "alta",
            cliente_id: "sistema",
            cliente_nome: "Gestão de Vendedores",
            vendedor_responsavel: "Gerente de Vendas",
            data_prazo: new Date().toISOString(),
            contexto_ia: {
              motivo_criacao: "Automação: Performance abaixo da meta",
              sugestoes_abordagem: [
                "Conversar com o vendedor sobre dificuldades",
                "Revisar pipeline de oportunidades",
                "Oferecer suporte adicional",
                "Analisar estratégias de abordagem"
              ]
            }
          });
          
          alertasCriados++;
          acoes.push(`Alerta criado para vendedor ${vendedor.nome}`);
        } catch (error) {
          console.error("Erro ao criar alerta:", error);
        }
      }
    }

    return {
      sucesso: true,
      detalhes: `${alertasCriados} alertas de performance criados`,
      itens_criados: alertasCriados,
      acoes
    };
  }

  // === EXECUÇÃO DE SCORING ===
  static async executarScoring(regra) {
    const clientes = await Cliente.list();
    let scoresAtualizados = 0;
    const acoes = [];

    for (const cliente of clientes) {
      try {
        // Buscar dados do cliente
        const [vendas, orcamentos, interacoes] = await Promise.all([
          Venda.filter({ cliente_nome: cliente.razao_social }),
          Orcamento.filter({ cliente_nome: cliente.razao_social }),
          Interacao.filter({ cliente_nome: cliente.razao_social })
        ]);

        // Calcular score baseado em atividade
        let score = 50; // Base

        // Score por vendas
        const totalVendas = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        score += Math.min(30, totalVendas / 1000); // +1 ponto por R$ 1.000

        // Score por orçamentos ativos
        const orcamentosAtivos = orcamentos.filter(o => o.status === "Em Aberto").length;
        score += orcamentosAtivos * 5;

        // Score por interações recentes
        const interacoesRecentes = interacoes.filter(i => {
          const dataInteracao = new Date(i.data_interacao);
          const diasAtras = (Date.now() - dataInteracao.getTime()) / (1000 * 60 * 60 * 24);
          return diasAtras <= 30;
        }).length;
        score += interacoesRecentes * 3;

        // Atualizar classificação do cliente
        let novaClassificacao = "C - Baixo Potencial";
        if (score >= 80) novaClassificacao = "A - Alto Potencial";
        else if (score >= 60) novaClassificacao = "B - Médio Potencial";

        await Cliente.update(cliente.id, {
          classificacao: novaClassificacao,
          valor_recorrente_mensal: totalVendas / Math.max(1, vendas.length)
        });

        scoresAtualizados++;
        acoes.push(`Score atualizado para ${cliente.razao_social}: ${score.toFixed(0)} pontos`);

      } catch (error) {
        console.error(`Erro ao calcular score para ${cliente.razao_social}:`, error);
      }
    }

    return {
      sucesso: true,
      detalhes: `${scoresAtualizados} scores de clientes atualizados`,
      itens_criados: scoresAtualizados,
      acoes
    };
  }

  // === EXECUÇÃO DE CRIAÇÃO DE TAREFAS ===
  static async executarCriacaoTarefas(regra) {
    // Encontrar clientes sem contato há muito tempo
    const clientes = await Cliente.list();
    let tarefasCriadas = 0;
    const acoes = [];

    for (const cliente of clientes) {
      if (!cliente.ultimo_contato) continue;

      const ultimoContato = new Date(cliente.ultimo_contato);
      const diasSemContato = Math.floor((Date.now() - ultimoContato.getTime()) / (1000 * 60 * 60 * 24));

      if (diasSemContato >= 45) { // 45 dias sem contato
        try {
          await TarefaInteligente.create({
            titulo: `Reativação: Cliente ${cliente.razao_social}`,
            descricao: `Cliente sem contato há ${diasSemContato} dias. Última interação: ${ultimoContato.toLocaleDateString('pt-BR')}`,
            tipo_tarefa: "reativacao_cliente",
            prioridade: "media",
            cliente_id: cliente.id,
            cliente_nome: cliente.razao_social,
            vendedor_responsavel: cliente.vendedor_responsavel,
            data_prazo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
            contexto_ia: {
              motivo_criacao: `Automação: ${diasSemContato} dias sem contato`,
              sugestoes_abordagem: [
                "Ligar para saber como estão os negócios",
                "Enviar material sobre novos produtos/serviços",
                "Propor reunião para apresentação",
                "Verificar se há necessidades atuais"
              ]
            }
          });

          tarefasCriadas++;
          acoes.push(`Tarefa de reativação criada para ${cliente.razao_social}`);
        } catch (error) {
          console.error("Erro ao criar tarefa de reativação:", error);
        }
      }
    }

    return {
      sucesso: true,
      detalhes: `${tarefasCriadas} tarefas de reativação criadas`,
      itens_criadas: tarefasCriadas,
      acoes
    };
  }

  // === EXECUÇÃO DE COMUNICAÇÃO ===
  static async executarComunicacao(regra) {
    // Esta função pode integrar com WhatsApp, email, etc.
    // Por enquanto, vamos simular
    return {
      sucesso: true,
      detalhes: "Funcionalidade de comunicação automática em desenvolvimento",
      itens_criados: 0,
      acoes: ["Simulação de envio de comunicações automáticas"]
    };
  }

  // === FUNÇÃO DE INICIALIZAÇÃO ===
  static async inicializarRegrasPreDefinidas() {
    try {
      const regrasExistentes = await AutomationRule.list();
      
      if (regrasExistentes.length === 0) {
        console.log("🚀 Criando regras de automação pré-definidas...");
        
        const regrasBase = [
          {
            nome: "Follow-up Orçamentos em Aberto",
            descricao: "Cria tarefas de follow-up para orçamentos sem contato há mais de 7 dias",
            categoria: "follow_up",
            gatilho: {
              tipo: "tempo",
              configuracao: { intervalo_horas: 24 }
            },
            condicoes: [
              { campo: "status", operador: "equals", valor: "Em Aberto" },
              { campo: "dias_sem_contato", operador: "greater_than", valor: "7" }
            ],
            acoes: [
              { tipo: "criar_tarefa", configuracao: { prioridade: "alta", tipo: "follow_up_orcamento" } }
            ],
            ativa: true
          },
          {
            nome: "Alerta Performance Vendedores",
            descricao: "Monitora vendedores com performance abaixo da meta e cria alertas",
            categoria: "alertas",
            gatilho: {
              tipo: "tempo",
              configuracao: { intervalo_horas: 24 }
            },
            condicoes: [
              { campo: "percentual_meta", operador: "less_than", valor: "70" }
            ],
            acoes: [
              { tipo: "criar_alerta", configuracao: { destinatario: "gerencia" } }
            ],
            ativa: true
          },
          {
            nome: "Atualização de Scores de Clientes",
            descricao: "Recalcula e atualiza scores de clientes baseado em atividade recente",
            categoria: "scoring",
            gatilho: {
              tipo: "tempo",
              configuracao: { intervalo_horas: 48 }
            },
            condicoes: [],
            acoes: [
              { tipo: "recalcular_score", configuracao: { todos_clientes: true } }
            ],
            ativa: true
          },
          {
            nome: "Reativação de Clientes Inativos",
            descricao: "Cria tarefas de reativação para clientes sem contato há mais de 45 dias",
            categoria: "tarefas",
            gatilho: {
              tipo: "tempo",
              configuracao: { intervalo_horas: 72 }
            },
            condicoes: [
              { campo: "dias_ultimo_contato", operador: "greater_than", valor: "45" }
            ],
            acoes: [
              { tipo: "criar_tarefa", configuracao: { tipo: "reativacao_cliente", prioridade: "media" } }
            ],
            ativa: true
          }
        ];

        for (const regra of regrasBase) {
          await AutomationRule.create(regra);
        }

        console.log("✅ Regras de automação criadas com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao inicializar regras:", error);
    }
  }
}