import { BaseConhecimento } from "@/entities/BaseConhecimento";
import { Produto } from "@/entities/Produto";
import { InvokeLLM } from "@/integrations/Core";

/**
 * MotorRAG - Retrieval-Augmented Generation
 * Sistema de busca e recuperação de conhecimento
 */
export class MotorRAG {
  
  /**
   * Busca conhecimento relevante para uma query
   */
  static async buscarConhecimento(query, opcoes = {}) {
    try {
      const {
        limite = 5,
        categoria = null,
        relevancia_minima = 0.6
      } = opcoes;
      
      console.log("🔍 [MotorRAG] Buscando conhecimento para:", query);
      
      // 1. Buscar na Base de Conhecimento
      const conhecimento = await this.buscarNaBaseConhecimento(query, categoria, limite * 2);
      
      // 2. Buscar em Produtos (se relevante)
      const produtos = await this.buscarProdutosRelevantes(query, limite);
      
      // 3. Combinar e ranquear resultados
      const resultados = [
        ...conhecimento.map(c => ({
          fonte: 'base_conhecimento',
          conteudo: c.conteudo,
          titulo: c.titulo,
          relevancia: c.relevancia || 0.8,
          categoria: c.categoria,
          id: c.id
        })),
        ...produtos.map(p => ({
          fonte: 'produto',
          conteudo: this.formatarProduto(p),
          titulo: p.nome,
          relevancia: 0.7,
          categoria: 'produto',
          id: p.id
        }))
      ];
      
      // Ordenar por relevância
      const resultadosOrdenados = resultados
        .filter(r => r.relevancia >= relevancia_minima)
        .sort((a, b) => b.relevancia - a.relevancia)
        .slice(0, limite);
      
      console.log(`✅ [MotorRAG] Encontrados ${resultadosOrdenados.length} resultados relevantes`);
      
      return resultadosOrdenados;
      
    } catch (error) {
      console.error("❌ [MotorRAG] Erro ao buscar conhecimento:", error);
      return [];
    }
  }

  /**
   * Busca na Base de Conhecimento com filtros
   */
  static async buscarNaBaseConhecimento(query, categoria = null, limite = 10) {
    try {
      let filtro = { ativo: true };
      
      if (categoria) {
        filtro.categoria = categoria;
      }
      
      // Buscar documentos ativos
      const documentos = await BaseConhecimento.filter(filtro, '-relevancia_score', limite * 2);
      
      if (documentos.length === 0) {
        return [];
      }
      
      // Calcular relevância usando IA
      const documentosComRelevancia = await this.calcularRelevanciaDocumentos(query, documentos);
      
      return documentosComRelevancia
        .filter(d => d.relevancia > 0.5)
        .slice(0, limite);
      
    } catch (error) {
      console.error("❌ [MotorRAG] Erro ao buscar na base de conhecimento:", error);
      return [];
    }
  }

  /**
   * Busca produtos relevantes para a query
   */
  static async buscarProdutosRelevantes(query, limite = 3) {
    try {
      const queryLower = query.toLowerCase();
      
      // Verificar se a query menciona produtos
      const mencionaProduto = this.detectarMencaoProduto(queryLower);
      
      if (!mencionaProduto) {
        return [];
      }
      
      // Buscar produtos
      const produtos = await Produto.filter({ ativo: true }, '-created_date', 50);
      
      // Filtrar produtos relevantes
      const produtosRelevantes = produtos.filter(p => {
        const nome = (p.nome || '').toLowerCase();
        const descricao = (p.descricao || '').toLowerCase();
        const codigo = (p.codigo || '').toLowerCase();
        const categoria = (p.categoria || '').toLowerCase();
        
        return nome.includes(queryLower) ||
               descricao.includes(queryLower) ||
               codigo.includes(queryLower) ||
               categoria.includes(queryLower) ||
               queryLower.includes(nome) ||
               queryLower.includes(codigo);
      });
      
      return produtosRelevantes.slice(0, limite);
      
    } catch (error) {
      console.error("❌ [MotorRAG] Erro ao buscar produtos:", error);
      return [];
    }
  }

