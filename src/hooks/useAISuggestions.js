import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useAISuggestions — habilidade unificada de sugestões de IA (por camadas).
 *
 * CAMADA 1 — Cérebro: lê WorkQueueItem (payload.tipo='suggest_reply') gerados
 * pelo nexusAgentBrain para a thread atual. Polling de 8s, ações usar/dispensar.
 *
 * (Camadas futuras — Ao vivo/InvokeLLM e Rascunho — ficam no AIResponseAssistant
 *  e não são duplicadas aqui; este hook centraliza só a camada do Cérebro.)
 *
 * Substitui o componente NexusBrainSuggestions sem mudar comportamento.
 */
export function useAISuggestions(thread) {
  const [brainSuggestions, setBrainSuggestions] = useState([]);

  const carregarBrain = useCallback(async () => {
    if (!thread?.id) {
      setBrainSuggestions([]);
      return;
    }
    try {
      const items = await base44.entities.WorkQueueItem.filter({
        thread_id: thread.id,
        status: 'open'
      }, '-created_date', 10);

      const brain = items.filter(i =>
        i.payload?.tipo === 'suggest_reply' &&
        i.payload?.message
      );
      setBrainSuggestions(brain);
    } catch (e) {
      // silencioso — não bloquear UI
    }
  }, [thread?.id]);

  useEffect(() => {
    carregarBrain();
    const interval = setInterval(carregarBrain, 8000);
    return () => clearInterval(interval);
  }, [carregarBrain]);

  const usarBrainSuggestion = useCallback(async (item, onUsar) => {
    try {
      await base44.entities.WorkQueueItem.update(item.id, { status: 'processado' });
      setBrainSuggestions(prev => prev.filter(s => s.id !== item.id));
      onUsar?.(item.payload.message);
    } catch (e) {
      throw new Error('Erro ao usar sugestão');
    }
  }, []);

  const dispensarBrainSuggestion = useCallback(async (itemId) => {
    try {
      await base44.entities.WorkQueueItem.update(itemId, { status: 'dismissed' });
      setBrainSuggestions(prev => prev.filter(s => s.id !== itemId));
    } catch (e) {
      console.warn('[useAISuggestions] Erro ao dispensar:', e.message);
    }
  }, []);

  return {
    brainSuggestions,
    recarregarBrain: carregarBrain,
    usarBrainSuggestion,
    dispensarBrainSuggestion
  };
}