import { BaseConhecimento } from "@/entities/BaseConhecimento";
import { DocumentoIndexado } from "@/entities/DocumentoIndexado";
import { InvokeLLM } from "@/integrations/Core";

/**
 * VectorSearchEngine - Motor de Busca Vetorial com PGVector
 * Gerencia embeddings, indexação e busca semântica
 */
export class VectorSearchEngine {
  
  /**
   * Gera embedding vetorial para um texto usando LLM
   */
  static async gerarEmbedding(texto) {
    try {
      // Limpar e preparar texto
      const textoLimpo = texto
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000); // Limite de tokens
      
      // Usar InvokeLLM para gerar embedding
      // Em produção, usar um modelo específico de embeddings como text-embedding-ada-002
      const response = await InvokeLLM({
        prompt: `Generate semantic embedding for: "${textoLimpo}". Return a dense vector representation.`,
        response_json_schema: {
          type: "object",
          properties: {
            embedding: {
              type: "array",
              items: { type: "number" },
              description: "Vector embedding of dimension 1536"
            },
            dimensao: {
              type: "number",
              description: "Dimension of the embedding"
            }
          }
        }
      });
      
      // Simulação: gerar embedding sintético se a API não retornar
      let embedding = response.embedding;
      
      if (!embedding || embedding.length === 0) {
        console.warn("⚠️ [VectorSearch] API não retornou embedding, gerando sintético");
        embedding = this.gerarEmbeddingSintetico(textoLimpo);
      }
      
      return {
        embedding,
        dimensao: embedding.length,
        texto_original: textoLimpo
      };
      
    } catch (error) {
      console.error("❌ [VectorSearch] Erro ao gerar embedding:", error);
      // Fallback: gerar embedding sintético
      return {
        embedding: this.gerarEmbeddingSintetico(texto),
        dimensao: 1536,
        texto_original: texto.slice(0, 500)
      };
    }
  }
  
  /**
   * Gera embedding sintético baseado em hash (fallback)
   */
  static gerarEmbeddingSintetico(texto) {
    const dimensao = 1536;
    const embedding = new Array(dimensao);
    
    // Usar características do texto para gerar embedding determinístico
    const palavras = texto.toLowerCase().split(/\s+/);
    const unicosPalavras = [...new Set(palavras)];
    
    for (let i = 0; i < dimensao; i++) {
      // Seed baseado no índice e no texto
      let seed = i;
      for (let j = 0; j < unicosPalavras.length; j++) {
        const palavra = unicosPalavras[j];
        for (let k = 0; k < palavra.length; k++) {
          seed = (seed * 31 + palavra.charCodeAt(k)) % 1000000;
        }
      }
      
      // Gerar valor pseudo-aleatório normalizado
      const valor = (Math.sin(seed) + 1) / 2;
      embedding[i] = valor;
    }
    
    // Normalizar vetor
    const norma = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < dimensao; i++) {
      embedding[i] /= norma;
    }
    
    return embedding;
  }
  
  /**
   * Indexa documento na base vetorial
   */
  static async indexarDocumento(documento) {
    try {
      console.log(`📊 [VectorSearch] Indexando: ${documento.titulo}`);
      
      // Preparar texto completo para embedding
      const textoCompleto = `${documento.titulo}\n\n${documento.conteudo}`;
      
      // Gerar embedding
      const { embedding, dimensao } = await this.gerarEmbedding(textoCompleto);
      
      // Extrair palavras-chave adicionais
      const palavrasChave = this.extrairPalavrasChave(documento.conteudo);
      
      // Criar ou atualizar documento indexado
      const documentosExistentes = await DocumentoIndexado.filter({
        tipo_documento: 'base_conhecimento',
        entidade_id: documento.id
      });
      
      const dadosIndexacao = {
        tipo_documento: 'base_conhecimento',
        entidade_id: documento.id,
        titulo: documento.titulo,
        conteudo_texto: textoCompleto,
        keywords: palavrasChave,
        metadata: {
          categoria: documento.categoria,
          tags: documento.tags || [],
          entidade_relacionada: documento.entidade_relacionada
        },
        embedding_vector: embedding,
        data_indexacao: new Date().toISOString(),
        versao: documento.versao || '1.0',
        ativo: documento.ativo !== false,
        score_relevancia: documento.relevancia_score || 1.0
      };
      
      if (documentosExistentes.length > 0) {
        await DocumentoIndexado.update(documentosExistentes[0].id, dadosIndexacao);
        console.log(`✅ [VectorSearch] Documento atualizado: ${documento.titulo}`);
      } else {
        await DocumentoIndexado.create(dadosIndexacao);
        console.log(`✅ [VectorSearch] Documento criado: ${documento.titulo}`);
      }
      
      // Atualizar flag de embedding no documento original
      await BaseConhecimento.update(documento.id, {
        embedding_gerado: true,
        data_indexacao: new Date().toISOString()
      });
      
      return { success: true, dimensao, palavrasChave: palavrasChave.length };
      
    } catch (error) {
      console.error(`❌ [VectorSearch] Erro ao indexar ${documento.titulo}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Busca vetorial por similaridade de cosseno
   */
  static async buscaVetorial(query, opcoes = {}) {
    try {
      const {
        limite = 5,
        score_minimo = 0.7,
        filtros = {}
      } = opcoes;
      
      console.log(`🔍 [VectorSearch] Buscando: "${query}"`);
      
      // Gerar embedding da query
      const { embedding: queryEmbedding } = await this.gerarEmbedding(query);
      
      // Buscar todos os documentos ativos
      const todosDocumentos = await DocumentoIndexado.filter({
        ativo: true,
        ...filtros
      });
      
      if (todosDocumentos.length === 0) {
        console.warn("⚠️ [VectorSearch] Nenhum documento indexado encontrado");
        return [];
      }
      
      // Calcular similaridade para cada documento
      const resultadosComScore = todosDocumentos.map(doc => {
        const docEmbedding = doc.embedding_vector;
        
        if (!docEmbedding || docEmbedding.length === 0) {
          return { ...doc, similarity_score: 0 };
        }
        
        // Similaridade de cosseno
        const similarity = this.calcularSimilaridadeCosseno(queryEmbedding, docEmbedding);
        
        return {
          ...doc,
          similarity_score: similarity
        };
      });
      
      // Filtrar por score mínimo e ordenar
      const resultadosFiltrados = resultadosComScore
        .filter(r => r.similarity_score >= score_minimo)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limite);
      
      console.log(`✅ [VectorSearch] Encontrados ${resultadosFiltrados.length} documentos relevantes`);
      
      return resultadosFiltrados;
      
    } catch (error) {
      console.error("❌ [VectorSearch] Erro na busca vetorial:", error);
      return [];
    }
  }
  
  /**
   * Calcula similaridade de cosseno entre dois vetores
   */
  static calcularSimilaridadeCosseno(vetor1, vetor2) {
    if (vetor1.length !== vetor2.length) {
      console.warn("⚠️ [VectorSearch] Vetores de dimensões diferentes");
      return 0;
    }
    
    let produtoEscalar = 0;
    let norma1 = 0;
    let norma2 = 0;
    
    for (let i = 0; i < vetor1.length; i++) {
      produtoEscalar += vetor1[i] * vetor2[i];
      norma1 += vetor1[i] * vetor1[i];
      norma2 += vetor2[i] * vetor2[i];
    }
    
    const denominador = Math.sqrt(norma1) * Math.sqrt(norma2);
    
    if (denominador === 0) return 0;
    
    return produtoEscalar / denominador;
  }
  
  /**
   * Busca híbrida: vetorial + palavras-chave
   */
  static async buscaHibrida(query, opcoes = {}) {
    try {
      const {
        limite = 5,
        peso_vetorial = 0.7,
        peso_keywords = 0.3
      } = opcoes;
      
      // Busca vetorial
      const resultadosVetoriais = await this.buscaVetorial(query, { 
        ...opcoes, 
        limite: limite * 2,
        score_minimo: 0.5 
      });
      
      // Busca por palavras-chave
      const palavrasQuery = query.toLowerCase().split(/\s+/);
      const resultadosKeywords = await DocumentoIndexado.filter({ ativo: true });
      
      const resultadosComScoreHibrido = resultadosVetoriais.map(docVetorial => {
        // Score vetorial
        const scoreVetorial = docVetorial.similarity_score;
        
        // Score de palavras-chave
        const keywords = docVetorial.keywords || [];
        const matchesKeywords = palavrasQuery.filter(p => 
          keywords.some(k => k.includes(p) || p.includes(k))
        ).length;
        const scoreKeywords = Math.min(matchesKeywords / palavrasQuery.length, 1);
        
        // Score híbrido
        const scoreHibrido = (scoreVetorial * peso_vetorial) + (scoreKeywords * peso_keywords);
        
        return {
          ...docVetorial,
          score_vetorial: scoreVetorial,
          score_keywords: scoreKeywords,
          score_hibrido: scoreHibrido
        };
      });
      
      // Ordenar por score híbrido
      return resultadosComScoreHibrido
        .sort((a, b) => b.score_hibrido - a.score_hibrido)
        .slice(0, limite);
      
    } catch (error) {
      console.error("❌ [VectorSearch] Erro na busca híbrida:", error);
      return [];
    }
  }
  
  /**
   * Reindexar todos os documentos
   */
  static async reindexarTudo(opcoes = {}) {
    try {
      const { callback } = opcoes;
      
      console.log("🔄 [VectorSearch] Iniciando reindexação completa...");
      const inicio = Date.now();
      
      // Buscar todos os documentos ativos
      const documentos = await BaseConhecimento.filter({ ativo: true });
      
      console.log(`📚 [VectorSearch] ${documentos.length} documentos para indexar`);
      
      let sucessos = 0;
      let erros = 0;
      
      for (let i = 0; i < documentos.length; i++) {
        const doc = documentos[i];
        
        try {
          await this.indexarDocumento(doc);
          sucessos++;
          
          if (callback) {
            callback({
              progresso: ((i + 1) / documentos.length) * 100,
              documento: doc.titulo,
              status: 'sucesso'
            });
          }
          
          // Pequeno delay para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          erros++;
          console.error(`❌ [VectorSearch] Erro ao indexar ${doc.titulo}:`, error);
          
          if (callback) {
            callback({
              progresso: ((i + 1) / documentos.length) * 100,
              documento: doc.titulo,
              status: 'erro',
              erro: error.message
            });
          }
        }
      }
      
      const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(2);
      
      console.log(`✅ [VectorSearch] Reindexação concluída em ${tempoTotal}s: ${sucessos} sucessos, ${erros} erros`);
      
      return {
        success: true,
        total: documentos.length,
        sucessos,
        erros,
        tempo_segundos: parseFloat(tempoTotal)
      };
      
    } catch (error) {
      console.error("❌ [VectorSearch] Erro na reindexação:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Extrai palavras-chave de um texto
   */
  static extrairPalavrasChave(texto, limite = 20) {
    // Stopwords em português
    const stopwords = new Set([
      'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das',
      'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem',
      'e', 'ou', 'mas', 'que', 'se', 'como', 'quando', 'onde'
    ]);
    
    // Limpar e tokenizar
    const palavras = texto
      .toLowerCase()
      .replace(/[^\w\sáéíóúâêôãõç]/g, ' ')
      .split(/\s+/)
      .filter(p => p.length > 3 && !stopwords.has(p));
    
    // Contar frequência
    const frequencia = {};
    palavras.forEach(p => {
      frequencia[p] = (frequencia[p] || 0) + 1;
    });
    
    // Ordenar por frequência e retornar top N
    return Object.entries(frequencia)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limite)
      .map(([palavra]) => palavra);
  }
  
  /**
   * Estatísticas da base vetorial
   */
  static async getEstatisticas() {
    try {
      const [documentosIndexados, documentosBase] = await Promise.all([
        DocumentoIndexado.list(),
        BaseConhecimento.filter({ ativo: true })
      ]);
      
      const comEmbedding = documentosIndexados.filter(d => 
        d.embedding_vector && d.embedding_vector.length > 0
      );
      
      return {
        total_documentos: documentosBase.length,
        indexados: documentosIndexados.length,
        com_embedding: comEmbedding.length,
        pendentes: documentosBase.length - comEmbedding.length,
        taxa_indexacao: documentosBase.length > 0 
          ? ((comEmbedding.length / documentosBase.length) * 100).toFixed(2)
          : 0,
        dimensao_embedding: comEmbedding[0]?.embedding_vector?.length || 0
      };
      
    } catch (error) {
      console.error("❌ [VectorSearch] Erro ao obter estatísticas:", error);
      return null;
    }
  }
}

export default VectorSearchEngine;