import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook para gerenciar Contatos Inteligentes
 * Conecta com Camada 3 (Priorização Operacional)
 */
export function useContatosInteligentes(usuario, opcoes = {}) {
  const [clientes, setClientes] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const ultimaAtualizacaoRef = useRef(0);
  
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
    
    // Throttle: evitar chamadas muito próximas
    if (!forcarReanalise && agora - ultimaAtualizacaoRef.current < 60000) {
      console.log('[useContatosInteligentes] ⏭️ Pulando (muito recente)');
      return;
    }
    
    ultimaAtualizacaoRef.current = agora;
    setLoading(true);
    setError(null);
    
    try {
      // ✅ BUSCA DIRETA DO BANCO (analisarClientesEmLote já retorna com thread_id canônico)
      const response = await base44.functions.invoke('analisarClientesEmLote', {
        modo: 'priorizacao',
        tipo,
        diasSemMensagem,
        minDealRisk,
        limit,
        force: forcarReanalise
      });
      
      if (response.data?.success) {
        // ✅ Backend já retorna normalizados com thread_id, só garantir compatibilidade UI
        const normalizados = (response.data.clientes || []).map(c => ({
          ...c,
          id: c.contact_id, // key estável para React
          // thread_id já vem do backend (linha 188/243 do analisarClientesEmLote)
        }));
        
        console.log(`[useContatosInteligentes] ✅ ${normalizados.length} contatos carregados (${normalizados.filter(c => c.thread_id).length} com thread_id)`);
        
        setClientes(normalizados);
        setEstatisticas(response.data.estatisticas || null);
      } else {
        throw new Error(response.data?.error || 'Erro desconhecido');
      }
    } catch (err) {
      console.error('[useContatosInteligentes] Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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

  // Recarregar ao focar janela
  useEffect(() => {
    if (!usuario) return;
    
    const handleFocus = () => carregarContatos();
    window.addEventListener('focus', handleFocus);
    
    return () => window.removeEventListener('focus', handleFocus);
  }, [usuario?.id]);

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