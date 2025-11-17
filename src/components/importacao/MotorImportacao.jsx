import { base44 } from "@/api/base44Client";

const detectarTipoArquivo = (file) => {
  const extensao = file.name.split('.').pop().toLowerCase();
  const mapeamento = {
    'pdf': 'pdf', 'xlsx': 'excel', 'xls': 'excel', 'csv': 'csv',
    'docx': 'word', 'doc': 'word', 'jpg': 'imagem',
    'jpeg': 'imagem', 'png': 'imagem', 'xml': 'xml', 'json': 'json'
  };
  return mapeamento[extensao] || 'outro';
};

const extrairDadosComIA = async (fileUrl, tipoArquivo, nomeArquivo) => {
  if (nomeArquivo.toLowerCase().endsWith('.xls')) {
    throw new Error('Arquivos .xls não são suportados. Por favor, salve como .xlsx ou .csv e tente novamente.');
  }

  if (['excel', 'csv'].includes(tipoArquivo)) {
    try {
      const schema = {
        type: "object",
        properties: {
          dados_extraidos: {
            type: "array",
            items: { type: "object", additionalProperties: true }
          }
        },
        required: ["dados_extraidos"]
      };

      const resultado = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: schema
      });

      if (resultado && resultado.status === 'success' && resultado.output) {
        const dadosExtraidos = Array.isArray(resultado.output) ? resultado.output : resultado.output.dados_extraidos;

        return {
          dados_extraidos: dadosExtraidos || [],
          confianca_extracao: 90,
          tipo_conteudo_detectado: "planilha",
          observacoes: "Dados extraídos de planilha estruturada"
        };
      } else {
        throw new Error("Não foi possível extrair dados da planilha");
      }
    } catch (error) {
      console.error("Erro ao extrair dados de planilha:", error);
      throw new Error(`Erro ao processar planilha: ${error.message}`);
    }
  }

  const prompt = `
    Analise o conteúdo deste arquivo (pode ser uma imagem, PDF, ou documento) e extraia dados estruturados em formato de tabela.

    REGRAS CRÍTICAS:
    1.  Se for uma IMAGEM (print de tela): Faça OCR, identifique a tabela principal e extraia TODAS as linhas e colunas.
    2.  Se for um PDF: Extraia a tabela principal do documento.
    3.  NUNCA retorne um array 'dados_extraidos' vazio. Se não encontrar uma tabela, extraia qualquer informação estruturada que encontrar (ex: chave-valor de um formulário).
    4.  Se não houver absolutamente nada, retorne um array com um único objeto contendo uma chave 'erro' com a descrição do problema.

    FORMATO DE RESPOSTA OBRIGATÓRIO (JSON):
    {
      "dados_extraidos": [
        {"coluna1": "valorA1", "coluna2": "valorA2", ...},
        {"coluna1": "valorB1", "coluna2": "valorB2", ...}
      ],
      "confianca_extracao": um_numero_de_0_a_100,
      "tipo_conteudo_detectado": "imagem_tabela | pdf_tabela | formulario | texto_simples",
      "observacoes": "Breve descrição do que foi extraído."
    }
  `;

  try {
    const resultadoIA = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      file_urls: [fileUrl],
      response_json_schema: {
        type: "object",
        properties: {
          dados_extraidos: {
            type: "array",
            items: { type: "object", additionalProperties: true }
          },
          confianca_extracao: { type: "number" },
          tipo_conteudo_detectado: { type: "string" },
          observacoes: { type: "string" }
        },
        required: ["dados_extraidos"]
      }
    });

    if (resultadoIA && resultadoIA.dados_extraidos && Array.isArray(resultadoIA.dados_extraidos)) {
      return resultadoIA;
    }
    throw new Error("A IA não retornou um formato de dados válido.");
  } catch (error) {
    console.error("Erro na extração de dados com IA:", error);
    throw new Error(`Falha na IA: ${error.message}`);
  }
};

const determinarDestinoDados = (tipoClassificacao) => {
    const mapeamento = {
      'lista_clientes': 'clientes', 'relatorio_vendas': 'vendas', 'sales_report': 'vendas',
      'pedido': 'vendas', 'nota_fiscal': 'vendas', 'planilha_metas': 'vendedores',
      'orcamento': 'orcamentos', 'fatura': 'vendas', 'lista_produtos': 'produtos',
      'vendas': 'vendas', 'clientes': 'clientes', 'vendedores': 'vendedores',
    };
    const tipoNormalizado = String(tipoClassificacao).toLowerCase().trim();
    return mapeamento[tipoNormalizado] || 'nao_aplicavel';
};

const classificarConteudo = async (headers) => {
    const prompt = `Analise estes cabeçalhos de coluna: [${headers.join(', ')}]. Qual o tipo de dado mais provável? Responda APENAS com uma das seguintes opções: 'vendas', 'clientes', 'orcamentos', 'vendedores', 'produtos', 'nao_identificado'.`;
    try {
        const resultado = await base44.integrations.Core.InvokeLLM({ prompt });
        return resultado.trim().toLowerCase();
    } catch {
        return 'nao_identificado';
    }
};

