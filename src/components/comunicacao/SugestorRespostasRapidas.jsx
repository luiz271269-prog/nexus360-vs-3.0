import { useState, useEffect, useRef } from "react";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Sugestor de Respostas Rápidas - V3 com Análise Comportamental
 * Integra últimas mensagens + insights da IA
 */
export default function SugestorRespostasRapidas({ 
  mensagemCliente, 
  threadId, 
  contactId, 
  onUseResposta,
  onClose 
}) {
  const [status, setStatus] = useState('idle'); // ✅ Estado único: idle | loading | cached | ready | error
  const [sugestoes, setSugestoes] = useState([]);
  const [erro, setErro] = useState(null);
  const [analiseContexto, setAnaliseContexto] = useState(null);
  const abortControllerRef = useRef(null);
  const reqSeqRef = useRef(0); // ✅ Controle de concorrência

  const gerarSugestoes = async (force = false) => {
    const seq = ++reqSeqRef.current; // ✅ Incrementar sequência
    
    // ✅ Cancelar requisição anterior
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
      console.log(`[SUGESTOR] 🧠 Chamando backend V3 (seq=${seq})...`);

      // ✅ Payload otimizado com thread_id
      const resultado = await base44.functions.invoke('gerarSugestoesRespostaContato', {
        thread_id: threadId || null, // ✅ NOVO: preferencial (-80ms)
        contact_id: contactId || null, // ✅ Fallback
        limit: 50,
        language: 'pt-BR',
        tones: ['formal', 'amigavel', 'objetiva'],
        force
      });

      // ✅ CRÍTICO: Ignorar se resposta chegou atrasada
      if (seq !== reqSeqRef.current) {
        console.log(`[SUGESTOR] ⚠️ Resposta descartada (seq=${seq}, atual=${reqSeqRef.current})`);
        return;
      }

      if (resultado.data?.success && resultado.data.suggestions) {
        const isCacheHit = resultado.data.meta?.cache_hit === true;
        
        // Converter formato backend → formato UI
        const sugestoesUI = resultado.data.suggestions.map(s => ({
          texto: s.message,
          tom: s.tone,
          title: s.title
        }));
        
        setSugestoes(sugestoesUI);
        setAnaliseContexto(resultado.data.analysis);
        setStatus(isCacheHit ? 'cached' : 'ready');
        
        console.log(`[SUGESTOR] ✅ ${isCacheHit ? 'Cache hit' : 'Sugestões geradas'} (${sugestoesUI.length} itens)`);
        
        // Toast informativo
        if (isCacheHit) {
          const cacheAge = resultado.data.meta.cache_age_seconds;
          toast.success(`⚡ Cache (${cacheAge}s atrás)`, { duration: 2000 });
        } else if (resultado.data.analysis?.customer_intent) {
          const intent = resultado.data.analysis.customer_intent;
          const urgency = resultado.data.analysis.urgency;
          const intentLabels = {
            'orcamento': '💰 Orçamento',
            'duvida': '❓ Dúvida',
            'reclamacao': '⚠️ Reclamação',
            'followup': '📞 Follow-up',
            'outro': '💬 Outro'
          };
          toast.info(`${intentLabels[intent] || intent} • ${urgency}`, { duration: 3000 });
        }
      } else {
        throw new Error(resultado.data?.error || 'Resposta inválida');
      }

    } catch (error) {
      // ✅ Ignorar erros de requisições antigas
      if (seq !== reqSeqRef.current) {
        console.log(`[SUGESTOR] ⚠️ Erro de req antiga ignorado (seq=${seq})`);
        return;
      }
      
      if (error.name === 'AbortError') {
        console.log('[SUGESTOR] ⚠️ Requisição cancelada');
        return;
      }
      
      console.error('[SUGESTOR] ❌ Erro ao gerar V3:', error);
      setErro('Não foi possível gerar sugestões. Tente novamente.');
      setStatus('error');
      
      // Fallback: sugestões genéricas
      setSugestoes([
        { 
          texto: 'Obrigado pela sua mensagem! Vou verificar isso para você e retorno em breve.', 
          tom: 'formal' 
        },
        { 
          texto: 'Entendi sua solicitação. Estou analisando e já te respondo! 😊', 
          tom: 'amigavel' 
        },
        { 
          texto: 'Recebi sua mensagem. Aguarde um momento enquanto verifico os detalhes.', 
          tom: 'objetiva' 
        }
      ]);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const getTomColor = (tom) => {
    switch(tom) {
      case 'formal': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'amigavel': return 'bg-green-100 text-green-700 border-green-200';
      case 'objetiva': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
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

  // ✅ Gerar sugestões automaticamente ao montar/trocar thread
  useEffect(() => {
    if (!contactId && !threadId) return;
    
    // ✅ Guard: evitar chamadas redundantes
    if (status === 'loading' || status === 'cached' || status === 'ready') {
      console.log('[SUGESTOR] ⏭️ Pulando disparo (já em processo ou pronto)');
      return;
    }
    
    // Debounce: aguardar 200ms antes de disparar
    const timer = setTimeout(() => {
      gerarSugestoes(false);
    }, 200);
    
    return () => {
      clearTimeout(timer);
      // Cancelar requisição em andamento ao desmontar
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [threadId, contactId]); // ✅ Depende de AMBOS (corrige bug de cache de thread)

  return (
    <div className="bg-white rounded-xl shadow-xl border-2 border-purple-300 overflow-hidden">
      {/* Header compacto e elegante */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm">Análise Completa IA</h4>
              <Badge className="bg-green-500 text-white text-[9px] px-1.5 py-0.5 font-bold shadow-sm">
                50 MENSAGENS
              </Badge>
            </div>
            <p className="text-[10px] text-purple-100">Contexto + Comportamento</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-white hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Conteúdo principal */}
      <div className="p-4 space-y-3">
        {/* Contexto da Análise - Design melhorado */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-200 shadow-sm space-y-3">
          {/* Mensagem do cliente */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-base">💬</span>
            </div>
            <div className="flex-1 min-w-0">
              {analiseContexto?.is_latest_courtesy ? (
                <>
                  <p className="text-xs text-purple-700 font-semibold mb-1.5">Última mensagem ÚTIL do cliente:</p>
                  <p className="text-sm text-slate-900 font-medium mb-2 leading-relaxed">{analiseContexto.last_useful_message}</p>

                  <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-purple-200 shadow-sm">
                    <Badge className="bg-purple-500 text-white text-[9px] px-1.5 py-0.5 font-bold">🟣 CORTESIA</Badge>
                    <p className="text-xs text-purple-700 italic font-medium">"{analiseContexto.last_customer_message}"</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-purple-700 font-semibold mb-1.5">Última mensagem do cliente:</p>
                  <p className="text-sm text-slate-900 line-clamp-2 font-medium leading-relaxed">{mensagemCliente}</p>
                </>
              )}
            </div>
          </div>

          {/* Open Loop Warning */}
          {analiseContexto?.open_loop?.is_overdue && (
            <div className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge className="bg-red-600 text-white text-xs font-bold shadow-sm">⚠️ ATRASO</Badge>
                <span className="text-xs text-red-800 font-semibold">
                  Atendente prometeu retorno há {analiseContexto.open_loop.hours_since_promise}h
                </span>
              </div>
              <p className="text-xs text-red-700 italic font-medium">"{analiseContexto.open_loop.promise_text}"</p>
            </div>
          )}
          
          {/* Badges de análise */}
          {analiseContexto && (
            <div className="pt-2.5 border-t border-purple-200 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {(analiseContexto.conversation_type || analiseContexto.customer_intent) && (
                  <Badge className="bg-white text-purple-800 border border-purple-300 text-xs font-semibold shadow-sm">
                    {(analiseContexto.conversation_type || analiseContexto.customer_intent) === 'orcamento' ? '💰 Orçamento' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'pergunta' || analiseContexto.customer_intent === 'duvida' ? '❓ Pergunta' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'reclamacao' ? '⚠️ Reclamação' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'followup' ? '📞 Follow-up' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'cortesia' ? '🟣 Cortesia' : '💬 Outro'}
                  </Badge>
                )}
                {analiseContexto.urgency && (
                  <Badge className={`text-xs font-semibold shadow-sm ${
                    analiseContexto.urgency === 'alta' ? 'bg-red-100 text-red-800 border border-red-300' :
                    analiseContexto.urgency === 'media' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                    'bg-green-100 text-green-800 border border-green-300'
                  }`}>
                    {analiseContexto.urgency === 'alta' ? '🔴 Alta' :
                     analiseContexto.urgency === 'media' ? '🟡 Média' : '🟢 Baixa'}
                  </Badge>
                )}
              </div>
              {analiseContexto.next_best_action?.action && (
                <div className="flex items-start gap-2 p-2 bg-white rounded-lg border border-purple-200">
                  <span className="text-sm">💡</span>
                  <p className="text-xs text-purple-700 font-medium leading-relaxed">
                    <strong className="text-purple-900">Ação:</strong> {analiseContexto.next_best_action.action}
                  </p>
                </div>
              )}
              {analiseContexto.next_best_action?.ask && (
                <div className="flex items-start gap-2 p-2 bg-white rounded-lg border border-purple-200">
                  <span className="text-sm">❓</span>
                  <p className="text-xs text-purple-700 font-medium leading-relaxed">
                    <strong className="text-purple-900">Confirmar:</strong> {analiseContexto.next_best_action.ask}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading States */}
        {status === 'idle' && (
          <div className="text-center py-4">
            <p className="text-sm text-purple-600">Inicializando...</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center py-6">
            <div className="relative w-16 h-16 mx-auto mb-3">
              <Loader2 className="w-16 h-16 animate-spin text-purple-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-purple-800" />
              </div>
            </div>
            <p className="text-sm font-semibold text-purple-800 mb-1">⚡ Analisando conversa...</p>
            <p className="text-xs text-purple-600">Verificando cache + contexto</p>
          </div>
        )}

        {/* Erro */}
        {status === 'error' && erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700 mb-2">{erro}</p>
              <Button
                onClick={() => gerarSugestoes(true)}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                🔄 Tentar Novamente
              </Button>
            </div>
          </div>
        )}

        {/* Sugestões - Cards maiores e mais legíveis */}
        {(status === 'ready' || status === 'cached') && sugestoes.length > 0 && (
          <div className="space-y-3">
            {/* Badge de Cache/Geração */}
            {status === 'cached' && (
              <div className="flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg shadow-sm">
                <Badge className="bg-green-600 text-white text-[10px] px-2 py-0.5 font-bold shadow-sm">⚡ CACHE</Badge>
                <span className="text-xs text-green-800 font-semibold">Resposta instantânea</span>
              </div>
            )}

            {sugestoes.map((sugestao, index) => (
              <div
                key={index}
                onClick={() => onUseResposta(sugestao.texto)}
                className="bg-white hover:bg-gradient-to-br hover:from-purple-50 hover:to-indigo-50 transition-all duration-200 border-2 border-purple-200 hover:border-purple-400 rounded-xl cursor-pointer group shadow-sm hover:shadow-md"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={`text-xs font-semibold shadow-sm ${getTomColor(sugestao.tom)}`}>
                      {getTomIcon(sugestao.tom)} {sugestao.tom}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-800 group-hover:text-slate-900 font-medium leading-relaxed">
                    {sugestao.texto}
                  </p>
                  <div className="mt-3 pt-3 border-t border-purple-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-purple-600 font-semibold">
                      👆 Clique para usar esta resposta
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Botão Gerar Novamente */}
            <Button
              onClick={() => gerarSugestoes(true)}
              variant="outline"
              size="sm"
              className="w-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 font-semibold shadow-sm hover:shadow-md transition-all"
              disabled={status === 'loading'}
            >
              🔄 Gerar Novas Sugestões
            </Button>
          </div>
        )}

        {/* Footer - Removido para economizar espaço */}
      </div>
    </div>
  );
}