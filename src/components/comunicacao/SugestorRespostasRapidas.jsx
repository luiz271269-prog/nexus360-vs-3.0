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

        {/* Sugestões - Ultra compactas */}
        {(status === 'ready' || status === 'cached') && sugestoes.length > 0 && (
          <div className="space-y-1.5">
            {status === 'cached' && (
              <div className="flex items-center justify-center gap-1.5 py-1 px-2 bg-green-50 border border-green-200 rounded">
                <Badge className="bg-green-600 text-white text-[8px] px-1 py-0">⚡</Badge>
                <span className="text-[10px] text-green-700 font-medium">Cache</span>
              </div>
            )}

            {sugestoes.map((sugestao, index) => (
              <div
                key={index}
                onClick={() => onUseResposta(sugestao.texto)}
                className="bg-white hover:bg-purple-50 transition-all border border-purple-200 hover:border-purple-400 rounded-lg cursor-pointer group"
              >
                <div className="p-2">
                  <Badge className={`text-[9px] mb-1 ${getTomColor(sugestao.tom)}`}>
                    {getTomIcon(sugestao.tom)} {sugestao.tom}
                  </Badge>
                  <p className="text-xs text-slate-800 group-hover:text-slate-900 leading-snug">
                    {sugestao.texto}
                  </p>
                  <div className="mt-1 text-[9px] text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    👆 Clique para usar esta resposta
                  </div>
                </div>
              </div>
            ))}

            <Button
              onClick={() => gerarSugestoes(true)}
              variant="outline"
              size="sm"
              className="w-full h-7 border-purple-300 text-purple-700 hover:bg-purple-50 text-xs"
              disabled={status === 'loading'}
            >
              🔄 Gerar Novas
            </Button>
          </div>
        )}
      </div>
    </div>
  );

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