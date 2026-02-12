import { useState, useEffect, useRef } from "react";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function SugestorRespostasRapidas({ 
  mensagemCliente, 
  threadId, 
  contactId, 
  onUseResposta,
  onClose 
}) {
  const [status, setStatus] = useState('idle');
  const [sugestoes, setSugestoes] = useState([]);
  const [erro, setErro] = useState(null);
  const [analiseContexto, setAnaliseContexto] = useState(null);
  const abortControllerRef = useRef(null);
  const reqSeqRef = useRef(0);

  const gerarSugestoes = async (force = false) => {
    const seq = ++reqSeqRef.current;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setStatus('loading');
    setErro(null);
    if (force) {
      setSugestoes([]);
      setAnaliseContexto(null);
    }

    try {
      const resultado = await base44.functions.invoke('gerarSugestoesRespostaContato', {
        thread_id: threadId || null,
        contact_id: contactId || null,
        limit: 50,
        language: 'pt-BR',
        tones: ['formal', 'amigavel', 'objetiva'],
        force
      });

      if (seq !== reqSeqRef.current) {
        return;
      }

      if (resultado.data?.success && resultado.data.suggestions) {
        const isCacheHit = resultado.data.meta?.cache_hit === true;
        
        const sugestoesUI = resultado.data.suggestions.map(s => ({
          texto: s.message,
          tom: s.tone,
          title: s.title
        }));
        
        setSugestoes(sugestoesUI);
        setAnaliseContexto(resultado.data.analysis);
        setStatus(isCacheHit ? 'cached' : 'ready');
        
        if (isCacheHit) {
          const cacheAge = resultado.data.meta.cache_age_seconds;
          toast.success(`⚡ Cache (${cacheAge}s atrás)`, { duration: 2000 });
        }
      } else {
        throw new Error(resultado.data?.error || 'Resposta inválida');
      }

    } catch (error) {
      if (seq !== reqSeqRef.current || error.name === 'AbortError') {
        return;
      }
      
      setErro('Não foi possível gerar sugestões.');
      setStatus('error');
      
      setSugestoes([
        { texto: 'Obrigado pela sua mensagem! Vou verificar isso para você e retorno em breve.', tom: 'formal' },
        { texto: 'Entendi sua solicitação. Estou analisando e já te respondo! 😊', tom: 'amigavel' },
        { texto: 'Recebi sua mensagem. Aguarde um momento enquanto verifico os detalhes.', tom: 'objetiva' }
      ]);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const getTomColor = (tom) => {
    switch(tom) {
      case 'formal': return 'bg-blue-100 text-blue-700';
      case 'amigavel': return 'bg-green-100 text-green-700';
      case 'objetiva': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTomIcon = (tom) => {
    switch(tom) {
      case 'formal': return '👔';
      case 'amigavel': return '😊';
      case 'objetiva': return '🎯';
      default: return '💬';
    }
  };

  useEffect(() => {
    if (!contactId && !threadId) return;
    
    if (status === 'loading' || status === 'cached' || status === 'ready') {
      return;
    }
    
    const timer = setTimeout(() => {
      gerarSugestoes(false);
    }, 200);
    
    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [threadId, contactId]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-purple-300 overflow-hidden">
      {/* Header ultra compacto */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-white text-xs">Análise IA</h4>
            <Badge className="bg-green-500 text-white text-[8px] px-1 py-0 font-bold">50</Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-white hover:bg-white/20"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="p-2 space-y-2">
        {/* Contexto - Ultra compacto */}
        <div className="bg-purple-50 rounded-lg p-2 border border-purple-200 space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-xs mt-0.5">💬</span>
            <div className="flex-1 min-w-0">
              {analiseContexto?.is_latest_courtesy ? (
                <>
                  <p className="text-[10px] text-purple-700 font-semibold mb-0.5">Última ÚTIL:</p>
                  <p className="text-xs text-slate-900 font-medium mb-1">{analiseContexto.last_useful_message}</p>
                  <div className="flex items-center gap-1 p-1 bg-white rounded border border-purple-200">
                    <Badge className="bg-purple-500 text-white text-[8px] px-1 py-0">CORTESIA</Badge>
                    <p className="text-[9px] text-purple-700 italic">"{analiseContexto.last_customer_message}"</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-purple-700 font-semibold mb-0.5">Última mensagem:</p>
                  <p className="text-xs text-slate-900 line-clamp-2 font-medium">{mensagemCliente}</p>
                </>
              )}
            </div>
          </div>

          {analiseContexto?.open_loop?.is_overdue && (
            <div className="bg-red-50 p-1.5 rounded border-l-2 border-red-500">
              <div className="flex items-center gap-1 mb-0.5">
                <Badge className="bg-red-600 text-white text-[8px] px-1 py-0">⚠️</Badge>
                <span className="text-[9px] text-red-800 font-semibold">
                  Prometeu retorno há {analiseContexto.open_loop.hours_since_promise}h
                </span>
              </div>
            </div>
          )}
          
          {analiseContexto && (
            <div className="pt-1.5 border-t border-purple-200 space-y-1">
              <div className="flex items-center gap-1 flex-wrap">
                {(analiseContexto.conversation_type || analiseContexto.customer_intent) && (
                  <Badge className="bg-white text-purple-800 border border-purple-300 text-[9px] font-semibold">
                    {(analiseContexto.conversation_type || analiseContexto.customer_intent) === 'orcamento' ? '💰 Orçamento' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'pergunta' || analiseContexto.customer_intent === 'duvida' ? '❓ Pergunta' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'reclamacao' ? '⚠️ Reclamação' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'followup' ? '📞 Follow-up' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'cortesia' ? '🟣 Cortesia' : '💬 Outro'}
                  </Badge>
                )}
                {analiseContexto.urgency && (
                  <Badge className={`text-[9px] font-semibold ${
                    analiseContexto.urgency === 'alta' ? 'bg-red-100 text-red-800' :
                    analiseContexto.urgency === 'media' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {analiseContexto.urgency === 'alta' ? '🔴' :
                     analiseContexto.urgency === 'media' ? '🟡' : '🟢'}
                  </Badge>
                )}
              </div>
              {analiseContexto.next_best_action?.action && (
                <p className="text-[9px] text-purple-700">
                  💡 <strong>Ação:</strong> {analiseContexto.next_best_action.action}
                </p>
              )}
              {analiseContexto.next_best_action?.ask && (
                <p className="text-[9px] text-purple-700">
                  ❓ <strong>Confirmar:</strong> {analiseContexto.next_best_action.ask}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="text-center py-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-1" />
            <p className="text-[10px] text-purple-600">Analisando...</p>
          </div>
        )}

        {/* Erro */}
        {status === 'error' && erro && (
          <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] text-red-700 mb-1">{erro}</p>
              <Button
                onClick={() => gerarSugestoes(true)}
                size="sm"
                className="h-6 text-[9px] border-red-300 text-red-700 hover:bg-red-50"
              >
                🔄 Tentar
              </Button>
            </div>
          </div>
        )}

        {/* Sugestões */}
        {(status === 'ready' || status === 'cached') && sugestoes.length > 0 && (
          <div className="space-y-1">
            {sugestoes.map((sugestao, index) => (
              <div
                key={index}
                onClick={() => onUseResposta(sugestao.texto)}
                className="bg-white hover:bg-purple-50 border border-purple-200 hover:border-purple-400 rounded-lg cursor-pointer group transition-all"
              >
                <div className="p-2">
                  <Badge className={`text-[8px] mb-1 ${getTomColor(sugestao.tom)}`}>
                    {getTomIcon(sugestao.tom)} {sugestao.tom}
                  </Badge>
                  <p className="text-[10px] text-slate-800 group-hover:text-slate-900 leading-snug">
                    {sugestao.texto}
                  </p>
                  <div className="mt-1 text-[8px] text-purple-600 opacity-0 group-hover:opacity-100">
                    👆 Clique para usar esta resposta
                  </div>
                </div>
              </div>
            ))}

            <Button
              onClick={() => gerarSugestoes(true)}
              variant="outline"
              size="sm"
              className="w-full h-6 border-purple-300 text-purple-700 hover:bg-purple-50 text-[9px]"
              disabled={status === 'loading'}
            >
              🔄 Gerar Novas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}