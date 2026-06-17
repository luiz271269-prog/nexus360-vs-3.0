import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import CopilotCard from './CopilotCard';
import { useAISuggestions } from '@/hooks/useAISuggestions';

/**
 * AISuggestionsPanel — painel único de sugestões de IA.
 *
 * Centraliza a "habilidade" useAISuggestions. Hoje renderiza a Camada Cérebro
 * (sugestões do nexusAgentBrain via WorkQueueItem). Substitui o NexusBrainSuggestions
 * sem mudar comportamento — futuras camadas entram aqui sem tocar no ChatWindow.
 */
export default function AISuggestionsPanel({ thread, onUsar }) {
  const {
    brainSuggestions,
    recarregarBrain,
    usarBrainSuggestion,
    dispensarBrainSuggestion
  } = useAISuggestions(thread);

  if (!brainSuggestions.length) return null;

  return (
    <div className="px-3 py-2 bg-purple-50 border-t border-purple-200 flex-shrink-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
        <span className="text-xs font-semibold text-purple-700">Nexus Brain sugeriu</span>
        <button
          onClick={recarregarBrain}
          className="ml-auto text-purple-400 hover:text-purple-600"
          title="Atualizar"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {brainSuggestions.map(item => (
          <CopilotCard
            key={item.id}
            card={item.payload.copilot_card || {
              title: 'Nexus Brain sugeriu',
              message: item.payload.message,
              tone: item.payload.tone,
              reasoning: item.payload.reasoning,
              conversation_state: item.payload.conversation_state
            }}
            onUse={() => usarBrainSuggestion(item, onUsar).catch(() => toast.error('Erro ao usar sugestão'))}
            onDismiss={() => dispensarBrainSuggestion(item.id)}
            compact
          />
        ))}
      </div>
    </div>
  );
}