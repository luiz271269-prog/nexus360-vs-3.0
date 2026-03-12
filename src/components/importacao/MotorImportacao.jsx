import { base44 } from "@/api/base44Client";
import * as XLSX from 'xlsx';
import { extrairDadosPDF } from "@/functions/extrairDadosPDF";

// ─── Detecção de tipo ────────────────────────────────────────────────────────
const detectarTipoArquivo = (file) => {
  const extensao = file.name.split('.').pop().toLowerCase();
  const mapeamento = {
    'pdf': 'pdf', 'xlsx': 'excel', 'xls': 'excel', 'csv': 'csv',
    'docx': 'word', 'doc': 'word', 'jpg': 'imagem',
    'jpeg': 'imagem', 'png': 'imagem', 'xml': 'xml', 'json': 'json'
  };
  return mapeamento[extensao] || 'outro';
};

// ─── Extração XLSX via SheetJS ───────────────────────────────────────────────
const extrairDadosPlanilha = async (fileUrl, tipo, nomeArquivo) => {
  if (nomeArquivo.toLowerCase().endsWith('.xls')) {
    throw new Error('Arquivos .xls não são suportados. Salve como .xlsx ou .csv e tente novamente.');
  }

  if (tipo === 'csv') {
    const resultado = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: 'object',
        properties: {
          dados_extraidos: { type: 'array', items: { type: 'object', additionalProperties: true } }
        },
        required: ['dados_extraidos']
      }
    });

    if (resultado?.status === 'success' && resultado.output) {
      const dadosExtraidos = Array.isArray(resultado.output) ? resultado.output : resultado.output.dados_extraidos;
      return {
        dados_extraidos: dadosExtraidos || [],
        confianca_extracao: 90,
        tipo_conteudo_detectado: 'planilha_csv',
        observacoes: `Dados extraídos do CSV`
      };
    }
    throw new Error('Não foi possível extrair dados do CSV');
  }

  // XLSX via SheetJS com ArrayBuffer correto
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Falha ao baixar arquivo: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(uint8Array, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // header:1 dá controle total sobre os cabeçalhos
  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false
  });

  if (!jsonData || jsonData.length < 2) {
    throw new Error('Planilha vazia ou sem dados suficientes');
  }

  const headers = jsonData[0].map(h => String(h || '').trim()).filter(h => h);
  const rows = jsonData.slice(1);

  const dadosExtraidos = rows
    .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] !== undefined ? String(row[idx]) : '';
      });
      return obj;
    });

  if (dadosExtraidos.length === 0) throw new Error('Nenhum dado encontrado na planilha');

  return {
    dados_extraidos: dadosExtraidos,
    confianca_extracao: 95,
    tipo_conteudo_detectado: 'excel_tabela',
    observacoes: `${dadosExtraidos.length} linhas extraídas de ${headers.length} colunas (aba: ${sheetName})`
  };
};

// ─── Extração PDF/Imagem via Anthropic API (backend function) ────────────────
const extrairDadosAnthropicVision = async (fileUrl, tipo) => {
  const response = await extrairDadosPDF({ file_url: fileUrl, tipo });
  const resultado = response?.data;

  if (resultado?.success && resultado?.dados_extraidos) {
    return {
      dados_extraidos: resultado.dados_extraidos,
      confianca_extracao: resultado.confianca_extracao || 80,
      tipo_conteudo_detectado: resultado.tipo_conteudo_detectado || `${tipo}_tabela`,
      observacoes: resultado.observacoes || `Dados extraídos do ${tipo.toUpperCase()}`
    };
  }
  throw new Error(resultado?.error || `Falha ao extrair dados do ${tipo.toUpperCase()}`);
};

// ─── Extração genérica via InvokeLLM (Word e outros) ────────────────────────
const extrairDadosInvokeLLM = async (fileUrl) => {
  const prompt = `Analise o conteúdo deste documento e extraia dados estruturados em formato de tabela.
REGRAS: Identifique a tabela principal, extraia TODAS as linhas e colunas. NUNCA retorne dados_extraidos vazio.
RETORNE APENAS JSON VÁLIDO com esta estrutura:
{"dados_extraidos":[{"coluna1":"valor1"}],"confianca_extracao":85,"tipo_conteudo_detectado":"word_tabela","observacoes":"descrição"}`;

  const resultado = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [fileUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        dados_extraidos: { type: 'array', items: { type: 'object', additionalProperties: true } },
        confianca_extracao: { type: 'number' },
        tipo_conteudo_detectado: { type: 'string' },
        observacoes: { type: 'string' }
      },
      required: ['dados_extraidos']
    }
  });

  if (resultado?.dados_extraidos && Array.isArray(resultado.dados_extraidos)) {
    return resultado;
  }
  throw new Error('A IA não retornou um formato de dados válido.');
};

