import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Send, X, Minimize2, Maximize2, Sparkles, User, Loader2 } from 'lucide-react';

export default function SuperAgenteChatFlutuante() {
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversa, setConversa] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Criar/carregar conversa ao abrir
  useEffect(() => {
    if (aberto && !conversa) {
      iniciarConversa();
    }
  }, [aberto]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  useEffect(() => {
    if (aberto && !minimizado) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [aberto, minimizado]);

  const iniciarConversa = async () => {
    try {
      const novaConversa = await base44.agents.createConversation({
        agent_name: 'promocoes_automaticas',
        metadata: { name: 'Chat Nexus AI' }
      });
      setConversa(novaConversa);
      setMensagens(novaConversa.messages || []);

      // Inscrever para receber respostas em tempo real
      base44.agents.subscribeToConversation(novaConversa.id, (data) => {
        setMensagens([...(data.messages || [])]);
        setLoading(false);
      });
    } catch (error) {
      console.error('[SuperAgente] Erro ao criar conversa:', error);
    }
  };

  const enviar = async () => {
    const texto = mensagem.trim();
    if (!texto || loading || !conversa) return;

    setMensagem('');
    setLoading(true);

    // Adicionar mensagem do usuário otimisticamente
    setMensagens(prev => [...prev, {
      role: 'user',
      content: texto,
      created_at: new Date().toISOString()
    }]);

    try {
      await base44.agents.addMessage(conversa, {
        role: 'user',
        content: texto
      });
      // A resposta vem pelo subscribeToConversation
    } catch (error) {
      console.error('[SuperAgente] Erro ao enviar:', error);
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const sugestoes = [
    'Quais orçamentos estão parados?',
    'Clientes sem contato há 7 dias',
    'Resumo das vendas do mês',
    'Tarefas pendentes urgentes'
  ];

  // Filtrar apenas mensagens user e assistant
  const mensagensFiltradas = mensagens.filter(m => m.role === 'user' || m.role === 'assistant');

  return (
    <>
      {/* Botão flutuante */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-300 group"
          title="Abrir Nexus AI"
        >
          <Brain className="w-7 h-7 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          <div className="absolute right-16 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
            Nexus AI
          </div>
        </button>
      )}

      {/* Painel de Chat */}
      {aberto && (
        <div className={`fixed right-6 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col transition-all duration-300 ${
          minimizado ? 'bottom-6 w-72 h-14' : 'bottom-6 w-96 h-[580px]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Nexus AI</p>
                {!minimizado && (
                  <p className="text-white/70 text-[10px]">Superagente • Online</p>
                )}
              </div>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimizado(!minimizado)}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                {minimizado ? <Maximize2 className="w-3.5 h-3.5 text-white" /> : <Minimize2 className="w-3.5 h-3.5 text-white" />}
              </button>
              <button
                onClick={() => { setAberto(false); setMinimizado(false); }}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {!minimizado && (
            <>
              {/* Mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {mensagensFiltradas.length === 0 && !loading && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Olá! Sou o Nexus AI</p>
                      <p className="text-xs text-slate-500 mt-1">Como posso te ajudar hoje?</p>
                    </div>
                    <div className="w-full space-y-1.5">
                      {sugestoes.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setMensagem(s)}
                          className="w-full text-left text-xs px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-100 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mensagensFiltradas.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Brain className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[80%] flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-slate-100 rounded-2xl px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-slate-100 p-3 flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 text-sm h-9 rounded-xl border-slate-200"
                    disabled={loading || !conversa}
                  />
                  <Button
                    onClick={enviar}
                    disabled={loading || !mensagem.trim() || !conversa}
                    size="sm"
                    className="h-9 w-9 p-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 text-center">Enter para enviar</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}