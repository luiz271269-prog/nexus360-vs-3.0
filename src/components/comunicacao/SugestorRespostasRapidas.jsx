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
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-purple-900 text-sm">Análise Completa IA</h4>
                <Badge className="bg-green-500 text-white text-[8px] px-1.5 py-0 font-bold">
                  50 MENSAGENS
                </Badge>
              </div>
              <p className="text-[10px] text-purple-600">Contexto + Comportamento</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-purple-600 hover:bg-purple-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Contexto da Análise */}
        <div className="bg-white rounded-lg p-3 mb-3 border border-purple-200 shadow-sm space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs">💬</span>
            </div>
            <div className="flex-1 min-w-0">
              {analiseContexto?.is_latest_courtesy ? (
                <>
                  <p className="text-xs text-purple-700 font-semibold mb-1">Última mensagem ÚTIL do cliente:</p>
                  <p className="text-sm text-slate-800 font-medium mb-2">{analiseContexto.last_useful_message}</p>

                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-100">
                    <Badge className="bg-purple-500 text-white text-[8px] px-1 py-0">🟣 CORTESIA</Badge>
                    <p className="text-xs text-purple-600 italic">"{analiseContexto.last_customer_message}"</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-purple-700 font-semibold mb-1">Última mensagem do cliente:</p>
                  <p className="text-sm text-slate-800 line-clamp-2 font-medium">{mensagemCliente}</p>
                </>
              )}
            </div>
          </div>

          {/* Open Loop Warning */}
          {analiseContexto?.open_loop?.is_overdue && (
            <div className="pt-2 border-t border-red-100 bg-red-50 p-2 rounded">
              <div className="flex items-center gap-1 mb-1">
                <Badge className="bg-red-600 text-white text-xs">⚠️ ATRASO</Badge>
                <span className="text-xs text-red-700 font-semibold">
                  Atendente prometeu retorno há {analiseContexto.open_loop.hours_since_promise}h
                </span>
              </div>
              <p className="text-xs text-red-600 italic">"{analiseContexto.open_loop.promise_text}"</p>
            </div>
          )}
          
          {analiseContexto && (
            <div className="pt-2 border-t border-purple-100 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {(analiseContexto.conversation_type || analiseContexto.customer_intent) && (
                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                    {(analiseContexto.conversation_type || analiseContexto.customer_intent) === 'orcamento' ? '💰 Orçamento' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'pergunta' || analiseContexto.customer_intent === 'duvida' ? '❓ Pergunta' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'reclamacao' ? '⚠️ Reclamação' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'followup' ? '📞 Follow-up' :
                     (analiseContexto.conversation_type || analiseContexto.customer_intent) === 'cortesia' ? '🟣 Cortesia' : '💬 Outro'}
                  </Badge>
                )}
                {analiseContexto.urgency && (
                  <Badge className={`text-xs ${
                    analiseContexto.urgency === 'alta' ? 'bg-red-100 text-red-700' :
                    analiseContexto.urgency === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {analiseContexto.urgency === 'alta' ? '🔴 Alta' :
                     analiseContexto.urgency === 'media' ? '🟡 Média' : '🟢 Baixa'}
                  </Badge>
                )}
              </div>
              {analiseContexto.next_best_action?.action && (
                <p className="text-xs text-purple-600">
                  💡 <strong>Ação:</strong> {analiseContexto.next_best_action.action}
                </p>
              )}
              {analiseContexto.next_best_action?.ask && (
                <p className="text-xs text-purple-600">
                  ❓ <strong>Confirmar:</strong> {analiseContexto.next_best_action.ask}
                </p>
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

        {/* Sugestões */}
        {(status === 'ready' || status === 'cached') && sugestoes.length > 0 && (
          <div className="space-y-2">
            {/* Badge de Cache/Geração */}
            {status === 'cached' && (
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-green-50 border border-green-200 rounded-lg">
                <Badge className="bg-green-500 text-white text-[9px] px-1.5 py-0.5">⚡ CACHE</Badge>
                <span className="text-xs text-green-700 font-medium">Resposta instantânea</span>
              </div>
            )}

            {sugestoes.map((sugestao, index) => (
              <Card 
                key={index}
                className="bg-white hover:bg-purple-50 transition-colors border-purple-200 hover:border-purple-400 cursor-pointer group"
                onClick={() => onUseResposta(sugestao.texto)}
              >
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`text-xs ${getTomColor(sugestao.tom)}`}>
                      {getTomIcon(sugestao.tom)} {sugestao.tom}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-700 group-hover:text-slate-900">
                    {sugestao.texto}
                  </p>
                  <div className="mt-2 text-xs text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    👆 Clique para usar esta resposta
                  </div>
                </div>
              </Card>
            ))}

            {/* Botão Gerar Novamente */}
            <Button
              onClick={() => gerarSugestoes(true)}
              variant="outline"
              size="sm"
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
              disabled={status === 'loading'}
            >
              🔄 Gerar Novas Sugestões
            </Button>
            </div>
            )}

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-purple-100">
          <p className="text-xs text-purple-600 text-center">
            💡 Dica: Você pode editar a resposta antes de enviar
          </p>
        </div>
      </div>
    </Card>
  );
}