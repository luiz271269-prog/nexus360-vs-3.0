import { InvokeLLM } from "@/integrations/Core";
import { Cliente } from "@/entities/Cliente";
import { Vendedor } from "@/entities/Vendedor";
import { Orcamento } from "@/entities/Orcamento";
import { Venda } from "@/entities/Venda";
import { Produto } from "@/entities/Produto";
import { TarefaInteligente } from "@/entities/TarefaInteligente";
import { Interacao } from "@/entities/Interacao";
import { MotorRAGV3 } from "../inteligencia/MotorRAGV3";

/**
 * NexusEngineV2 - Motor de IA Conversacional com Tool Use
 * 
 * Capacidades:
 * - Processamento de linguagem natural
 * - Tool calling (busca em entidades, criação de tarefas, etc.)
 * - RAG para consulta de base de conhecimento
 * - Contexto multi-turn
 * - Confidence scoring
 */
export class NexusEngineV2 {
  
  /**
   * Processa entrada do usuário e retorna resposta estruturada
   */
  static async processarEntrada(entrada, usuario, contexto = {}) {
    try {
      console.log('🤖 [NexusEngineV2] Processando entrada:', entrada);
      console.log('👤 [NexusEngineV2] Usuário:', usuario?.email);
      
      // 1. Classificar intenção
      const intencao = await this.classificarIntencao(entrada, contexto);
      console.log('🎯 [NexusEngineV2] Intenção detectada:', intencao.tipo);
      
      // 2. Processar baseado na intenção
      let resposta;
      
      switch (intencao.tipo) {
        case 'buscar_clientes':
          resposta = await this.buscarClientes(entrada, intencao.parametros);
          break;
        case 'buscar_produtos':
          resposta = await this.buscarProdutos(entrada, intencao.parametros);
          break;
        case 'buscar_orcamentos':
          resposta = await this.buscarOrcamentos(entrada, intencao.parametros);
          break;
        case 'buscar_vendedores':
          resposta = await this.buscarVendedores(entrada, intencao.parametros);
          break;
        case 'criar_tarefa':
          resposta = await this.criarTarefa(entrada, intencao.parametros, usuario);
          break;
        case 'registrar_interacao':
          resposta = await this.registrarInteracao(entrada, intencao.parametros, usuario);
          break;
        case 'consultar_conhecimento':
          resposta = await this.consultarBaseConhecimento(entrada, contexto);
          break;
        case 'pergunta_geral':
          resposta = await this.responderPerguntaGeral(entrada, contexto);
          break;
        default:
          resposta = await this.responderPerguntaGeral(entrada, contexto);
      }
      
      console.log('✅ [NexusEngineV2] Resposta gerada:', resposta.content?.substring(0, 100));
      
      return {
        ...resposta,
        intencao_detectada: intencao.tipo,
        confidence: intencao.confidence || 0.8,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ [NexusEngineV2] Erro ao processar:', error);
      
      return {
        type: 'erro',
        content: `Desculpe, encontrei um erro ao processar sua solicitação:\n\n${error.message}\n\nPor favor, tente reformular sua pergunta ou entre em contato com o suporte.`,
        confidence: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Classifica a intenção do usuário usando LLM
   */
  static async classificarIntencao(entrada, contexto) {
    try {
      const prompt = `Você é um assistente de IA especializado em CRM de vendas.

Analise a seguinte mensagem do usuário e classifique a intenção:

MENSAGEM: "${entrada}"

${contexto.historico && contexto.historico.length > 0 ? `
CONTEXTO DA CONVERSA:
${contexto.historico.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')}
` : ''}

INTENÇÕES POSSÍVEIS:
- buscar_clientes: Buscar/listar clientes
- buscar_produtos: Buscar/listar produtos
- buscar_orcamentos: Buscar/listar orçamentos
- buscar_vendedores: Buscar/listar vendedores
- criar_tarefa: Criar uma nova tarefa
- registrar_interacao: Registrar uma interação com cliente
- consultar_conhecimento: Consultar base de conhecimento (políticas, procedimentos)
- pergunta_geral: Pergunta geral sobre o sistema ou dados

Extraia também parâmetros relevantes da mensagem (nomes, datas, valores, etc.).`;

      const resultado = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            tipo: {
              type: "string",
              enum: [
                "buscar_clientes",
                "buscar_produtos", 
                "buscar_orcamentos",
                "buscar_vendedores",
                "criar_tarefa",
                "registrar_interacao",
                "consultar_conhecimento",
                "pergunta_geral"
              ]
            },
            parametros: {
              type: "object",
              properties: {
                nome: { type: "string" },
                segmento: { type: "string" },
                status: { type: "string" },
                limite: { type: "number" },
                outros: { type: "object" }
              }
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1
            },
            motivo: {
              type: "string"
            }
          },
          required: ["tipo", "confidence"]
        }
      });
      
      return resultado;
      
    } catch (error) {
      console.error('❌ [NexusEngineV2] Erro ao classificar intenção:', error);
      return {
        tipo: 'pergunta_geral',
        parametros: {},
        confidence: 0.3,
        motivo: 'Fallback por erro na classificação'
      };
    }
  }
  
  /**
   * TOOL: Buscar clientes
   */
  static async buscarClientes(entrada, parametros) {
    try {
      console.log('🔍 [NexusEngineV2] Buscando clientes com parâmetros:', parametros);
      
      // Buscar clientes
      const clientes = await Cliente.list();
      
      // Filtrar baseado nos parâmetros
      let clientesFiltrados = clientes;
      
      if (parametros.nome) {
        clientesFiltrados = clientesFiltrados.filter(c => 
          c.razao_social?.toLowerCase().includes(parametros.nome.toLowerCase()) ||
          c.nome_fantasia?.toLowerCase().includes(parametros.nome.toLowerCase())
        );
      }
      
      if (parametros.segmento) {
        clientesFiltrados = clientesFiltrados.filter(c => 
          c.segmento?.toLowerCase() === parametros.segmento.toLowerCase()
        );
      }
      
      if (parametros.status) {
        clientesFiltrados = clientesFiltrados.filter(c => 
          c.status?.toLowerCase() === parametros.status.toLowerCase()
        );
      }
      
      // Limitar resultados
      const limite = parametros.limite || 10;
      clientesFiltrados = clientesFiltrados.slice(0, limite);
      
      console.log('✅ [NexusEngineV2] Encontrados:', clientesFiltrados.length, 'clientes');
      
      // Gerar resposta natural
      let conteudo = '';
      
      if (clientesFiltrados.length === 0) {
        conteudo = `Não encontrei clientes com os critérios especificados.`;
      } else {
        conteudo = `Encontrei **${clientesFiltrados.length} cliente(s)**:\n\n`;
        
        clientesFiltrados.forEach((cliente, idx) => {
          conteudo += `${idx + 1}. **${cliente.razao_social}**\n`;
          if (cliente.segmento) conteudo += `   - Segmento: ${cliente.segmento}\n`;
          if (cliente.status) conteudo += `   - Status: ${cliente.status}\n`;
          if (cliente.vendedor_responsavel) conteudo += `   - Vendedor: ${cliente.vendedor_responsavel}\n`;
          conteudo += '\n';
        });
        
        if (clientes.length > limite) {
          conteudo += `\n_Mostrando os primeiros ${limite} resultados de ${clientes.length} total._`;
        }
      }
      
      return {
        type: 'tool_response',
        content: conteudo,
        metadata: {
          ferramenta_usada: 'buscar_clientes',
          total_resultados: clientesFiltrados.length,
          parametros
        },
        tool_calls: [{
          name: 'buscar_clientes',
          arguments: parametros,
          result: clientesFiltrados.map(c => ({
            id: c.id,
            razao_social: c.razao_social,
            segmento: c.segmento,
            status: c.status
          }))
        }]
      };
      
    } catch (error) {
      console.error('❌ [NexusEngineV2] Erro ao buscar clientes:', error);
      return {
        type: 'erro',
        content: `Erro ao buscar clientes: ${error.message}`
      };
    }
  }
  
  /**
   * TOOL: Buscar produtos
   */
  static async buscarProdutos(entrada, parametros) {
    try {
      console.log('🔍 [NexusEngineV2] Buscando produtos');
      
      const produtos = await Produto.list();
      
      let produtosFiltrados = produtos;
      
      if (parametros.nome) {
        produtosFiltrados = produtosFiltrados.filter(p => 
          p.nome?.toLowerCase().includes(parametros.nome.toLowerCase())
        );
      }
      
      if (parametros.categoria) {
        produtosFiltrados = produtosFiltrados.filter(p => 
          p.categoria?.toLowerCase() === parametros.categoria.toLowerCase()
        );
      }
      
      const limite = parametros.limite || 10;
      produtosFiltrados = produtosFiltrados.slice(0, limite);
      
      let conteudo = '';
      
      if (produtosFiltrados.length === 0) {
        conteudo = 'Não encontrei produtos com esses critérios.';
      } else {
        conteudo = `Encontrei **${produtosFiltrados.length} produto(s)**:\n\n`;
        
        produtosFiltrados.forEach((produto, idx) => {
          conteudo += `${idx + 1}. **${produto.nome}**\n`;
          if (produto.categoria) conteudo += `   - Categoria: ${produto.categoria}\n`;
          if (produto.preco_venda) conteudo += `   - Preço: R$ ${produto.preco_venda.toLocaleString('pt-BR')}\n`;
          conteudo += '\n';
        });
      }
      
      return {
        type: 'tool_response',
        content: conteudo,
        metadata: {
          ferramenta_usada: 'buscar_produtos',
          total_resultados: produtosFiltrados.length
        }
      };
      
    } catch (error) {
      return {
        type: 'erro',
        content: `Erro ao buscar produtos: ${error.message}`
      };
    }
  }
  
  /**
   * TOOL: Buscar orçamentos
   */
  static async buscarOrcamentos(entrada, parametros) {
    try {
      console.log('🔍 [NexusEngineV2] Buscando orçamentos');
      
      const orcamentos = await Orcamento.list('-data_orcamento', 100);
      
      let orcamentosFiltrados = orcamentos;
      
      if (parametros.status) {
        orcamentosFiltrados = orcamentosFiltrados.filter(o => 
          o.status?.toLowerCase() === parametros.status.toLowerCase()
        );
      }
      
      if (parametros.cliente) {
        orcamentosFiltrados = orcamentosFiltrados.filter(o => 
          o.cliente_nome?.toLowerCase().includes(parametros.cliente.toLowerCase())
        );
      }
      
      const limite = parametros.limite || 10;
      orcamentosFiltrados = orcamentosFiltrados.slice(0, limite);
      
      let conteudo = '';
      
      if (orcamentosFiltrados.length === 0) {
        conteudo = 'Não encontrei orçamentos com esses critérios.';
      } else {
        conteudo = `Encontrei **${orcamentosFiltrados.length} orçamento(s)**:\n\n`;
        
        orcamentosFiltrados.forEach((orc, idx) => {
          conteudo += `${idx + 1}. **${orc.numero_orcamento || `ORC-${orc.id?.slice(0,8)}`}**\n`;
          if (orc.cliente_nome) conteudo += `   - Cliente: ${orc.cliente_nome}\n`;
          if (orc.status) conteudo += `   - Status: ${orc.status}\n`;
          if (orc.valor_total) conteudo += `   - Valor: R$ ${orc.valor_total.toLocaleString('pt-BR')}\n`;
          conteudo += '\n';
        });
      }
      
      return {
        type: 'tool_response',
        content: conteudo,
        metadata: {
          ferramenta_usada: 'buscar_orcamentos',
          total_resultados: orcamentosFiltrados.length
        }
      };
      
    } catch (error) {
      return {
        type: 'erro',
        content: `Erro ao buscar orçamentos: ${error.message}`
      };
    }
  }
  
  /**
   * TOOL: Buscar vendedores
   */
  static async buscarVendedores(entrada, parametros) {
    try {
      const vendedores = await Vendedor.list();
      
      let vendedoresFiltrados = vendedores;
      
      if (parametros.nome) {
        vendedoresFiltrados = vendedoresFiltrados.filter(v => 
          v.nome?.toLowerCase().includes(parametros.nome.toLowerCase())
        );
      }
      
      if (parametros.status) {
        vendedoresFiltrados = vendedoresFiltrados.filter(v => 
          v.status?.toLowerCase() === parametros.status.toLowerCase()
        );
      }
      
      let conteudo = '';
      
      if (vendedoresFiltrados.length === 0) {
        conteudo = 'Não encontrei vendedores com esses critérios.';
      } else {
        conteudo = `Encontrei **${vendedoresFiltrados.length} vendedor(es)**:\n\n`;
        
        vendedoresFiltrados.forEach((vend, idx) => {
          conteudo += `${idx + 1}. **${vend.nome}**\n`;
          if (vend.email) conteudo += `   - Email: ${vend.email}\n`;
          if (vend.status) conteudo += `   - Status: ${vend.status}\n`;
          conteudo += '\n';
        });
      }
      
      return {
        type: 'tool_response',
        content: conteudo,
        metadata: {
          ferramenta_usada: 'buscar_vendedores',
          total_resultados: vendedoresFiltrados.length
        }
      };
      
    } catch (error) {
      return {
        type: 'erro',
        content: `Erro ao buscar vendedores: ${error.message}`
      };
    }
  }
  
  /**
   * TOOL: Criar tarefa
   */
  static async criarTarefa(entrada, parametros, usuario) {
    try {
      console.log('📝 [NexusEngineV2] Criando tarefa');
      
      // Extrair informações usando LLM
      const detalhes = await InvokeLLM({
        prompt: `Extraia as informações para criar uma tarefa a partir desta solicitação:

"${entrada}"

Extraia:
- Título da tarefa
- Descrição
- Prioridade (baixa, media, alta, critica)
- Cliente relacionado (se mencionado)
- Prazo (se mencionado)`,
        response_json_schema: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            descricao: { type: "string" },
            prioridade: { 
              type: "string", 
              enum: ["baixa", "media", "alta", "critica"] 
            },
            cliente_nome: { type: "string" },
            dias_prazo: { type: "number" }
          },
          required: ["titulo", "descricao", "prioridade"]
        }
      });
      
      // Calcular prazo
      const dataPrazo = new Date();
      dataPrazo.setDate(dataPrazo.getDate() + (detalhes.dias_prazo || 3));
      
      // Criar tarefa
      const tarefa = await TarefaInteligente.create({
        titulo: detalhes.titulo,
        descricao: detalhes.descricao,
        tipo_tarefa: 'follow_up_orcamento',
        prioridade: detalhes.prioridade,
        cliente_nome: detalhes.cliente_nome || 'Não especificado',
        vendedor_responsavel: usuario.full_name,
        data_prazo: dataPrazo.toISOString(),
        status: 'pendente',
        contexto_ia: {
          motivo_criacao: `Criada via Nexus: ${entrada}`,
          criada_por_nexus: true
        }
      });
      
      return {
        type: 'tool_response',
        content: `✅ Tarefa criada com sucesso!\n\n` +
                 `**${detalhes.titulo}**\n` +
                 `Prioridade: ${detalhes.prioridade}\n` +
                 `Prazo: ${dataPrazo.toLocaleDateString('pt-BR')}\n\n` +
                 `A tarefa foi adicionada à sua agenda.`,
        metadata: {
          ferramenta_usada: 'criar_tarefa',
          tarefa_id: tarefa.id
        }
      };
      
    } catch (error) {
      console.error('❌ [NexusEngineV2] Erro ao criar tarefa:', error);
      return {
        type: 'erro',
        content: `Erro ao criar tarefa: ${error.message}`
      };
    }
  }
  
  /**
   * TOOL: Registrar interação
   */
  static async registrarInteracao(entrada, parametros, usuario) {
    try {
      // Similar à criação de tarefa, mas para interações
      return {
        type: 'tool_response',
        content: 'Funcionalidade de registro de interação em desenvolvimento.'
      };
    } catch (error) {
      return {
        type: 'erro',
        content: `Erro ao registrar interação: ${error.message}`
      };
    }
  }
  
  /**
   * TOOL: Consultar base de conhecimento (RAG)
   */
  static async consultarBaseConhecimento(entrada, contexto) {
    try {
      console.log('📚 [NexusEngineV2] Consultando base de conhecimento');
      
      const resultado = await MotorRAGV3.buscarComRAG(entrada, {
        limite: 3,
        incluir_contexto: true
      });
      
      if (!resultado || !resultado.resposta) {
        return {
          type: 'rag_response',
          content: 'Não encontrei informações relevantes na base de conhecimento sobre isso.',
          confidence: 0.3
        };
      }
      
      return {
        type: 'rag_response',
        content: resultado.resposta,
        metadata: {
          ferramenta_usada: 'consultar_conhecimento',
          documentos_consultados: resultado.documentos_usados?.length || 0,
          confianca: resultado.confianca
        },
        confidence: resultado.confianca
      };
      
    } catch (error) {
      console.error('❌ [NexusEngineV2] Erro ao consultar conhecimento:', error);
      return {
        type: 'erro',
        content: `Erro ao consultar base de conhecimento: ${error.message}`
      };
    }
  }
  
  /**
   * Responder pergunta geral
   */
  static async responderPerguntaGeral(entrada, contexto) {
    try {
      console.log('💬 [NexusEngineV2] Respondendo pergunta geral');
      
      const prompt = `Você é o Nexus, assistente inteligente do VendaPro CRM.

Responda à seguinte pergunta do usuário de forma clara e útil:

PERGUNTA: "${entrada}"

${contexto.historico && contexto.historico.length > 0 ? `
CONTEXTO DA CONVERSA:
${contexto.historico.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')}
` : ''}

INSTRUÇÕES:
- Seja conciso mas completo
- Use formatação Markdown quando apropriado
- Se não souber, seja honesto
- Sugira próximos passos quando relevante`;

      const resposta = await InvokeLLM({
        prompt,
        add_context_from_internet: false
      });
      
      return {
        type: 'nexus',
        content: typeof resposta === 'string' ? resposta : resposta.resposta || 'Desculpe, não consegui gerar uma resposta.',
        confidence: 0.7
      };
      
    } catch (error) {
      console.error('❌ [NexusEngineV2] Erro ao responder pergunta geral:', error);
      return {
        type: 'erro',
        content: `Erro ao processar pergunta: ${error.message}`
      };
    }
  }
}

export default NexusEngineV2;