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
    <div className="bg-white rounded border border-purple-300 max-w-xs w-full">
      {/* Header mínimo */}
      <div className="bg-purple-600 px-2 py-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-white" />
          <span className="font-bold text-white text-[10px]">IA</span>
          <Badge className="bg-green-500 text-white text-[7px] px-0.5 py-0">50</Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-5 w-5 text-white hover:bg-white/20 p-0"
        >
          <X className="w-2.5 h-2.5" />
        </Button>
      </div>

      <div className="p-1.5 space-y-1.5">
        {/* Contexto mínimo */}
        {analiseContexto && (
          <div className="bg-purple-50 rounded p-1 border border-purple-200 space-y-0.5">
            {analiseContexto.open_loop?.is_overdue && (
              <div className="bg-red-50 p-1 rounded border-l border-red-500 mb-1">
                <span className="text-[8px] text-red-800 font-semibold">⚠️ Atraso {analiseContexto.open_loop.hours_since_promise}h</span>
              </div>
            )}
            
            <div className="flex items-center gap-0.5 flex-wrap">
              {(analiseContexto.conversation_type || analiseContexto.customer_intent) && (
                <Badge className="bg-white text-purple-800 border border-purple-300 text-[7px] px-0.5 py-0">
                  {(analiseContexto.conversation_type || analiseContexto.customer_intent) === 'orcamento' ? '💰' :
                   (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'pergunta' || analiseContexto.customer_intent === 'duvida' ? '❓' :
                   (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'reclamacao' ? '⚠️' :
                   (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'followup' ? '📞' :
                   (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'cortesia' ? '🟣' : '💬'}
                </Badge>
              )}
              {analiseContexto.urgency && (
                <Badge className={`text-[7px] px-0.5 py-0 ${
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
              <p className="text-[7px] text-purple-700 leading-tight">💡 {analiseContexto.next_best_action.action}</p>
            )}
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600 mx-auto" />
          </div>
        )}

        {status === 'error' && erro && (
          <div className="bg-red-50 border border-red-200 rounded p-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <Button onClick={() => gerarSugestoes(true)} size="sm" className="h-5 text-[7px] px-1">🔄</Button>
          </div>
        )}

        {(status === 'ready' || status === 'cached') && sugestoes.length > 0 && (
          <div className="space-y-0.5">
            {sugestoes.map((sugestao, index) => (
              <div
                key={index}
                onClick={() => onUseResposta(sugestao.texto)}
                className="bg-white hover:bg-purple-50 border border-purple-200 hover:border-purple-400 rounded cursor-pointer p-1"
              >
                <Badge className={`text-[7px] mb-0.5 ${getTomColor(sugestao.tom)} px-0.5 py-0`}>
                  {getTomIcon(sugestao.tom)}
                </Badge>
                <p className="text-[8px] text-slate-800 leading-tight">{sugestao.texto}</p>
              </div>
            ))}

            <Button
              onClick={() => gerarSugestoes(true)}
              variant="outline"
              size="sm"
              className="w-full h-5 border-purple-300 text-purple-700 hover:bg-purple-50 text-[7px] px-1 py-0"
              disabled={status === 'loading'}
            >
              🔄
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}