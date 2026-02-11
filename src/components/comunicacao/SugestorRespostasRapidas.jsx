import React, { useState, useEffect } from "react";
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
  const [gerando, setGerando] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [erro, setErro] = useState(null);
  const [analiseContexto, setAnaliseContexto] = useState(null); // ✅ Análise da conversa

  const gerarSugestoes = async () => {
    if (!mensagemCliente || mensagemCliente.length < 5) {
      toast.error('Mensagem muito curta para gerar sugestões');
      return;
    }

    setGerando(true);
    setErro(null);
    setSugestoes([]);

    try {
      console.log('[SUGESTOR] 🧠 Usando função V3 com análise comportamental');

      // ✅ Chamar função backend V3 que integra ContactBehaviorAnalysis (OTIMIZADO)
      const resultado = await base44.functions.invoke('gerarSugestoesRespostaContato', {
        contact_id: contactId,
        limit: 50, // ✅ OTIMIZADO: 50 mensagens (2x mais rápido que 100)
        tom: ['formal', 'amigavel', 'objetiva'],
        idioma: 'pt-BR'
      });

      if (resultado.data?.success && resultado.data.suggestions) {
        // Converter formato backend → formato UI
        const sugestoesUI = resultado.data.suggestions.map(s => ({
          texto: s.message,
          tom: s.tone,
          title: s.title
        }));
        
        setSugestoes(sugestoesUI);
        setAnaliseContexto(resultado.data.analysis); // ✅ Armazenar análise
        console.log('[SUGESTOR] ✅ Sugestões V3 geradas:', sugestoesUI.length);
        
        // Mostrar análise se disponível
        if (resultado.data.analysis?.customer_intent) {
          const intent = resultado.data.analysis.customer_intent;
          const urgency = resultado.data.analysis.urgency;
          const intentLabels = {
            'orcamento': '💰 Orçamento',
            'duvida': '❓ Dúvida',
            'reclamacao': '⚠️ Reclamação',
            'followup': '📞 Follow-up',
            'outro': '💬 Outro'
          };
          toast.info(`${intentLabels[intent] || intent} • Urgência: ${urgency}`, { duration: 3000 });
        }
      } else {
        throw new Error(resultado.data?.error || 'Resposta inválida');
      }

    } catch (error) {
      console.error('[SUGESTOR] ❌ Erro ao gerar V3:', error);
      setErro('Não foi possível gerar sugestões. Tente novamente.');
      
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
      setGerando(false);
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

  // ✅ Gerar sugestões automaticamente ao montar
  useEffect(() => {
    if (contactId && sugestoes.length === 0 && !gerando && !erro) {
      gerarSugestoes();
    }
  }, [contactId]);

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
              <p className="text-xs text-purple-700 font-semibold mb-1">Última mensagem do cliente:</p>
              <p className="text-sm text-slate-800 line-clamp-2 font-medium">{mensagemCliente}</p>
            </div>
          </div>
          
          {analiseContexto && (
            <div className="pt-2 border-t border-purple-100 space-y-1">
              {analiseContexto.customer_intent && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                    {analiseContexto.customer_intent === 'orcamento' ? '💰 Orçamento' :
                     analiseContexto.customer_intent === 'duvida' ? '❓ Dúvida' :
                     analiseContexto.customer_intent === 'reclamacao' ? '⚠️ Reclamação' :
                     analiseContexto.customer_intent === 'followup' ? '📞 Follow-up' : '💬 Outro'}
                  </Badge>
                  <Badge className={`text-xs ${
                    analiseContexto.urgency === 'alta' ? 'bg-red-100 text-red-700' :
                    analiseContexto.urgency === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {analiseContexto.urgency === 'alta' ? '🔴 Alta' :
                     analiseContexto.urgency === 'media' ? '🟡 Média' : '🟢 Baixa'}
                  </Badge>
                </div>
              )}
              {analiseContexto.next_best_action?.action && (
                <p className="text-xs text-purple-600">
                  💡 <strong>Ação sugerida:</strong> {analiseContexto.next_best_action.action}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Geração automática ao montar */}
        {sugestoes.length === 0 && !gerando && !erro && (
          <div className="text-center py-6">
            <div className="relative w-16 h-16 mx-auto mb-3">
              <Loader2 className="w-16 h-16 animate-spin text-purple-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-purple-800" />
              </div>
            </div>
            <p className="text-sm font-semibold text-purple-800 mb-1">Analisando últimas 50 mensagens...</p>
            <p className="text-xs text-purple-600">Contexto + Comportamento + Intenção</p>
          </div>
        )}

        {/* Loading */}
        {gerando && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
            <span className="text-sm text-purple-700">Gerando sugestões...</span>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{erro}</p>
          </div>
        )}

        {/* Sugestões */}
        {sugestoes.length > 0 && (
          <div className="space-y-2">
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
              onClick={gerarSugestoes}
              variant="outline"
              size="sm"
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
              disabled={gerando}
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