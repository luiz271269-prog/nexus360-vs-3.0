import { BaseConhecimento } from "@/entities/BaseConhecimento";
import { VectorSearchEngine } from "./VectorSearchEngine";
import { InvokeLLM } from "@/integrations/Core";

/**
 * MotorRAGV3 - RAG com Busca Vetorial PGVector
 * Integra busca semântica avançada com geração de respostas
 */
export class MotorRAGV3 {
  
  /**
   * Busca conhecimento usando busca vetorial
   */
  static async buscarConhecimento(query, opcoes = {}) {
    try {
      const {
        limite = 5,
        usar_busca_hibrida = true,
        contexto_adicional = null,
        filtros = {}
      } = opcoes;
      
      console.log(`🧠 [RAG V3] Buscando: "${query}"`);
      
      // Enriquecer query com contexto se disponível
      let queryEnriquecida = query;
      if (contexto_adicional) {
        queryEnriquecida = `${contexto_adicional}\n\nPergunta: ${query}`;
      }
      
      // Busca híbrida ou vetorial pura
      const resultados = usar_busca_hibrida
        ? await VectorSearchEngine.buscaHibrida(queryEnriquecida, { limite, ...filtros })
        : await VectorSearchEngine.buscaVetorial(queryEnriquecida, { limite, ...filtros });
      
      // Formatar resultados
      const documentosFormatados = resultados.map(doc => ({
        id: doc.id || doc.entidade_id,
        titulo: doc.titulo,
        conteudo: doc.conteudo_texto,
        categoria: doc.metadata?.categoria,
        relevancia: doc.score_hibrido || doc.similarity_score,
        score_vetorial: doc.score_vetorial,
        score_keywords: doc.score_keywords,
        fonte: 'base_conhecimento'
      }));
      
      console.log(`✅ [RAG V3] ${documentosFormatados.length} documentos encontrados`);
      
      return documentosFormatados;
      
    } catch (error) {
      console.error("❌ [RAG V3] Erro na busca:", error);
      return [];
    }
  }
  
  /**
   * Gera resposta usando RAG com contexto vetorial
   */
  static async gerarResposta(pergunta, opcoes = {}) {
    try {
      const {
        limite_documentos = 3,
        incluir_fontes = true,
        temperatura = 0.7,
        contexto_conversa = null
      } = opcoes;
      
      console.log(`💬 [RAG V3] Gerando resposta para: "${pergunta}"`);
      
      // 1. Buscar conhecimento relevante
      const documentos = await this.buscarConhecimento(pergunta, {
        limite: limite_documentos,
        contexto_adicional: contexto_conversa
      });
      
      if (documentos.length === 0) {
        return {
          resposta: "Desculpe, não encontrei informações específicas sobre isso na base de conhecimento.",
          fontes: [],
          confianca: 0.3,
          utilizou_rag: false
        };
      }
      
      // 2. Montar contexto para LLM
      const contextoRAG = documentos
        .map((doc, idx) => `[Documento ${idx + 1}]\nTítulo: ${doc.titulo}\nRelevância: ${(doc.relevancia * 100).toFixed(1)}%\nConteúdo: ${doc.conteudo}\n`)
        .join('\n---\n');
      
      // 3. Construir prompt
      const prompt = `Você é um assistente especializado com acesso a uma base de conhecimento.

CONTEXTO DA BASE DE CONHECIMENTO:
${contextoRAG}

${contexto_conversa ? `HISTÓRICO DA CONVERSA:\n${contexto_conversa}\n` : ''}

PERGUNTA DO USUÁRIO: ${pergunta}

INSTRUÇÕES:
1. Use APENAS as informações fornecidas no contexto acima
2. Se a informação não estiver no contexto, diga claramente
3. Cite as fontes quando relevante
4. Seja preciso, claro e objetivo
5. Se houver múltiplas interpretações, mencione

RESPOSTA:`;

      // 4. Gerar resposta com LLM
      const respostaLLM = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            resposta: {
              type: "string",
              description: "Resposta clara e completa"
            },
            confianca: {
              type: "number",
              description: "Confiança na resposta (0-1)"
            },
            documentos_utilizados: {
              type: "array",
              items: { type: "number" },
              description: "Índices dos documentos utilizados (1, 2, 3...)"
            }
          }
        }
      });
      
      // 5. Formatar resultado
      const resultado = {
        resposta: respostaLLM.resposta,
        fontes: incluir_fontes ? documentos.map(d => ({
          titulo: d.titulo,
          categoria: d.categoria,
          relevancia: d.relevancia
        })) : [],
        confianca: respostaLLM.confianca || 0.8,
        utilizou_rag: true,
        documentos_encontrados: documentos.length,
        score_medio_relevancia: documentos.reduce((acc, d) => acc + d.relevancia, 0) / documentos.length
      };
      
      console.log(`✅ [RAG V3] Resposta gerada com ${resultado.confianca * 100}% de confiança`);
      
      return resultado;
      
    } catch (error) {
      console.error("❌ [RAG V3] Erro ao gerar resposta:", error);
      return {
        resposta: "Desculpe, ocorreu um erro ao processar sua pergunta.",
        fontes: [],
        confianca: 0,
        utilizou_rag: false,
        erro: error.message
      };
    }
  }
  
  /**
   * Indexa novo documento na base vetorial
   */
  static async indexarDocumento(documento) {
    return await VectorSearchEngine.indexarDocumento(documento);
  }
  
  /**
   * Reindexar toda a base
   */
  static async reindexarBase(callback) {
    return await VectorSearchEngine.reindexarTudo({ callback });
  }
  
  /**
   * Estatísticas do RAG
   */
  static async getEstatisticas() {
    return await VectorSearchEngine.getEstatisticas();
  }
}

export default MotorRAGV3;