import { BaseConhecimento } from "@/entities/BaseConhecimento";
import { DocumentoIndexado } from "@/entities/DocumentoIndexado";
import { Produto } from "@/entities/Produto";
import { Cliente } from "@/entities/Cliente";
import { Orcamento } from "@/entities/Orcamento";
import { InvokeLLM } from "@/integrations/Core";

/**
 * MotorRAGV2 - Retrieval-Augmented Generation Avançado
 * Versão 2.0 com Busca Híbrida (Vetorial + Palavras-Chave) e Multi-Turn
 */
export class MotorRAGV2 {
  
  /**
   * Busca conhecimento com estratégia híbrida
   * @param {string} query - Pergunta do usuário
   * @param {Object} opcoes - Opções de busca
   * @param {Array} historico - Histórico da conversa para contexto multi-turn
   */
  static async buscarConhecimento(query, opcoes = {}, historico = []) {
    try {
      const {
        limite = 5,
        relevancia_minima = 0.6,
        categoria = null,
        incluir_entidades = true
      } = opcoes;
      
      console.log("🔍 [MotorRAGV2] Iniciando busca híbrida para:", query);
      
      // 1. Enriquecer query com contexto do histórico (Multi-Turn)
      const queryEnriquecida = await this.enriquecerQueryComHistorico(query, historico);
      
      console.log("📝 [MotorRAGV2] Query enriquecida:", queryEnriquecida);
      
      // 2. Extrair entidades nomeadas e palavras-chave exatas
      const entidadesExtraidas = await this.extrairEntidades(queryEnriquecida);
      
      console.log("🏷️ [MotorRAGV2] Entidades extraídas:", entidadesExtraidas);
      
      // 3. Busca em paralelo (Performance)
      const [
        conhecimentoBase,
        documentosIndexados,
        resultadosExatos
      ] = await Promise.all([
        this.buscarNaBaseConhecimento(queryEnriquecida, categoria, limite * 2),
        this.buscarDocumentosIndexados(queryEnriquecida, limite),
        this.buscarPorEntidadesExatas(entidadesExtraidas, incluir_entidades)
      ]);
      
      // 4. Combinar e ranquear resultados (Híbrido)
      const resultadosCombinados = this.combinarRanquearResultados(
        conhecimentoBase,
        documentosIndexados,
        resultadosExatos,
        queryEnriquecida,
        entidadesExtraidas
      );
      
      // 5. Filtrar por relevância mínima
      const resultadosFiltrados = resultadosCombinados
        .filter(r => r.relevancia >= relevancia_minima)
        .slice(0, limite);
      
      console.log(`✅ [MotorRAGV2] Encontrados ${resultadosFiltrados.length} resultados relevantes`);
      
      return resultadosFiltrados;
      
    } catch (error) {
      console.error("❌ [MotorRAGV2] Erro ao buscar conhecimento:", error);
      return [];
    }
  }

  /**
   * Enriquece a query com contexto do histórico (Multi-Turn)
   */
  static async enriquecerQueryComHistorico(query, historico) {
    if (!historico || historico.length === 0) {
      return query;
    }
    
    try {
      // Pegar últimas 3 mensagens para contexto
      const mensagensRecentes = historico.slice(-3);
      
      const historicoTexto = mensagensRecentes
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');
      
      const prompt = `Dada a seguinte conversa em andamento, reformule a última pergunta do usuário para que ela seja compreensível de forma isolada, incluindo o contexto necessário.

HISTÓRICO DA CONVERSA:
${historicoTexto}

PERGUNTA ATUAL: ${query}

Retorne apenas a pergunta reformulada, sem explicações adicionais. Se a pergunta já está clara e independente, retorne-a como está.

PERGUNTA REFORMULADA:`;

      const queryEnriquecida = await InvokeLLM({ prompt });
      
      return queryEnriquecida.trim();
      
    } catch (error) {
      console.error("❌ [MotorRAGV2] Erro ao enriquecer query:", error);
      return query;
    }
  }

