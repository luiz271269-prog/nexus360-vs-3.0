import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AgentSuggestion({ threadId, onUseSuggestion }) {
  const [threadContext, setThreadContext] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadThreadContext();
    
    // Atualizar a cada 10 segundos
    const interval = setInterval(loadThreadContext, 10000);
    return () => clearInterval(interval);
  }, [threadId]);

  const loadThreadContext = async () => {
    try {
      const contexts = await base44.entities.ThreadContext.filter({ thread_id: threadId });
      if (contexts.length > 0) {
        setThreadContext(contexts[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar ThreadContext:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseSuggestion = async (sugestao) => {
    try {
      // Marcar como usada
      const updatedSuggestions = threadContext.agent_suggestions.map(s =>
        s === sugestao ? { ...s, usado: true, usado_em: new Date().toISOString(), feedback: 'aceito' } : s
      );

      await base44.entities.ThreadContext.update(threadContext.id, {
        agent_suggestions: updatedSuggestions
      });

      // Preencher campo de mensagem
      if (onUseSuggestion) {
        onUseSuggestion(sugestao.texto);
      }

      toast.success('Sugestão aplicada!');
      loadThreadContext();
    } catch (error) {
      console.error('Erro ao usar sugestão:', error);
      toast.error('Erro ao aplicar sugestão');
    }
  };

  const handleDiscardSuggestion = async (sugestao) => {
    try {
      const updatedSuggestions = threadContext.agent_suggestions.map(s =>
        s === sugestao ? { ...s, usado: true, feedback: 'descartado' } : s
      );

      await base44.entities.ThreadContext.update(threadContext.id, {
        agent_suggestions: updatedSuggestions
      });

      toast.success('Sugestão descartada');
      loadThreadContext();
    } catch (error) {
      console.error('Erro ao descartar sugestão:', error);
      toast.error('Erro ao descartar sugestão');
    }
  };

  if (loading || !threadContext) return null;

  const sugestoesNaoUsadas = threadContext.agent_suggestions?.filter(s => !s.usado) || [];

  if (sugestoesNaoUsadas.length === 0) return null;

  const sugestao = sugestoesNaoUsadas[0];

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-4 animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-purple-900">Sugestão do Nexus AI</h3>
        <Badge className="bg-purple-100 text-purple-700">
          {Math.round(sugestao.confianca)}% confiança
        </Badge>
      </div>

      <p className="text-sm text-slate-700 mb-3 whitespace-pre-wrap leading-relaxed">
        {sugestao.texto}
      </p>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleUseSuggestion(sugestao)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Usar sugestão
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDiscardSuggestion(sugestao)}
        >
          <X className="w-4 h-4 mr-1" />
          Descartar
        </Button>
      </div>
    </div>
  );
}