// ─── Orquestrador principal de extração ─────────────────────────────────────
const extrairDadosComIA = async (fileUrl, tipoArquivo, nomeArquivo) => {
  if (tipoArquivo === 'excel' || tipoArquivo === 'csv') {
    return await extrairDadosPlanilha(fileUrl, tipoArquivo, nomeArquivo);
  }

  if (tipoArquivo === 'pdf' || tipoArquivo === 'imagem') {
    return await extrairDadosAnthropicVision(fileUrl, tipoArquivo);
  }

  // Word e outros: InvokeLLM
  return await extrairDadosInvokeLLM(fileUrl);
};

// ─── Classificação de conteúdo ───────────────────────────────────────────────
const determinarDestinoDados = (tipoClassificacao) => {
  const mapeamento = {
    'lista_clientes': 'clientes', 'relatorio_vendas': 'vendas', 'sales_report': 'vendas',
    'pedido': 'vendas', 'nota_fiscal': 'vendas', 'planilha_metas': 'vendedores',
    'orcamento': 'orcamentos', 'fatura': 'vendas', 'lista_produtos': 'produtos',
    'vendas': 'vendas', 'clientes': 'clientes', 'vendedores': 'vendedores',
  };
  return mapeamento[String(tipoClassificacao).toLowerCase().trim()] || 'nao_aplicavel';
};

