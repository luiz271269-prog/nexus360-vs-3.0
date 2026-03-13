import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * MOTOR DE IMPORTAÇÃO UNIFICADO
 * Gerencia todo o ciclo: detecção → skill → processamento → validação → persistência
 */

const MAX_DIRECT_SIZE = 5 * 1024 * 1024; // 5MB limite para processamento direto

// Mapa de tipos suportados e suas skills
const TIPO_IMPORTACAO_MAP = {
  produtos: {
    skill: 'skill_importacao_produtos',
    entidade: 'Produto',
    label: 'Produtos',
    schema: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              codigo: { type: "string" },
              nome: { type: "string" },
              tipo_produto: { type: "string" },
              marca: { type: "string" },
              modelo: { type: "string" },
              descricao: { type: "string" },
              preco_original: { type: "number" },
              moeda_original: { type: "string", enum: ["BRL", "USD", "EUR"] },
              fornecedor: { type: "string" }
            },
            required: ["nome"]
          }
        }
      }
    },
    promptTemplate: (context) => `
Você é um especialista em extração de dados de produtos comerciais.
Analise o documento e extraia TODOS os produtos encontrados.

Para cada produto, identifique:
- Código/SKU (se houver)
- Nome completo
- Tipo (smartphone, notebook, etc)
- Marca
- Modelo
- Descrição
- Preço (identifique a moeda: R$=BRL, $=USD, €=EUR)
- Fornecedor (se mencionado)

${context.fornecedor ? `Fornecedor padrão: ${context.fornecedor}` : ''}

Retorne JSON estruturado com array "itens".
`
  },
  clientes: {
    skill: 'skill_importacao_clientes',
    entidade: 'Cliente',
    label: 'Clientes',
    schema: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              razao_social: { type: "string" },
              nome_fantasia: { type: "string" },
              cnpj: { type: "string" },
              telefone: { type: "string" },
              email: { type: "string" },
              endereco: { type: "string" },
              contato_principal_nome: { type: "string" },
              ramo_atividade: { type: "string" }
            },
            required: ["razao_social"]
          }
        }
      }
    },
    promptTemplate: () => `
Você é um especialista em extração de dados de clientes/empresas.
Analise o documento e extraia TODOS os clientes/empresas encontrados.

Para cada cliente, identifique:
- Razão Social (obrigatório)
- Nome Fantasia
- CNPJ (formato XX.XXX.XXX/XXXX-XX)
- Telefone
- Email
- Endereço completo
- Nome do contato principal
- Ramo de atividade

Retorne JSON estruturado com array "itens".
`
  },
  vendas: {
    skill: 'skill_importacao_vendas',
    entidade: 'Venda',
    label: 'Vendas',
    schema: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              numero_pedido: { type: "string" },
              cliente_nome: { type: "string" },
              vendedor: { type: "string" },
              data_venda: { type: "string" },
              valor_total: { type: "number" },
              descricao_produtos: { type: "string" }
            },
            required: ["cliente_nome", "valor_total"]
          }
        }
      }
    },
    promptTemplate: () => `
Você é um especialista em extração de dados de vendas.
Analise o documento e extraia TODAS as vendas/pedidos encontrados.

Para cada venda, identifique:
- Número do pedido
- Nome do cliente
- Vendedor responsável
- Data da venda (formato YYYY-MM-DD)
- Valor total
- Descrição dos produtos vendidos

Retorne JSON estruturado com array "itens".
`
  },
  orcamentos: {
    skill: 'skill_importacao_orcamentos',
    entidade: 'Orcamento',
    label: 'Orçamentos',
    schema: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              numero_orcamento: { type: "string" },
              cliente_nome: { type: "string" },
              vendedor: { type: "string" },
              data_orcamento: { type: "string" },
              valor_total: { type: "number" },
              observacoes: { type: "string" }
            },
            required: ["cliente_nome", "valor_total"]
          }
        }
      }
    },
    promptTemplate: () => `
Você é um especialista em extração de dados de orçamentos.
Analise o documento e extraia TODOS os orçamentos encontrados.

Para cada orçamento, identifique:
- Número do orçamento
- Nome do cliente
- Vendedor responsável
- Data do orçamento (formato YYYY-MM-DD)
- Valor total
- Observações

Retorne JSON estruturado com array "itens".
`
  }
};

