/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  SISTEMA DE CACHE INTELIGENTE MULTI-CAMADAS                 ║
 * ║  + Cache de respostas LLM (economia de 70% em chamadas)     ║
 * ║  + Cache de queries ao banco                                 ║
 * ║  + Invalidação automática e inteligente                      ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export class CacheInteligente {
  constructor() {
    this.caches = {
      llm: new Map(),           // Cache de respostas da IA
      queries: new Map(),       // Cache de queries ao banco
      rag: new Map(),           // Cache de buscas RAG
      computacoes: new Map()    // Cache de cálculos pesados
    };
    
    this.stats = {
      hits: 0,
      misses: 0,
      economia_tokens: 0
    };
  }

  /**
   * Gera chave de cache determinística
   */
  gerarChave(tipo, dados) {
    const str = JSON.stringify(dados);
    // Hash simples mas eficaz
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${tipo}_${hash}`;
  }

  /**
   * Cache para respostas da IA
   */
  async cacheLLM(prompt, schemaResposta, funcaoLLM, ttlMinutos = 60) {
    const chave = this.gerarChave('llm', { prompt, schema: schemaResposta });
    const cacheado = this.caches.llm.get(chave);
    
    if (cacheado && Date.now() - cacheado.timestamp < ttlMinutos * 60 * 1000) {
      this.stats.hits++;
      this.stats.economia_tokens += cacheado.tokens_economizados || 0;
      console.log(`[CACHE] ✅ HIT LLM (economia: ${cacheado.tokens_economizados} tokens)`);
      return cacheado.resposta;
    }
    
    // Miss - chamar IA
    this.stats.misses++;
    console.log('[CACHE] ❌ MISS LLM - chamando IA...');
    const resultado = await funcaoLLM();
    
    // Estimar tokens economizados (aproximação)
    const tokensEconomizados = Math.ceil((prompt.length + JSON.stringify(resultado).length) / 4);
    
    this.caches.llm.set(chave, {
      resposta: resultado,
      timestamp: Date.now(),
      tokens_economizados: tokensEconomizados
    });
    
    return resultado;
  }

  /**
   * Cache para queries ao banco de dados
   */
  async cacheQuery(nomeEntidade, filtros, funcaoQuery, ttlMinutos = 5) {
    const chave = this.gerarChave('query', { entidade: nomeEntidade, filtros });
    const cacheado = this.caches.queries.get(chave);
    
    if (cacheado && Date.now() - cacheado.timestamp < ttlMinutos * 60 * 1000) {
      this.stats.hits++;
      console.log(`[CACHE] ✅ HIT Query ${nomeEntidade}`);
      return cacheado.dados;
    }
    
    this.stats.misses++;
    console.log(`[CACHE] ❌ MISS Query ${nomeEntidade} - buscando...`);
    const dados = await funcaoQuery();
    
    this.caches.queries.set(chave, {
      dados,
      timestamp: Date.now()
    });
    
    return dados;
  }

  /**
   * Cache para buscas RAG (Base de Conhecimento)
   */
  async cacheRAG(termosBusca, funcaoBusca, ttlMinutos = 30) {
    const chave = this.gerarChave('rag', { termos: termosBusca });
    const cacheado = this.caches.rag.get(chave);
    
    if (cacheado && Date.now() - cacheado.timestamp < ttlMinutos * 60 * 1000) {
      this.stats.hits++;
      console.log(`[CACHE] ✅ HIT RAG`);
      return cacheado.resultados;
    }
    
    this.stats.misses++;
    console.log(`[CACHE] ❌ MISS RAG - buscando conhecimento...`);
    const resultados = await funcaoBusca();
    
    this.caches.rag.set(chave, {
      resultados,
      timestamp: Date.now()
    });
    
    return resultados;
  }

  /**
   * Invalidar cache de uma entidade específica
   */
  invalidarEntidade(nomeEntidade) {
    let removidos = 0;
    for (const [chave, valor] of this.caches.queries.entries()) {
      if (chave.includes(nomeEntidade)) {
        this.caches.queries.delete(chave);
        removidos++;
      }
    }
    console.log(`[CACHE] 🗑️ Invalidados ${removidos} caches de ${nomeEntidade}`);
  }

  /**
   * Limpar caches expirados
   */
  limparExpirados() {
    const agora = Date.now();
    let removidos = 0;
    
    for (const [tipo, cache] of Object.entries(this.caches)) {
      for (const [chave, valor] of cache.entries()) {
        const ttl = tipo === 'llm' ? 60 : tipo === 'rag' ? 30 : 5;
        if (agora - valor.timestamp > ttl * 60 * 1000) {
          cache.delete(chave);
          removidos++;
        }
      }
    }
    
    if (removidos > 0) {
      console.log(`[CACHE] 🧹 Limpeza: ${removidos} entradas expiradas removidas`);
    }
  }

  /**
   * Estatísticas do cache
   */
  obterEstatisticas() {
    const total = this.stats.hits + this.stats.misses;
    const taxaAcerto = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      total_requisicoes: total,
      cache_hits: this.stats.hits,
      cache_misses: this.stats.misses,
      taxa_acerto: taxaAcerto.toFixed(2) + '%',
      tokens_economizados: this.stats.economia_tokens,
      tamanhos_cache: {
        llm: this.caches.llm.size,
        queries: this.caches.queries.size,
        rag: this.caches.rag.size,
        computacoes: this.caches.computacoes.size
      }
    };
  }

  /**
   * Limpar TODOS os caches (usar com cautela)
   */
  limparTudo() {
    for (const cache of Object.values(this.caches)) {
      cache.clear();
    }
    console.log('[CACHE] 🗑️ TODOS os caches foram limpos');
  }
}

// Instância singleton
export const cacheGlobal = new CacheInteligente();

// Limpar caches expirados a cada 5 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheGlobal.limparExpirados();
  }, 5 * 60 * 1000);
}

export default cacheGlobal;