  /**
   * Calcula relevância dos documentos usando IA
   */
  static async calcularRelevanciaDocumentos(query, documentos) {
    try {
      // Para performance, processar em lote
      const documentosParaAnalisar = documentos.slice(0, 10);
      
      const prompt = `Você é um sistema de ranqueamento de documentos. Avalie a relevância de cada documento para a pergunta do usuário.

PERGUNTA DO USUÁRIO: "${query}"

DOCUMENTOS:
${documentosParaAnalisar.map((d, idx) => `
[${idx}] TÍTULO: ${d.titulo}
CATEGORIA: ${d.categoria}
CONTEÚDO: ${d.conteudo.substring(0, 500)}...
`).join('\n')}

Para cada documento, retorne um score de relevância de 0 a 1.`;

      const analise = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            scores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  indice: { type: "number" },
                  relevancia: { type: "number", minimum: 0, maximum: 1 },
                  justificativa: { type: "string" }
                }
              }
            }
          }
        }
      });
      
      // Aplicar scores
      return documentosParaAnalisar.map((doc, idx) => {
        const score = analise.scores.find(s => s.indice === idx);
        return {
          ...doc,
          relevancia: score ? score.relevancia : 0.5,
          justificativa: score ? score.justificativa : ''
        };
      });
      
    } catch (error) {
      console.error("❌ [MotorRAG] Erro ao calcular relevância:", error);
      // Fallback: retornar com relevância padrão
      return documentos.map(d => ({ ...d, relevancia: 0.7 }));
    }
  }

  /**
   * Detecta se a query menciona produtos
   */
  static detectarMencaoProduto(query) {
    const palavrasChaveProduto = [
      'produto', 'preço', 'comprar', 'valor', 'custo', 'disponível',
      'estoque', 'categoria', 'marca', 'modelo', 'especificação',
      'celular', 'notebook', 'computador', 'monitor', 'teclado', 'mouse',
      'hardware', 'software', 'equipamento'
    ];
    
    return palavrasChaveProduto.some(palavra => query.includes(palavra));
  }

  /**
   * Formata produto para inclusão no contexto
   */
  static formatarProduto(produto) {
    const partes = [
      `Produto: ${produto.nome}`,
      produto.codigo ? `Código: ${produto.codigo}` : null,
      produto.categoria ? `Categoria: ${produto.categoria}` : null,
      produto.descricao ? `Descrição: ${produto.descricao}` : null,
      produto.preco_venda ? `Preço: R$ ${produto.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null,
      produto.estoque_atual !== undefined ? `Estoque: ${produto.estoque_atual} unidades` : null,
      produto.marca ? `Marca: ${produto.marca}` : null,
      produto.modelo ? `Modelo: ${produto.modelo}` : null
    ];
    
    return partes.filter(Boolean).join('\n');
  }

  /**
   * Indexa um novo documento na base de conhecimento
   */
  static async indexarDocumento(documento) {
    try {
      console.log("📥 [MotorRAG] Indexando documento:", documento.titulo);
      
      // Extrair palavras-chave usando IA
      const palavrasChave = await this.extrairPalavrasChave(documento.conteudo);
      
      // Criar/atualizar documento
      const dadosIndexacao = {
        ...documento,
        palavras_chave: palavrasChave,
        embedding_gerado: false, // TODO: Implementar embeddings vetoriais
        data_indexacao: new Date().toISOString()
      };
      
      let documentoSalvo;
      if (documento.id) {
        documentoSalvo = await BaseConhecimento.update(documento.id, dadosIndexacao);
      } else {
        documentoSalvo = await BaseConhecimento.create(dadosIndexacao);
      }
      
      console.log("✅ [MotorRAG] Documento indexado com sucesso");
      
      return documentoSalvo;
      
    } catch (error) {
      console.error("❌ [MotorRAG] Erro ao indexar documento:", error);
      throw error;
    }
  }

  /**
   * Extrai palavras-chave de um texto
   */
  static async extrairPalavrasChave(texto) {
    try {
      const prompt = `Extraia as palavras-chave mais importantes do seguinte texto. Retorne até 10 palavras-chave.

TEXTO:
${texto.substring(0, 2000)}

Retorne apenas as palavras-chave, separadas por vírgula.`;

      const resultado = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            palavras_chave: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });
      
      return resultado.palavras_chave || [];
      
    } catch (error) {
      console.error("❌ [MotorRAG] Erro ao extrair palavras-chave:", error);
      return [];
    }
  }

  /**
   * Busca documentos por palavras-chave exatas
   */
  static async buscarPorPalavrasChave(palavrasChave, limite = 5) {
    try {
      const documentos = await BaseConhecimento.filter({ ativo: true }, '-relevancia_score', 50);
      
      const documentosRelevantes = documentos.filter(doc => {
        const palavrasDoc = doc.palavras_chave || [];
        const tituloLower = (doc.titulo || '').toLowerCase();
        const conteudoLower = (doc.conteudo || '').toLowerCase();
        
        return palavrasChave.some(palavra => 
          palavrasDoc.includes(palavra) ||
          tituloLower.includes(palavra.toLowerCase()) ||
          conteudoLower.includes(palavra.toLowerCase())
        );
      });
      
      return documentosRelevantes.slice(0, limite);
      
    } catch (error) {
      console.error("❌ [MotorRAG] Erro ao buscar por palavras-chave:", error);
      return [];
    }
  }

  /**
   * Atualiza estatísticas de uso de um documento
   */
  static async registrarUsoDocumento(documentoId) {
    try {
      const documento = await BaseConhecimento.get(documentoId);
      
      if (documento) {
        await BaseConhecimento.update(documentoId, {
          vezes_utilizado: (documento.vezes_utilizado || 0) + 1,
          ultima_utilizacao: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error("❌ [MotorRAG] Erro ao registrar uso:", error);
    }
  }
}

export default MotorRAG;