import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import CopilotCard from './CopilotCard';

/**
 * NexusBrainSuggestions
 * Mostra sugestões de resposta geradas pelo nexusAgentBrain (WorkQueueItem.payload.tipo='suggest_reply')
 * para a thread atual. O atendente pode usar (envia direto) ou dispensar.
 */
export default function NexusBrainSuggestions({ thread, onUsar }) {
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!thread?.id) return;
    try {
      const items = await base44.entities.WorkQueueItem.filter({
        thread_id: thread.id,
        status: 'open'
      }, '-created_date', 10);

      const brain = items.filter(i =>
        i.payload?.tipo === 'suggest_reply' &&
        i.payload?.message
      );
      setSugestoes(brain);
    } catch (e) {
      // silencioso — não bloquear UI
    }
  }, [thread?.id]);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 8000);
    return () => clearInterval(interval);
  }, [carregar]);

  const dispensar = async (itemId) => {
    try {
      await base44.entities.WorkQueueItem.update(itemId, { status: 'dismissed' });
      setSugestoes(prev => prev.filter(s => s.id !== itemId));
    } catch (e) {
      console.warn('[BRAIN-SUGGESTIONS] Erro ao dispensar:', e.message);
    }
  };

  const usar = async (item) => {
    try {
      await base44.entities.WorkQueueItem.update(item.id, { status: 'processado' });
      setSugestoes(prev => prev.filter(s => s.id !== item.id));
      onUsar(item.payload.message);
    } catch (e) {
      toast.error('Erro ao usar sugestão');
    }
  };

  if (!sugestoes.length) return null;

  return (
    <div className="px-3 py-2 bg-purple-50 border-t border-purple-200 flex-shrink-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
        <span className="text-xs font-semibold text-purple-700">Nexus Brain sugeriu</span>
        <button
          onClick={carregar}
          className="ml-auto text-purple-400 hover:text-purple-600"
          title="Atualizar"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {sugestoes.map(item => (
          <CopilotCard
            key={item.id}
            card={item.payload.copilot_card || {
              title: 'Nexus Brain sugeriu',
              message: item.payload.message,
              tone: item.payload.tone,
              reasoning: item.payload.reasoning,
              conversation_state: item.payload.conversation_state
            }}
            onUse={() => usar(item)}
            onDismiss={() => dispensar(item.id)}
            compact
          />
        ))}
      </div>
    </div>
  );
}