const classificarConteudo = async (headers) => {
  const validos = ['vendas', 'clientes', 'orcamentos', 'vendedores', 'produtos', 'nao_identificado'];
  const prompt = `Analise estes cabeçalhos de coluna: [${headers.join(', ')}]. Qual o tipo de dado mais provável? Responda APENAS com uma das seguintes opções: 'vendas', 'clientes', 'orcamentos', 'vendedores', 'produtos', 'nao_identificado'.`;
  try {
    const resultado = await base44.integrations.Core.InvokeLLM({ prompt });
    const limpo = String(resultado || '').trim().toLowerCase().replace(/['"]/g, '');
    return validos.includes(limpo) ? limpo : 'nao_identificado';
  } catch {
    return 'nao_identificado';
  }
};

// ─── Exports principais ──────────────────────────────────────────────────────
export const processarArquivo = async (file, contexto = null) => {
  let processamentoId = null;
  const startTime = Date.now();

  try {
    const tipoArquivo = detectarTipoArquivo(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    // SkillExecution: rastrear extração de arquivo
    ;(async () => {
      try {
        await base44.entities.SkillExecution.create({
          skill_name: 'importacao_extracao_arquivo',
          triggered_by: 'usuario_upload',
          execution_mode: 'autonomous_safe',
          context: {
            tipo_arquivo: tipoArquivo,
            nome_arquivo: file.name,
            tamanho_bytes: file.size,
            destino_contexto: contexto
          },
          success: false, // será atualizado ao final
          duration_ms: 0 // será atualizado ao final
        }).catch(() => {});
      } catch (e) {
        console.warn('[importacao] SkillExecution init falhou:', e.message);
      }
    })();

    const novoProcessamento = await base44.entities.ImportacaoDocumento.create({
      nome_arquivo: file.name,
      tipo_documento: tipoArquivo,
      status_processamento: 'processando',
      data_processamento: new Date().toISOString(),
      url_arquivo: file_url,
      destino_dados: contexto
    });
    processamentoId = novoProcessamento.id;

    const resultadoExtracao = await extrairDadosComIA(file_url, tipoArquivo, file.name);

    if (!resultadoExtracao.dados_extraidos || resultadoExtracao.dados_extraidos.length === 0) {
      throw new Error('Nenhum dado estruturado pôde ser extraído do arquivo.');
    }

    let destinoFinal = contexto;
    let tipoPrincipal = contexto;

    if (!destinoFinal || destinoFinal === 'nao_aplicavel') {
      const headers = Object.keys(resultadoExtracao.dados_extraidos[0] || {});
      const classificacaoIA = await classificarConteudo(headers);
      destinoFinal = determinarDestinoDados(classificacaoIA);
      tipoPrincipal = classificacaoIA;
    }

    const tempoTotal = Date.now() - startTime;

    await base44.entities.ImportacaoDocumento.update(processamentoId, {
      status_processamento: 'revisao_manual',
      classificacao_automatica: tipoPrincipal,
      dados_extraidos: { dados_processados: resultadoExtracao.dados_extraidos },
      confianca_extracao: resultadoExtracao.confianca_extracao,
      observacoes_ia: resultadoExtracao.observacoes,
      tempo_processamento: Math.round(tempoTotal / 1000),
      destino_dados: destinoFinal
    });

    // SkillExecution: registrar sucesso da extração
    ;(async () => {
      try {
        await base44.entities.SkillExecution.create({
          skill_name: 'importacao_extracao_arquivo',
          triggered_by: 'usuario_upload',
          execution_mode: 'autonomous_safe',
          context: {
            tipo_arquivo: tipoArquivo,
            nome_arquivo: file.name,
            destino_final: destinoFinal,
            classificacao_detectada: tipoPrincipal
          },
          success: true,
          duration_ms: tempoTotal,
          metricas: {
            linhas_extraidas: resultadoExtracao.dados_extraidos.length,
            confianca_extracao: resultadoExtracao.confianca_extracao || 80,
            tipo_conteudo: resultadoExtracao.tipo_conteudo_detectado
          }
        }).catch(() => {});
      } catch (e) {
        console.warn('[importacao] SkillExecution sucesso falhou:', e.message);
      }
    })();

    return {
      dados: resultadoExtracao.dados_extraidos,
      nomeImportacao: file.name,
      destinoSugerido: destinoFinal,
      tiposDetectados: [{ tipo: tipoPrincipal, confianca: resultadoExtracao.confianca_extracao || 80, descricao: resultadoExtracao.observacoes }],
      processamentoId,
      estruturaDocumento: 'simples'
    };

  } catch (error) {
    console.error('Erro no motor de importação:', error);
    if (processamentoId) {
      await base44.entities.ImportacaoDocumento.update(processamentoId, {
        status_processamento: 'erro',
        erro_detalhado: `${error.message || 'Erro desconhecido'}. Arquivo: ${file.name}`
      });
    }

    // SkillExecution: registrar falha
    ;(async () => {
      try {
        await base44.entities.SkillExecution.create({
          skill_name: 'importacao_extracao_arquivo',
          triggered_by: 'usuario_upload',
          execution_mode: 'autonomous_safe',
          context: {
            tipo_arquivo: detectarTipoArquivo(file),
            nome_arquivo: file.name
          },
          success: false,
          error_message: error.message,
          duration_ms: Date.now() - startTime,
          metricas: {
            erro_tipo: error.constructor.name
          }
        }).catch(() => {});
      } catch (e) {
        console.warn('[importacao] SkillExecution erro falhou:', e.message);
      }
    })();

    throw error;
  }
};

export async function processarComIntegracaoCompleta(dados, destinoFinal, mapeamentoCampos, contextoOrigem = {}) {
  console.log(`📦 Processando ${dados.length} registros para ${destinoFinal}`);

  const resultados = { sucesso: 0, erros: 0, duplicados: 0, detalhes: [] };

  try {
    const parseMonetaryValue = (value) => {
      if (typeof value === 'number') return value;
      if (!value) return 0;
      const cleaned = String(value).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').replace(/[()]/g, '-').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const parseDate = (dateStr) => {
      if (!dateStr) return new Date().toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr).toISOString().slice(0, 10);
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
        const [dia, mes, ano] = dateStr.split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      try { return new Date(dateStr).toISOString().slice(0, 10); } catch { return new Date().toISOString().slice(0, 10); }
    };

    const dadosPreProcessados = dados.map(item => {
      const mappedItem = {};
      Object.keys(item).forEach(originalKey => {
        const targetKey = mapeamentoCampos?.[originalKey] || originalKey;
        mappedItem[targetKey] = item[originalKey];
      });

      if (mappedItem.valor_total !== undefined) mappedItem.valor_total = parseMonetaryValue(mappedItem.valor_total);
      if (mappedItem.valor_recorrente_mensal !== undefined) mappedItem.valor_recorrente_mensal = parseMonetaryValue(mappedItem.valor_recorrente_mensal);
      if (mappedItem.data_venda !== undefined) mappedItem.data_venda = parseDate(mappedItem.data_venda);
      if (mappedItem.data_orcamento !== undefined) mappedItem.data_orcamento = parseDate(mappedItem.data_orcamento);

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
      'clientes': 'Cliente', 'vendas': 'Venda',
      'orcamentos': 'Orcamento', 'vendedores': 'Vendedor', 'produtos': 'Produto'
    };

    const entityName = entidadesMap[destinoFinal];
    if (!entityName) throw new Error(`Destino '${destinoFinal}' não mapeado para nenhuma entidade válida.`);

    const entidade = base44.entities[entityName];
    if (!entidade || typeof entidade.bulkCreate !== 'function') {
      throw new Error(`Entidade '${entityName}' não possui método 'bulkCreate' ou não está disponível.`);
    }

    await entidade.bulkCreate(dadosPreProcessados);
    resultados.sucesso = dadosPreProcessados.length;
    console.log(`✅ ${resultados.sucesso} registros salvos com sucesso em ${entityName}`);

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    resultados.erros = dados.length;
    throw error;
  }

  return resultados;
}