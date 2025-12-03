
import { Orcamento } from "@/entities/Orcamento";
import { Cliente } from "@/entities/Cliente";
import { Produto } from "@/entities/Produto";
import { Venda } from "@/entities/Venda";
import { TarefaInteligente } from "@/entities/TarefaInteligente";
import { User } from "@/entities/User";
import { InvokeLLM, SendEmail, UploadFile } from "@/integrations/Core";

/**
 * ═══════════════════════════════════════════════════════════
 * SISTEMA DE TOOL USE - VERSÃO 3.0 (COM PERSISTÊNCIA DE MÍDIA)
 * ═══════════════════════════════════════════════════════════
 *
 * Arquitetura de Agente de IA Pura:
 * - Ferramentas abstraem complexidade de I/O
 * - Cada tool é reutilizável por qualquer componente do agente
 * - Logging completo para auditoria e debug
 */

class SistemaToolUse {
  constructor() {
    this.tools = new Map();
    this.registrarToolsBasicas();
    this.registrarToolsAvancadas();
    this.registrarToolsMultimidia(); // 🆕 NOVO
  }

  /**
   * Registra as ferramentas básicas do VendaPro
   */
  registrarToolsBasicas() {
    // ═══════════════════════════════════════════════════════════
    // TOOL: Buscar Cliente
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'buscar_cliente',
      descricao: 'Busca informações de um cliente por nome ou CNPJ',
      parametros: {
        type: "object",
        properties: {
          termo_busca: { type: "string", description: "Nome ou CNPJ do cliente" }
        },
        required: ["termo_busca"]
      },
      executar: async (params) => {
        const clientes = await Cliente.list();
        const resultado = clientes.find(c =>
          c.razao_social?.toLowerCase().includes(params.termo_busca.toLowerCase()) ||
          c.cnpj === params.termo_busca
        );
        return resultado || { erro: 'Cliente não encontrado' };
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Listar Produtos
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'listar_produtos',
      descricao: 'Lista produtos disponíveis, com filtros opcionais',
      parametros: {
        type: "object",
        properties: {
          categoria: { type: "string", description: "Categoria do produto (opcional)" },
          limite: { type: "number", description: "Número máximo de resultados", default: 10 }
        }
      },
      executar: async (params) => {
        let produtos = await Produto.list('-created_date', params.limite || 10);
        if (params.categoria) {
          produtos = produtos.filter(p => p.categoria === params.categoria);
        }
        return produtos;
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Criar Orçamento
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'criar_orcamento',
      descricao: 'Cria um novo orçamento no sistema',
      parametros: {
        type: "object",
        properties: {
          cliente_nome: { type: "string" },
          vendedor: { type: "string" },
          produtos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nome: { type: "string" },
                quantidade: { type: "number" },
                valor_unitario: { type: "number" }
              }
            }
          },
          observacoes: { type: "string" }
        },
        required: ["cliente_nome", "vendedor", "produtos"]
      },
      executar: async (params) => {
        const valor_total = params.produtos.reduce((sum, p) => sum + (p.quantidade * p.valor_unitario), 0);

        const orcamento = await Orcamento.create({
          cliente_nome: params.cliente_nome,
          vendedor: params.vendedor,
          data_orcamento: new Date().toISOString().split('T')[0],
          valor_total: valor_total,
          status: 'rascunho',
          observacoes: params.observacoes || ''
        });

        return {
          sucesso: true,
          orcamento_id: orcamento.id,
          numero_orcamento: orcamento.numero_orcamento,
          valor_total: valor_total
        };
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Buscar Orçamentos
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'buscar_orcamentos',
      descricao: 'Busca orçamentos por cliente ou vendedor',
      parametros: {
        type: "object",
        properties: {
          cliente_nome: { type: "string" },
          vendedor: { type: "string" },
          status: { type: "string" }
        }
      },
      executar: async (params) => {
        let orcamentos = await Orcamento.list('-created_date', 50);

        if (params.cliente_nome) {
          orcamentos = orcamentos.filter(o => o.cliente_nome?.toLowerCase().includes(params.cliente_nome.toLowerCase()));
        }
        if (params.vendedor) {
          orcamentos = orcamentos.filter(o => o.vendedor === params.vendedor);
        }
        if (params.status) {
          orcamentos = orcamentos.filter(o => o.status === params.status);
        }

        return orcamentos;
      }
    });

    console.log('✅ [Tool Use] Ferramentas básicas registradas');
  }

  /**
   * Registra ferramentas avançadas
   */
  registrarToolsAvancadas() {
    // ═══════════════════════════════════════════════════════════
    // TOOL: Enviar Email
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'enviar_email',
      descricao: 'Envia um email para um destinatário',
      parametros: {
        type: "object",
        properties: {
          destinatario: { type: "string", description: "Email do destinatário" },
          assunto: { type: "string", description: "Assunto do email" },
          corpo: { type: "string", description: "Corpo da mensagem" },
          nome_remetente: { type: "string", description: "Nome do remetente (opcional)" }
        },
        required: ["destinatario", "assunto", "corpo"]
      },
      executar: async (params) => {
        await SendEmail({
          from_name: params.nome_remetente || 'VendaPro',
          to: params.destinatario,
          subject: params.assunto,
          body: params.corpo
        });
        return {
          sucesso: true,
          mensagem: `Email enviado para ${params.destinatario}`
        };
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Criar Tarefa Inteligente
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'criar_tarefa',
      descricao: 'Cria uma tarefa inteligente no sistema',
      parametros: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string" },
          tipo_tarefa: {
            type: "string",
            enum: ["follow_up_orcamento", "ligacao_urgente", "reuniao_fechamento", "envio_proposta", "negociacao", "reativacao_cliente"]
          },
          cliente_id: { type: "string" },
          vendedor_responsavel: { type: "string" },
          data_prazo: { type: "string", format: "datetime" },
          prioridade: { type: "string", enum: ["baixa", "media", "alta", "critica"] }
        },
        required: ["titulo", "tipo_tarefa", "cliente_id", "vendedor_responsavel", "data_prazo"]
      },
      executar: async (params) => {
        const tarefa = await TarefaInteligente.create(params);
        return {
          sucesso: true,
          tarefa_id: tarefa.id,
          mensagem: `Tarefa "${params.titulo}" criada com sucesso`
        };
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Buscar Vendedores
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'buscar_vendedores',
      descricao: 'Lista vendedores do sistema com filtros opcionais',
      parametros: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ativo", "inativo", "ferias"] },
          limite: { type: "number", default: 10 }
        }
      },
      executar: async (params) => {
        const usuarios = await User.list();
        let vendedores = usuarios.filter(u => u.role === 'user'); // Vendedores são users regulares

        if (params.limite) {
          vendedores = vendedores.slice(0, params.limite);
        }

        return vendedores.map(v => ({
          id: v.id,
          nome: v.full_name,
          email: v.email
        }));
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Atualizar Status de Orçamento
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'atualizar_orcamento',
      descricao: 'Atualiza o status de um orçamento existente',
      parametros: {
        type: "object",
        properties: {
          orcamento_id: { type: "string" },
          novo_status: {
            type: "string",
            enum: ["rascunho", "enviado", "negociando", "aprovado", "rejeitado", "vencido"]
          },
          observacoes: { type: "string" }
        },
        required: ["orcamento_id", "novo_status"]
      },
      executar: async (params) => {
        const orcamentos = await Orcamento.filter({ id: params.orcamento_id });

        if (orcamentos.length === 0) {
          throw new Error("Orçamento não encontrado");
        }

        await Orcamento.update(params.orcamento_id, {
          status: params.novo_status,
          observacoes: params.observacoes || orcamentos[0].observacoes
        });

        return {
          sucesso: true,
          mensagem: `Orçamento atualizado para status "${params.novo_status}"`
        };
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Criar Venda
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'criar_venda',
      descricao: 'Cria um registro de venda no sistema',
      parametros: {
        type: "object",
        properties: {
          cliente_nome: { type: "string" },
          vendedor: { type: "string" },
          valor_total: { type: "number" },
          produtos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nome: { type: "string" },
                quantidade: { type: "number" },
                valor_unitario: { type: "number" }
              }
            }
          },
          tipo_venda: {
            type: "string",
            enum: ["Nova Venda", "Renovação", "Upsell", "Cross-sell"],
            default: "Nova Venda"
          },
          condicao_pagamento: { type: "string" }
        },
        required: ["cliente_nome", "vendedor", "valor_total"]
      },
      executar: async (params) => {
        const venda = await Venda.create({
          ...params,
          data_venda: new Date().toISOString().split('T')[0],
          status: "Pendente",
          mes_referencia: new Date().toISOString().substring(0, 7)
        });

        return {
          sucesso: true,
          venda_id: venda.id,
          numero_pedido: venda.numero_pedido,
          valor_total: venda.valor_total
        };
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Buscar Produtos por Categoria
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'buscar_produtos_categoria',
      descricao: 'Busca produtos de uma categoria específica',
      parametros: {
        type: "object",
        properties: {
          categoria: { type: "string" },
          limite: { type: "number", default: 20 }
        },
        required: ["categoria"]
      },
      executar: async (params) => {
        let produtos = await Produto.list('-created_date', params.limite || 20);
        produtos = produtos.filter(p => p.categoria === params.categoria);

        return produtos.map(p => ({
          id: p.id,
          nome: p.nome,
          categoria: p.categoria,
          preco_venda: p.preco_venda,
          estoque_atual: p.estoque_atual
        }));
      }
    });

    console.log('✅ [Tool Use] Ferramentas avançadas registradas');
  }

  /**
   * 🆕 NOVO: Registra ferramentas de multimídia (Persistência + Análise)
   */
  registrarToolsMultimidia() {
    // ═══════════════════════════════════════════════════════════
    // TOOL: Armazenar Mídia (Persistência Permanente)
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'armazenar_midia',
      descricao: 'Baixa uma mídia de URL temporária e armazena permanentemente no Supabase Storage',
      parametros: {
        type: "object",
        properties: {
          url_temporaria: {
            type: "string",
            description: "URL temporária da mídia (Z-API, Evolution, Meta)"
          },
          media_type: {
            type: "string",
            enum: ["image", "video", "audio", "document"],
            description: "Tipo da mídia"
          },
          mime_type: {
            type: "string",
            description: "MIME type (ex: image/jpeg, audio/ogg)",
            default: "application/octet-stream"
          }
        },
        required: ["url_temporaria", "media_type"]
      },
      executar: async (params) => {
        console.log(`[ArmazenarMidia.tool] 📥 Iniciando download: ${params.url_temporaria.substring(0, 50)}...`);

        try {
          // 1. Validação
          if (!params.url_temporaria || !params.url_temporaria.startsWith('http')) {
            throw new Error('URL inválida');
          }

          // 2. Fetch da URL Temporária (com timeout de 30s)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(params.url_temporaria, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'VendaPro/3.0'
            }
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // 3. Converte para Blob
          const blob = await response.blob();
          const fileSize = blob.size;

          console.log(`[ArmazenarMidia.tool] 📦 Mídia baixada: ${(fileSize / 1024).toFixed(2)} KB`);

          // 4. Gera nome do arquivo
          const extensaoMap = {
            'image': 'jpg',
            'video': 'mp4',
            'audio': 'ogg',
            'document': 'pdf'
          };

          const extensao = extensaoMap[params.media_type] || 'bin';
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const filename = `whatsapp_${timestamp}_${random}.${extensao}`;

          // 5. Upload para Supabase via Base44 SDK
          const file = new File([blob], filename, {
            type: params.mime_type || blob.type
          });

          const { file_url } = await UploadFile({ file });

          console.log(`[ArmazenarMidia.tool] ✅ Mídia persistida: ${file_url}`);

          return {
            sucesso: true,
            url_permanente: file_url,
            tamanho_bytes: fileSize,
            nome_arquivo: filename,
            tipo: params.media_type
          };

        } catch (error) {
          console.error(`[ArmazenarMidia.tool] ❌ ERRO CRÍTICO:`, error);

          // Fallback: retorna URL original em caso de erro
          return {
            sucesso: false,
            url_permanente: params.url_temporaria, // Fallback
            erro: error.message,
            tipo: params.media_type
          };
        }
      }
    });

    // ═══════════════════════════════════════════════════════════
    // TOOL: Analisar Mídia (Inteligência Multimodal)
    // ═══════════════════════════════════════════════════════════
    this.registrarTool({
      nome: 'analisar_midia',
      descricao: 'Analisa o conteúdo de uma imagem ou documento usando IA multimodal',
      parametros: {
        type: "object",
        properties: {
          url_midia: {
            type: "string",
            description: "URL permanente da mídia a ser analisada"
          },
          media_type: {
            type: "string",
            enum: ["image", "document"],
            description: "Tipo da mídia"
          },
          contexto: {
            type: "string",
            description: "Contexto da conversa para melhor análise"
          }
        },
        required: ["url_midia", "media_type"]
      },
      executar: async (params) => {
        console.log(`[AnalisarMidia.tool] 🧠 Iniciando análise multimodal...`);

        try {
          // Prompt contextualizado
          const prompt = `Você é um assistente de vendas especializado. Analise esta ${params.media_type === 'image' ? 'imagem' : 'documento'} e extraia informações relevantes para vendas.

${params.contexto ? `Contexto da conversa: ${params.contexto}` : ''}

Identifique:
1. **Tipo de Conteúdo**: O que é esta mídia? (ex: proposta comercial, produto, comprovante, etc.)
2. **Informações Chave**: Valores, datas, produtos, marcas, concorrentes mencionados
3. **Sentimento/Intenção**: O que o cliente está tentando comunicar?
4. **Risco/Oportunidade**: Isso representa uma ameaça (ex: proposta concorrente) ou oportunidade?
5. **Ação Sugerida**: O que o vendedor deve fazer com base nesta informação?

Seja objetivo e direto.`;

          const analise = await InvokeLLM({
            prompt,
            file_urls: [params.url_midia],
            response_json_schema: {
              type: "object",
              properties: {
                tipo_conteudo: { type: "string" },
                informacoes_chave: {
                  type: "object",
                  properties: {
                    valores: { type: "array", items: { type: "string" } },
                    datas: { type: "array", items: { type: "string" } },
                    produtos: { type: "array", items: { type: "string" } },
                    concorrentes: { type: "array", items: { type: "string" } }
                  }
                },
                sentimento_intencao: { type: "string" },
                risco_oportunidade: {
                  type: "object",
                  properties: {
                    tipo: { type: "string", enum: ["risco", "oportunidade", "neutro"] },
                    descricao: { type: "string" },
                    nivel: { type: "string", enum: ["baixo", "medio", "alto", "critico"] }
                  }
                },
                acao_sugerida: { type: "string" },
                resumo_executivo: { type: "string" }
              }
            }
          });

          console.log(`[AnalisarMidia.tool] ✅ Análise concluída`);

          return {
            sucesso: true,
            analise: analise,
            timestamp_analise: new Date().toISOString()
          };

        } catch (error) {
          console.error(`[AnalisarMidia.tool] ❌ ERRO na análise:`, error);

          return {
            sucesso: false,
            erro: error.message,
            analise: {
              tipo_conteudo: "Não foi possível analisar",
              resumo_executivo: "Falha na análise automática. Revisão manual necessária."
            }
          };
        }
      }
    });

    console.log('✅ [Tool Use] Ferramentas de multimídia registradas');
  }

  /**
   * Registra uma nova ferramenta no sistema
   */
  registrarTool(tool) {
    if (!tool.nome || !tool.descricao || !tool.executar) {
      throw new Error('Tool inválida: faltam propriedades obrigatórias');
    }

    this.tools.set(tool.nome, tool);
  }

  /**
   * Executa uma ferramenta específica
   */
  async executarTool(nomeTool, parametros) {
    const tool = this.tools.get(nomeTool);

    if (!tool) {
      throw new Error(`Ferramenta "${nomeTool}" não encontrada`);
    }

    console.log(`🔨 [Tool Use] Executando: ${nomeTool}`);

    try {
      const resultado = await tool.executar(parametros);
      console.log(`✅ [Tool Use] ${nomeTool} executada com sucesso`);
      return {
        sucesso: true,
        resultado: resultado
      };
    } catch (error) {
      console.error(`❌ [Tool Use] Erro em ${nomeTool}:`, error);
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  /**
   * Retorna lista de ferramentas disponíveis para a IA
   */
  listarToolsDisponiveis() {
    return Array.from(this.tools.values()).map(tool => ({
      nome: tool.nome,
      descricao: tool.descricao,
      parametros: tool.parametros
    }));
  }

  /**
   * Seleciona automaticamente a tool mais adequada para uma tarefa
   */
  async selecionarTool(objetivo) {
    const toolsDisponiveis = this.listarToolsDisponiveis();

    const prompt = `Você precisa selecionar a ferramenta mais adequada para executar a seguinte tarefa:

**TAREFA:**
${objetivo}

**FERRAMENTAS DISPONÍVEIS:**
${JSON.stringify(toolsDisponiveis, null, 2)}

Selecione a ferramenta mais adequada e sugira os parâmetros.`;

    const resposta = await InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          ferramenta_selecionada: { type: "string" },
          parametros_sugeridos: { type: "object" },
          justificativa: { type: "string" }
        }
      }
    });

    return resposta;
  }
}

export default new SistemaToolUse();
