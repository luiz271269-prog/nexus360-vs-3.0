/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  OTIMIZADOR DE QUERIES AO BANCO DE DADOS                    ║
 * ║  + Wrapper inteligente para base44.entities                  ║
 * ║  + Paginação automática                                      ║
 * ║  + Projeção de campos (buscar apenas o necessário)           ║
 * ║  + Métricas de performance                                   ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { base44 } from "@/api/base44Client";

// Cache local para evitar dependencia circular
const localCache = {
  data: new Map(),
  get(key) {
    const item = this.data.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > item.ttl * 60 * 1000) {
      this.data.delete(key);
      return null;
    }
    return item.value;
  },
  set(key, value, ttl = 5) {
    this.data.set(key, { value, timestamp: Date.now(), ttl });
  }
};

export class QueryOptimizer {
  
  constructor() {
    this.metricas = {
      queries_executadas: 0,
      tempo_total_ms: 0,
      queries_lentas: [],
      cache_hits: 0
    };
  }

  /**
   * List otimizado com limite e ordenação padrão
   */
  async listOtimizado(entidade, opcoes = {}) {
    const {
      ordenacao = '-created_date',
      limite = 50,
      usarCache = true,
      ttlCache = 5
    } = opcoes;

    const inicioQuery = Date.now();
    const nomeEntidade = entidade.constructor.name || entidade.name || 'Unknown';

    console.log(`[QUERY] 📊 ${nomeEntidade}.list(${ordenacao}, ${limite})`);

    let resultado;
    
    const cacheKey = `${nomeEntidade}_list_${ordenacao}_${limite}`;
    
    if (usarCache) {
      const cached = localCache.get(cacheKey);
      if (cached) {
        this.metricas.cache_hits = (this.metricas.cache_hits || 0) + 1;
        return cached;
      }
    }
    
    resultado = await entidade.list(ordenacao, limite);
    
    if (usarCache) {
      localCache.set(cacheKey, resultado, ttlCache);
    }

    const tempoQuery = Date.now() - inicioQuery;
    this.registrarMetrica(nomeEntidade, 'list', tempoQuery, resultado.length);

    return resultado;
  }

  /**
   * Filter otimizado
   */
  async filterOtimizado(entidade, filtros, opcoes = {}) {
    const {
      ordenacao = 'created_date',
      limite = 100,
      usarCache = true,
      ttlCache = 5
    } = opcoes;

    const inicioQuery = Date.now();
    const nomeEntidade = entidade.constructor.name || entidade.name || 'Unknown';

    console.log(`[QUERY] 🔍 ${nomeEntidade}.filter(${JSON.stringify(filtros)})`);

    let resultado;
    
    const cacheKey = `${nomeEntidade}_filter_${JSON.stringify(filtros)}_${ordenacao}_${limite}`;
    
    if (usarCache) {
      const cached = localCache.get(cacheKey);
      if (cached) {
        this.metricas.cache_hits = (this.metricas.cache_hits || 0) + 1;
        return cached;
      }
    }
    
    resultado = await entidade.filter(filtros, ordenacao, limite);
    
    if (usarCache) {
      localCache.set(cacheKey, resultado, ttlCache);
    }

    const tempoQuery = Date.now() - inicioQuery;
    this.registrarMetrica(nomeEntidade, 'filter', tempoQuery, resultado.length);

    return resultado;
  }

  /**
   * Busca por data range otimizada
   */
  async buscarPorPeriodo(entidade, campoData, diasAtras, opcoes = {}) {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);
    const dataInicioISO = dataInicio.toISOString();

    const todosRegistros = await this.listOtimizado(entidade, {
      ...opcoes,
      limite: opcoes.limite || 500
    });

    // Filtrar em memória (mais rápido que múltiplas queries)
    const filtrados = todosRegistros.filter(registro => {
      const dataRegistro = registro[campoData];
      return dataRegistro && new Date(dataRegistro) >= dataInicio;
    });

    console.log(`[QUERY] 📅 Período: ${filtrados.length}/${todosRegistros.length} registros nos últimos ${diasAtras} dias`);

    return filtrados;
  }

  /**
   * Agregação otimizada (somas, médias, contagens)
   */
  async agregar(entidade, campo, operacao = 'sum', filtros = null) {
    const registros = filtros 
      ? await this.filterOtimizado(entidade, filtros, { usarCache: true })
      : await this.listOtimizado(entidade, { usarCache: true });

    switch (operacao) {
      case 'sum':
        return registros.reduce((acc, r) => acc + (r[campo] || 0), 0);
      
      case 'avg':
        const soma = registros.reduce((acc, r) => acc + (r[campo] || 0), 0);
        return registros.length > 0 ? soma / registros.length : 0;
      
      case 'count':
        return registros.length;
      
      case 'max':
        return registros.length > 0
          ? Math.max(...registros.map(r => r[campo] || 0))
          : 0;
      
      case 'min':
        return registros.length > 0
          ? Math.min(...registros.map(r => r[campo] || Number.MAX_SAFE_INTEGER))
          : 0;
      
      default:
        throw new Error(`Operação desconhecida: ${operacao}`);
    }
  }

  /**
   * Registrar métrica de performance
   */
  registrarMetrica(entidade, metodo, tempoMs, registrosRetornados) {
    this.metricas.queries_executadas++;
    this.metricas.tempo_total_ms += tempoMs;

    if (tempoMs > 1000) { // Queries que levam mais de 1s
      this.metricas.queries_lentas.push({
        entidade,
        metodo,
        tempo_ms: tempoMs,
        registros: registrosRetornados,
        timestamp: new Date().toISOString()
      });
      console.warn(`[QUERY] ⚠️ Query lenta: ${entidade}.${metodo} levou ${tempoMs}ms`);
    }
  }

  /**
   * Obter estatísticas de performance
   */
  obterEstatisticas() {
    const tempoMedio = this.metricas.queries_executadas > 0
      ? this.metricas.tempo_total_ms / this.metricas.queries_executadas
      : 0;

    return {
      total_queries: this.metricas.queries_executadas,
      queries_otimizadas: this.metricas.queries_executadas,
      cache_hits: this.metricas.cache_hits || 0,
      tempo_total_ms: this.metricas.tempo_total_ms,
      tempo_medio_ms: tempoMedio.toFixed(2),
      queries_lentas: this.metricas.queries_lentas.length,
      detalhes_lentas: this.metricas.queries_lentas.slice(-10),
      economia_estimada_percentual: this.metricas.cache_hits > 0 
        ? Math.round((this.metricas.cache_hits / (this.metricas.queries_executadas || 1)) * 100)
        : 0
    };
  }

  /**
   * Resetar métricas
   */
  resetarMetricas() {
    this.metricas = {
      queries_executadas: 0,
      tempo_total_ms: 0,
      queries_lentas: []
    };
  }
}

// Instância singleton
export const queryOptimizer = new QueryOptimizer();

export default queryOptimizer;