export const processarArquivo = async (file, contexto = null) => {
  let processamentoId = null;
  const startTime = Date.now();

  try {
    const tipoArquivo = detectarTipoArquivo(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const novoProcessamento = await base44.entities.ImportacaoDocumento.create({
      nome_arquivo: file.name,
      tipo_documento: tipoArquivo,
      status_processamento: "processando",
      data_processamento: new Date().toISOString(),
      url_arquivo: file_url,
      destino_dados: contexto
    });
    processamentoId = novoProcessamento.id;

    const resultadoExtracao = await extrairDadosComIA(file_url, tipoArquivo, file.name);

    if (!resultadoExtracao.dados_extraidos || resultadoExtracao.dados_extraidos.length === 0) {
      throw new Error("Nenhum dado estruturado pôde ser extraído do arquivo.");
    }

    let destinoFinal = contexto;
    let tipoPrincipal = contexto;

    if (!destinoFinal || destinoFinal === 'nao_aplicavel') {
        const headers = Object.keys(resultadoExtracao.dados_extraidos[0] || {});
        const classificacaoIA = await classificarConteudo(headers);
        destinoFinal = determinarDestinoDados(classificacaoIA);
        tipoPrincipal = classificacaoIA;
    }

    const tempoTotal = Math.round((Date.now() - startTime) / 1000);

    await base44.entities.ImportacaoDocumento.update(processamentoId, {
      status_processamento: "revisao_manual",
      classificacao_automatica: tipoPrincipal,
      dados_extraidos: { dados_processados: resultadoExtracao.dados_extraidos },
      confianca_extracao: resultadoExtracao.confianca_extracao,
      observacoes_ia: resultadoExtracao.observacoes,
      tempo_processamento: tempoTotal,
      destino_dados: destinoFinal
    });

    return {
      dados: resultadoExtracao.dados_extraidos,
      nomeImportacao: file.name,
      destinoSugerido: destinoFinal,
      tiposDetectados: [{ tipo: tipoPrincipal, confianca: resultadoExtracao.confianca_extracao || 80, descricao: resultadoExtracao.observacoes }],
      processamentoId: processamentoId,
      estruturaDocumento: 'simples'
    };

  } catch (error) {
    console.error("Erro no motor de importação:", error);
    if (processamentoId) {
      await base44.entities.ImportacaoDocumento.update(processamentoId, {
          status_processamento: "erro",
          erro_detalhado: error.message
      });
    }
    throw error;
  }
};

export async function processarComIntegracaoCompleta(dados, destinoFinal, mapeamentoCampos, contextoOrigem = {}) {
  console.log(`📦 Processando ${dados.length} registros para ${destinoFinal}`);

  const resultados = {
    sucesso: 0,
    erros: 0,
    duplicados: 0,
    detalhes: []
  };

  try {
    const parseMonetaryValue = (value) => {
      if (typeof value === 'number') return value;
      if (!value) return 0;
      const cleaned = String(value).replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const parseDate = (dateStr) => {
      if (!dateStr) return new Date().toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return new Date(dateStr).toISOString().slice(0, 10);
      }
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
        const [dia, mes, ano] = dateStr.split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      try {
        return new Date(dateStr).toISOString().slice(0, 10);
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    };

    const dadosPreProcessados = dados.map(item => {
      const itemCopy = { ...item };
      
      const mappedItem = {};
      Object.keys(itemCopy).forEach(originalKey => {
        const targetKey = mapeamentoCampos?.[originalKey] || originalKey;
        mappedItem[targetKey] = itemCopy[originalKey];
      });

      if (mappedItem.valor_total !== undefined) {
        mappedItem.valor_total = parseMonetaryValue(mappedItem.valor_total);
      }
      if (mappedItem.valor_recorrente_mensal !== undefined) {
        mappedItem.valor_recorrente_mensal = parseMonetaryValue(mappedItem.valor_recorrente_mensal);
      }
      
      if (mappedItem.data_venda !== undefined) {
        mappedItem.data_venda = parseDate(mappedItem.data_venda);
      }
      if (mappedItem.data_orcamento !== undefined) {
        mappedItem.data_orcamento = parseDate(mappedItem.data_orcamento);
      }
      
      if ((destinoFinal === 'vendas' || destinoFinal === 'orcamentos') && !mappedItem.vendedor) {
        mappedItem.vendedor = contextoOrigem.nomeMapeamento || 'Vendedor Padrão';
      }
      
      if (destinoFinal === 'clientes' && !mappedItem.vendedor_responsavel) {
        mappedItem.vendedor_responsavel = contextoOrigem.nomeMapeamento || 'Não atribuído';
      }
      
      return mappedItem;
    });

    console.log('✅ Dados pré-processados (amostra):', dadosPreProcessados.slice(0, 2));

    const entidadesMap = {
      'clientes': 'Cliente',
      'vendas': 'Venda',
      'orcamentos': 'Orcamento',
      'vendedores': 'Vendedor',
      'produtos': 'Produto'
    };
    
    const entityName = entidadesMap[destinoFinal];
    const entidade = base44.entities[entityName];
    
    if (!entidade || typeof entidade.bulkCreate !== 'function') {
      throw new Error(`Entidade '${destinoFinal}' não possui método 'bulkCreate' ou não está corretamente configurada.`);
    }

    await entidade.bulkCreate(dadosPreProcessados);
    resultados.sucesso = dadosPreProcessados.length;

    console.log(`✅ ${resultados.sucesso} registros salvos com sucesso em ${destinoFinal}`);

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    resultados.erros = dados.length;
    throw error;
  }

  return resultados;
}