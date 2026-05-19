import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook para gerenciar Contatos Inteligentes
 * Conecta com Camada 3 (Priorização Operacional)
 * 
 * Cache module-level: compartilhado entre TODAS as instâncias do hook
 * para evitar chamadas duplicadas quando o hook é montado em múltiplos
 * lugares (Layout + página ContatosInteligentes).
 */
const _moduleCache = {
  lastFetchTs: 0,
  inflightPromise: null,
  result: null,
  THROTTLE_MS: 3 * 60 * 1000 // 3min entre chamadas globais
};

export function useContatosInteligentes(usuario, opcoes = {}) {
  const [clientes, setClientes] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const {
    tipo = ['lead', 'cliente'],
    diasSemMensagem = 2,
    minDealRisk = 30,
    limit = 50,
    autoRefresh = true,
    refreshInterval = 5 * 60 * 1000 // 5min
  } = opcoes;

  const carregarContatos = async (forcarReanalise = false) => {
    const agora = Date.now();
    
    // Throttle global (compartilhado entre instâncias)
    if (!forcarReanalise && agora - _moduleCache.lastFetchTs < _moduleCache.THROTTLE_MS) {
      // Reusar resultado do cache sem nova chamada
      if (_moduleCache.result) {
        setClientes(_moduleCache.result.clientes);
        setEstatisticas(_moduleCache.result.estatisticas);
      }
      console.log('[useContatosInteligentes] ⏭️ Cache global ativo — reutilizando');
      return;
    }

    // Deduplicar chamadas simultâneas (ex: 2 instâncias montando ao mesmo tempo)
    if (_moduleCache.inflightPromise) {
      console.log('[useContatosInteligentes] ⏭️ Aguardando chamada em voo...');
      await _moduleCache.inflightPromise;
      if (_moduleCache.result) {
        setClientes(_moduleCache.result.clientes);
        setEstatisticas(_moduleCache.result.estatisticas);
      }
      return;
    }
    
    _moduleCache.lastFetchTs = agora;
    setLoading(true);
    setError(null);
    
    let resolveFlight;
    _moduleCache.inflightPromise = new Promise(r => { resolveFlight = r; });

    try {
      const response = await base44.functions.invoke('analisarClientesEmLote', {
        modo: 'priorizacao',
        tipo,
        diasSemMensagem,
        minDealRisk,
        limit,
        force: forcarReanalise
      });
      
      if (response.data?.success) {
        const normalizados = (response.data.clientes || []).map(c => ({
          ...c,
          id: c.contact_id,
        }));
        
        console.log(`[useContatosInteligentes] ✅ ${normalizados.length} contatos carregados (${normalizados.filter(c => c.thread_id).length} com thread_id)`);
        
        // Armazenar no cache global
        _moduleCache.result = { clientes: normalizados, estatisticas: response.data.estatisticas || null };
        
        setClientes(normalizados);
        setEstatisticas(response.data.estatisticas || null);
      } else {
        throw new Error(response.data?.error || 'Erro desconhecido');
      }
    } catch (err) {
      console.error('[useContatosInteligentes] Erro:', err);
      setError(err.message);
      // Resetar timestamp para permitir retry imediato
      _moduleCache.lastFetchTs = 0;
    } finally {
      setLoading(false);
      _moduleCache.inflightPromise = null;
      if (resolveFlight) resolveFlight();
    }
  };

  // Carregar ao montar
  useEffect(() => {
    if (usuario) {
      carregarContatos();
    }
  }, [usuario?.id]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !usuario) return;
    
    const interval = setInterval(() => {
      carregarContatos();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, usuario?.id]);

  // ❌ REMOVIDO: focus handler causava burst de chamadas ao trocar de aba
  // (múltiplas instâncias disparando simultaneamente sem throttle cooperativo)

  const totalUrgentes = clientes.filter(c => 
    ['CRITICO', 'ALTO'].includes(c.prioridadeLabel)
  ).length;
  
  const criticos = clientes.filter(c => c.prioridadeLabel === 'CRITICO');
  const altos = clientes.filter(c => c.prioridadeLabel === 'ALTO');

  return {
    clientes,
    estatisticas,
    loading,
    error,
    totalUrgentes,
    criticos,
    altos,
    refetch: () => carregarContatos(true)
  };
}