  /**
   * Extrai entidades nomeadas (IDs, códigos, nomes específicos)
   */
  static async extrairEntidades(query) {
    try {
      const prompt = `Extraia entidades específicas da seguinte pergunta:

PERGUNTA: "${query}"

Identifique e extraia:
- Códigos de produto (ex: COD-123, REF-456)
- Números de orçamento (ex: ORC-2024-001)
- Números de pedido/venda (ex: PED-123)
- CNPJs (ex: 12.345.678/0001-90)
- Nomes de empresas mencionados
- Nomes de pessoas mencionados
- Valores monetários mencionados

Retorne apenas as entidades encontradas, ou um objeto vazio se nenhuma for encontrada.`;

      const resultado = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            codigos_produto: { type: "array", items: { type: "string" } },
            numeros_orcamento: { type: "array", items: { type: "string" } },
            numeros_pedido: { type: "array", items: { type: "string" } },
            cnpjs: { type: "array", items: { type: "string" } },
            empresas: { type: "array", items: { type: "string" } },
            pessoas: { type: "array", items: { type: "string" } },
            valores: { type: "array", items: { type: "number" } }
          }
        }
      });
      
      return resultado;
      
    } catch (error) {
      console.error("❌ [MotorRAGV2] Erro ao extrair entidades:", error);
      return {};
    }
  }

  /**
   * Busca na Base de Conhecimento com busca textual avançada
   */
  static async buscarNaBaseConhecimento(query, categoria, limite) {
    try {
      let filtros = { ativo: true, aprovado: true };
      
      if (categoria) {
        if (Array.isArray(categoria)) {
          const resultados = [];
          for (const cat of categoria) {
            const docs = await BaseConhecimento.filter({ ...filtros, categoria: cat }, '-relevancia_score', limite);
            resultados.push(...docs);
          }
          return resultados;
        } else {
          filtros.categoria = categoria;
        }
      }
      
      const documentos = await BaseConhecimento.filter(filtros, '-relevancia_score', limite * 3);
      
      // Busca textual aprimorada
      const palavrasChave = this.extrairPalavrasChave(query);
      
      const documentosComScore = documentos.map(doc => {
        const scoreTextual = this.calcularScoreTextual(doc, palavrasChave, query);
        const scoreRelevancia = doc.relevancia_score || 50;
        const scoreVezes = Math.min((doc.vezes_utilizado || 0) * 2, 20); // Bonus por uso
        
        // Score híbrido: 50% textual + 40% relevância + 10% uso
        const scoreTotal = (scoreTextual * 0.5) + (scoreRelevancia * 0.4) + (scoreVezes * 0.1);
        
        return {
          ...doc,
          score_busca: scoreTotal,
          relevancia: scoreTotal / 100,
          fonte: 'base_conhecimento'
        };
      });
      
      return documentosComScore
        .sort((a, b) => b.score_busca - a.score_busca)
        .slice(0, limite);
      
    } catch (error) {
      console.error("❌ [MotorRAGV2] Erro ao buscar na base:", error);
      return [];
    }
  }

  /**
   * Busca em documentos indexados (com embeddings se disponível)
   */
  static async buscarDocumentosIndexados(query, limite) {
    try {
      const documentos = await DocumentoIndexado.filter(
        { ativo: true },
        '-score_relevancia',
        limite * 2
      );
      
      if (documentos.length === 0) {
        return [];
      }
      
      const palavrasChave = this.extrairPalavrasChave(query);
      
      const documentosComScore = documentos.map(doc => {
        const scoreTextual = this.calcularScoreTextual(doc, palavrasChave, query);
        const scoreRelevanciaBase = doc.score_relevancia || 1.0;
        
        const scoreTotal = scoreTextual * scoreRelevanciaBase;
        
        return {
          titulo: doc.titulo,
          conteudo: doc.conteudo_texto,
          fonte: `documento_${doc.tipo_documento}`,
          relevancia: scoreTotal / 100,
          metadata: doc.metadata
        };
      });
      
      return documentosComScore
        .sort((a, b) => b.relevancia - a.relevancia)
        .slice(0, limite);
      
    } catch (error) {
      console.error("❌ [MotorRAGV2] Erro ao buscar documentos indexados:", error);
      return [];
    }
  }

  /**
   * Busca por entidades exatas (Produtos, Clientes, Orçamentos)
   */
  static async buscarPorEntidadesExatas(entidades, incluir) {
    if (!incluir) return [];
    
    try {
      const resultados = [];
      
      // Buscar produtos por código
      if (entidades.codigos_produto && entidades.codigos_produto.length > 0) {
        for (const codigo of entidades.codigos_produto) {
          const produtos = await Produto.filter({ codigo: codigo });
          resultados.push(...produtos.map(p => ({
            titulo: `Produto: ${p.nome}`,
            conteudo: `Código: ${p.codigo}\nDescrição: ${p.descricao}\nPreço: R$ ${p.preco_venda}\nCategoria: ${p.categoria}`,
            fonte: 'produto',
            relevancia: 0.95, // Alta relevância para match exato
            metadata: { tipo: 'produto', id: p.id }
          })));
        }
      }
      
      // Buscar orçamentos por número
      if (entidades.numeros_orcamento && entidades.numeros_orcamento.length > 0) {
        for (const numero of entidades.numeros_orcamento) {
          const orcamentos = await Orcamento.filter({ numero_orcamento: numero });
          resultados.push(...orcamentos.map(o => ({
            titulo: `Orçamento: ${o.numero_orcamento}`,
            conteudo: `Cliente: ${o.cliente_nome}\nValor: R$ ${o.valor_total}\nStatus: ${o.status}\nVendedor: ${o.vendedor}`,
            fonte: 'orcamento',
            relevancia: 0.95,
            metadata: { tipo: 'orcamento', id: o.id }
          })));
        }
      }
      
      // Buscar clientes por CNPJ ou nome
      if (entidades.cnpjs && entidades.cnpjs.length > 0) {
        for (const cnpj of entidades.cnpjs) {
          const clientes = await Cliente.filter({ cnpj: cnpj });
          resultados.push(...clientes.map(c => ({
            titulo: `Cliente: ${c.razao_social}`,
            conteudo: `CNPJ: ${c.cnpj}\nSegmento: ${c.segmento}\nVendedor: ${c.vendedor_responsavel}\nStatus: ${c.status}`,
            fonte: 'cliente',
            relevancia: 0.95,
            metadata: { tipo: 'cliente', id: c.id }
          })));
        }
      }
      
      if (entidades.empresas && entidades.empresas.length > 0) {
        for (const empresa of entidades.empresas) {
          const clientes = await Cliente.list();
          const matches = clientes.filter(c => 
            c.razao_social?.toLowerCase().includes(empresa.toLowerCase()) ||
            c.nome_fantasia?.toLowerCase().includes(empresa.toLowerCase())
          );
          resultados.push(...matches.slice(0, 2).map(c => ({
            titulo: `Cliente: ${c.razao_social}`,
            conteudo: `Nome Fantasia: ${c.nome_fantasia}\nSegmento: ${c.segmento}\nVendedor: ${c.vendedor_responsavel}`,
            fonte: 'cliente',
            relevancia: 0.85,
            metadata: { tipo: 'cliente', id: c.id }
          })));
        }
      }
      
      return resultados;
      
    } catch (error) {
      console.error("❌ [MotorRAGV2] Erro ao buscar por entidades:", error);
      return [];
    }
  }

  /**
   * Combina e ranqueia resultados de múltiplas fontes
   */
  static combinarRanquearResultados(baseConhecimento, documentos, exatos, query, entidades) {
    // Combinardedos todos
    const todos = [
      ...baseConhecimento,
      ...documentos,
      ...exatos
    ];
    
    // Remover duplicatas (por título)
    const unicos = [];
    const titulosVistos = new Set();
    
    for (const resultado of todos) {
      const tituloNormalizado = resultado.titulo?.toLowerCase().trim();
      if (tituloNormalizado && !titulosVistos.has(tituloNormalizado)) {
        unicos.push(resultado);
        titulosVistos.add(tituloNormalizado);
      }
    }
    
    // Ordenar por relevância
    return unicos.sort((a, b) => b.relevancia - a.relevancia);
  }

  /**
   * Extrai palavras-chave da query
   */
  static extrairPalavrasChave(query) {
    const stopWords = ['o', 'a', 'os', 'as', 'de', 'da', 'do', 'em', 'para', 'com', 'por', 'uma', 'um', 'como', 'qual', 'que', 'e', 'é'];
    
    return query
      .toLowerCase()
      .replace(/[^\wà-ÿ\s]/g, ' ')
      .split(/\s+/)
      .filter(palavra => palavra.length > 3 && !stopWords.includes(palavra));
  }

  /**
   * Calcula score textual baseado em correspondência de palavras
   */
  static calcularScoreTextual(documento, palavrasChave, queryOriginal) {
    const textoDocumento = `${documento.titulo || ''} ${documento.conteudo || ''} ${documento.conteudo_texto || ''} ${JSON.stringify(documento.tags || [])}`.toLowerCase();
    
    if (palavrasChave.length === 0) {
      // Se não há palavras-chave, usar similaridade simples
      return queryOriginal.toLowerCase().split(' ').filter(p => textoDocumento.includes(p)).length * 10;
    }
    
    // Contar matches de palavras-chave
    let matches = 0;
    let matchesExatos = 0;
    
    for (const palavra of palavrasChave) {
      if (textoDocumento.includes(palavra)) {
        matches++;
        
        // Bonus para match em título ou tags
        if ((documento.titulo || '').toLowerCase().includes(palavra) ||
            (documento.tags || []).some(t => t.toLowerCase().includes(palavra))) {
          matchesExatos++;
        }
      }
    }
    
    const scoreBase = (matches / palavrasChave.length) * 70;
    const bonusExatos = matchesExatos * 10;
    
    return Math.min(scoreBase + bonusExatos, 100);
  }

  /**
   * Incrementa contador de uso de um documento
   */
  static async registrarUso(documentoId, fonte) {
    try {
      if (fonte === 'base_conhecimento') {
        const doc = await BaseConhecimento.get(documentoId);
        if (doc) {
          await BaseConhecimento.update(documentoId, {
            vezes_utilizado: (doc.vezes_utilizado || 0) + 1,
            ultima_utilizacao: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error("❌ [MotorRAGV2] Erro ao registrar uso:", error);
    }
  }
}

export default MotorRAGV2;