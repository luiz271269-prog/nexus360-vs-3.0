import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Brain,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';

export default function TerminalExecucao({ 
  historico, 
  loading, 
  aguardandoConfirmacao,
  comando, 
  setComando, 
  onEnviar,
  onConfirmar,
  sugestoesRapidas = []
}) {
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-scroll para última mensagem
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [historico]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnviar();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-lg border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          Terminal de Comandos
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Digite comandos em linguagem natural ou clique em uma skill
        </p>
      </div>

      {/* Histórico de Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {historico.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-4">
            <Sparkles className="w-16 h-16 opacity-30" />
            <div>
              <p className="text-sm font-medium">Nenhum comando executado ainda</p>
              <p className="text-xs mt-1">Digite um comando ou clique em "Executar" em uma skill</p>
            </div>
          </div>
        )}

        {historico.map((msg, idx) => (
          <div 
            key={idx}
            className={`flex gap-3 ${msg.tipo === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.tipo === 'agent' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className={`max-w-[80%] ${msg.tipo === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`rounded-2xl px-4 py-2.5 ${
                msg.tipo === 'user' 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                  : msg.sucesso === false
                  ? 'bg-red-50 border-2 border-red-200'
                  : msg.requer_confirmacao
                  ? 'bg-yellow-50 border-2 border-yellow-200'
                  : 'bg-slate-50 border border-slate-200'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                {msg.skill_executada && (
                  <Badge className="mt-2 bg-white/20 text-xs">
                    {msg.skill_executada}
                  </Badge>
                )}
                {msg.duracao_ms && (
                  <Badge className="mt-2 ml-2 bg-white/20 text-xs">
                    {msg.duracao_ms}ms
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-slate-400 px-2">
                {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
              </span>
            </div>

            {msg.tipo === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-sm text-slate-600">Processando...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card de Confirmação (se necessário) */}
      {aguardandoConfirmacao && (
        <div className="px-4 pb-3">
          <Card className="border-2 border-yellow-500 shadow-xl">
            <CardHeader className="bg-yellow-50 pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-900">
                <AlertTriangle className="w-4 h-4" />
                {aguardandoConfirmacao.nivel_risco === 'critico' ? '🔴 AÇÃO CRÍTICA' : '⚠️ CONFIRMAÇÃO NECESSÁRIA'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-700 whitespace-pre-wrap">
                {aguardandoConfirmacao.plano}
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                <p className="text-[10px] text-slate-600 mb-1">Para confirmar, digite exatamente:</p>
                <code className="text-xs font-mono bg-white px-2 py-1 rounded block">
                  {aguardandoConfirmacao.frase_confirmacao}
                </code>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="Digite a frase de confirmação..."
                  className="text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      onConfirmar(e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const input = inputRef.current;
                    if (input) {
                      onConfirmar(input.value);
                      input.value = '';
                    }
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Confirmar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sugestões Rápidas */}
      {sugestoesRapidas.length > 0 && !aguardandoConfirmacao && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-slate-500 mb-2">Sugestões:</p>
          <div className="flex flex-wrap gap-1.5">
            {sugestoesRapidas.map((sugestao, idx) => (
              <button
                key={idx}
                onClick={() => setComando(sugestao)}
                className="text-[10px] px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-full border border-purple-200 transition-colors"
              >
                {sugestao}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input de Comando */}
      <div className="border-t border-slate-200 p-4 bg-slate-50">
        <div className="flex gap-2">
          <Input
            value={comando}
            onChange={(e) => setComando(e.target.value)}
            placeholder="Ex: followup orçamentos parados 7 dias"
            className="flex-1 text-sm"
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <Button
            onClick={onEnviar}
            disabled={loading || !comando.trim()}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {loading ? (
              <Clock className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}