/**
 * 1️⃣ DETECÇÃO AUTOMÁTICA DO TIPO DE IMPORTAÇÃO
 */
export async function detectarTipoImportacao(fileUrl, fileName) {
  try {
    const prompt = `
Analise este documento e classifique o tipo de dados contido nele.

Tipos possíveis:
- produtos: listas de produtos, catálogos, tabelas de preços
- clientes: cadastros de empresas, contatos, fornecedores
- vendas: notas fiscais, pedidos de venda, relatórios de faturamento
- orcamentos: propostas comerciais, orçamentos, cotações

Responda APENAS com o tipo detectado (uma palavra).
Se não conseguir identificar com certeza, retorne "desconhecido".
`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [fileUrl],
      model: 'gemini_3_flash'
    });

    const tipoDetectado = resultado.toLowerCase().trim();
    
    if (TIPO_IMPORTACAO_MAP[tipoDetectado]) {
      return {
        tipo: tipoDetectado,
        confianca: 'alta',
        config: TIPO_IMPORTACAO_MAP[tipoDetectado]
      };
    }

    return {
      tipo: 'desconhecido',
      confianca: 'baixa',
      sugestao: 'Selecione manualmente o tipo de importação'
    };
  } catch (error) {
    console.error('[UnifiedImport] Erro na detecção:', error);
    return {
      tipo: 'erro',
      erro: error.message
    };
  }
}

/**
 * 2️⃣ PROCESSAMENTO COM SKILL ESPECIALIZADA
 */
export async function processarComSkill(tipo, fileUrl, context = {}) {
  const startTime = Date.now();
  const config = TIPO_IMPORTACAO_MAP[tipo];

  if (!config) {
    throw new Error(`Tipo de importação não suportado: ${tipo}`);
  }

  try {
    const prompt = config.promptTemplate(context);

    // Usar modelo otimizado com contexto web
    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [fileUrl],
      response_json_schema: config.schema,
      model: 'gemini_3_flash',
      add_context_from_internet: tipo === 'produtos' // Apenas produtos precisam de preços atualizados
    });

    const itens = resultado?.itens || [];
    const duration = Date.now() - startTime;

    // 📊 Registrar execução da skill (fire-and-forget)
    ;(async () => {
      try {
        await base44.entities.SkillExecution.create({
          skill_name: config.skill,
          triggered_by: 'user_action',
          execution_mode: 'copilot',
          context: {
            tipo_importacao: tipo,
            arquivo: fileUrl.split('/').pop(),
            ...context
          },
          success: true,
          duration_ms: duration,
          metricas: {
            itens_extraidos: itens.length,
            modelo_ia: 'gemini_3_flash',
            contexto_web: tipo === 'produtos'
          }
        });
      } catch (e) {
        console.warn('[UnifiedImport] SkillExecution falhou:', e.message);
      }
    })();

    return {
      sucesso: true,
      tipo,
      entidade: config.entidade,
      itens,
      duracao: duration,
      skill: config.skill
    };

  } catch (error) {
    // Registrar falha
    ;(async () => {
      try {
        await base44.entities.SkillExecution.create({
          skill_name: config.skill,
          triggered_by: 'user_action',
          execution_mode: 'copilot',
          context: { tipo_importacao: tipo },
          success: false,
          duration_ms: Date.now() - startTime,
          error_message: error.message
        });
      } catch (e) {
        console.warn('[UnifiedImport] SkillExecution falhou:', e.message);
      }
    })();

    throw error;
  }
}

/**
 * 3️⃣ VALIDAÇÃO E DEDUPLICAÇÃO
 */
