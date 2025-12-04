import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Sugestor de Respostas Rápidas - VERSÃO OTIMIZADA
 * Reduzido ao mínimo de chamadas de API
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

  const gerarSugestoes = async () => {
    if (!mensagemCliente || mensagemCliente.length < 5) {
      toast.error('Mensagem muito curta para gerar sugestões');
      return;
    }

    setGerando(true);
    setErro(null);
    setSugestoes([]);

    try {
      console.log('[SUGESTOR] 🧠 Gerando sugestões para:', mensagemCliente.substring(0, 50));

      // Chamar LLM DIRETO sem consultar base de conhecimento (para reduzir rate limit)
      const prompt = `Você é um assistente de atendimento profissional.

Cliente perguntou: "${mensagemCliente}"

Gere 3 sugestões de respostas claras, objetivas e profissionais.
Formate como JSON:
{
  "sugestoes": [
    {"texto": "Resposta 1", "tom": "formal"},
    {"texto": "Resposta 2", "tom": "amigavel"},
    {"texto": "Resposta 3", "tom": "objetiva"}
  ]
}`;

      const resposta = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            sugestoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  texto: { type: "string" },
                  tom: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (resposta && resposta.sugestoes && Array.isArray(resposta.sugestoes)) {
        setSugestoes(resposta.sugestoes);
        console.log('[SUGESTOR] ✅ Sugestões geradas:', resposta.sugestoes.length);
      } else {
        throw new Error('Resposta inválida da IA');
      }

    } catch (error) {
      console.error('[SUGESTOR] ❌ Erro:', error);
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

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold text-purple-900">Sugestões de IA</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-purple-600 hover:bg-purple-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Mensagem do Cliente */}
        <div className="bg-white/60 rounded-lg p-3 mb-3 border border-purple-100">
          <p className="text-xs text-purple-600 font-medium mb-1">Cliente perguntou:</p>
          <p className="text-sm text-slate-700 line-clamp-2">{mensagemCliente}</p>
        </div>

        {/* Botão Gerar (só aparece se não tem sugestões) */}
        {sugestoes.length === 0 && !gerando && (
          <Button
            onClick={gerarSugestoes}
            disabled={gerando}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar Sugestões de Respostas
          </Button>
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