export async function validarEDeduplificar(tipo, itens) {
  const config = TIPO_IMPORTACAO_MAP[tipo];
  if (!config) return { itensNovos: itens, duplicados: [] };

  try {
    const entidadeExistente = await base44.entities[config.entidade].list();
    const duplicados = [];
    
    const itensNovos = itens.filter(item => {
      // Lógica de deduplicação por tipo
      let isDuplicado = false;

      switch (tipo) {
        case 'produtos':
          isDuplicado = entidadeExistente.some(e => 
            (e.codigo && item.codigo && e.codigo === item.codigo) ||
            (e.nome?.toLowerCase().trim() === item.nome?.toLowerCase().trim())
          );
          break;
        case 'clientes':
          isDuplicado = entidadeExistente.some(e =>
            (e.cnpj && item.cnpj && e.cnpj === item.cnpj) ||
            (e.razao_social?.toLowerCase().trim() === item.razao_social?.toLowerCase().trim())
          );
          break;
        case 'vendas':
          isDuplicado = entidadeExistente.some(e =>
            e.numero_pedido && item.numero_pedido && e.numero_pedido === item.numero_pedido
          );
          break;
        case 'orcamentos':
          isDuplicado = entidadeExistente.some(e =>
            e.numero_orcamento && item.numero_orcamento && e.numero_orcamento === item.numero_orcamento
          );
          break;
      }

      if (isDuplicado) {
        duplicados.push(item);
      }

      return !isDuplicado;
    });

    return { itensNovos, duplicados };
  } catch (error) {
    console.warn('[UnifiedImport] Erro na validação:', error);
    return { itensNovos: itens, duplicados: [] };
  }
}

/**
 * 4️⃣ PERSISTÊNCIA COM HISTÓRICO
 */
export async function salvarImportacao(tipo, itens, metadata = {}) {
  const config = TIPO_IMPORTACAO_MAP[tipo];
  if (!config) {
    throw new Error(`Tipo de importação não suportado: ${tipo}`);
  }

  try {
    // Validar e deduplificar
    const { itensNovos, duplicados } = await validarEDeduplificar(tipo, itens);

    if (itensNovos.length === 0) {
      toast.warning('Todos os itens já existem no banco de dados.');
      return {
        total: itens.length,
        salvos: 0,
        duplicados: duplicados.length
      };
    }

    // Criar registros
    await base44.entities[config.entidade].bulkCreate(itensNovos);

    // Salvar histórico
    await base44.entities.ImportHistory.create({
      tipo_importacao: tipo,
      total_registros: itens.length,
      sucessos: itensNovos.length,
      erros: duplicados.length,
      detalhes: {
        entidade_destino: config.entidade,
        skill_utilizada: config.skill,
        duplicados_ignorados: duplicados.length,
        ...metadata
      }
    });

    if (duplicados.length > 0) {
      toast.info(`${duplicados.length} duplicado(s) ignorado(s).`);
    }

    toast.success(`${itensNovos.length} ${config.label.toLowerCase()} importado(s) com sucesso!`);

    return {
      total: itens.length,
      salvos: itensNovos.length,
      duplicados: duplicados.length
    };

  } catch (error) {
    toast.error(`Erro ao salvar: ${error.message}`);
    throw error;
  }
}

/**
 * 🎯 FLUXO COMPLETO: Upload → Detecção → Processamento → Confirmação → Salvamento
 */
export async function fluxoImportacaoCompleto(file, tipoForcado = null, context = {}) {
  try {
    // 1. Upload do arquivo
    toast.info('Fazendo upload do arquivo...');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // 2. Detecção automática (se não forçado)
    let tipo = tipoForcado;
    if (!tipo) {
      toast.info('Detectando tipo de dados...');
      const deteccao = await detectarTipoImportacao(file_url, file.name);
      
      if (deteccao.tipo === 'desconhecido' || deteccao.tipo === 'erro') {
        return {
          etapa: 'deteccao',
          precisaConfirmacao: true,
          fileUrl: file_url,
          mensagem: deteccao.sugestao || 'Não foi possível detectar o tipo automaticamente'
        };
      }

      tipo = deteccao.tipo;
      toast.success(`Tipo detectado: ${TIPO_IMPORTACAO_MAP[tipo].label}`);
    }

    // 3. Processamento com skill
    toast.info('Extraindo dados com IA...');
    const resultado = await processarComSkill(tipo, file_url, context);

    return {
      etapa: 'processamento',
      sucesso: true,
      tipo,
      itens: resultado.itens,
      fileUrl: file_url,
      metadata: {
        skill: resultado.skill,
        duracao: resultado.duracao,
        arquivo: file.name
      }
    };

  } catch (error) {
    console.error('[UnifiedImport] Erro no fluxo:', error);
    throw error;
  }
}

// Exportar mapa de tipos para uso externo
export { TIPO_IMPORTACAO_MAP };