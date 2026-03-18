import React, { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Brain, Send, X, Minimize2, Maximize2, Sparkles, User, Loader2 } from 'lucide-react';

const AGENT_NAME = 'nexus_assistente';

export default function SuperAgenteChatFlutuante() {
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversa, setConversa] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [erro, setErro] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (aberto && !conversa) iniciarConversa();
  }, [aberto]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, loading]);

  useEffect(() => {
    if (aberto && !minimizado) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [aberto, minimizado]);

  // Limpar subscription ao desmontar
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  const iniciarConversa = async () => {
    setErro(null);
    setLoading(true);
    try {
      const novaConversa = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: 'Nexus AI Chat' }
      });
      setConversa(novaConversa);

      // Inscrever para streaming em tempo real ANTES de qualquer mensagem
      const unsub = base44.agents.subscribeToConversation(novaConversa.id, (data) => {
        setMensagens(data.messages || []);
        setLoading(false);
      });
      unsubscribeRef.current = unsub;

      // Carregar mensagens iniciais e filtrar qualquer mensagem de ativação do WhatsApp
      const msgs = (novaConversa.messages || []).filter(m =>
        !(m.role === 'user' && m.content?.includes('Activation code:'))
      );
      setMensagens(msgs);

    } catch (error) {
      console.error('[SuperAgente] Erro ao criar conversa:', error);
      setErro('Não foi possível conectar ao agente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const enviar = useCallback(async () => {
    const texto = mensagem.trim();
    if (!texto || loading || !conversa) return;

    setMensagem('');
    setLoading(true);

    // Adicionar mensagem do usuário imediatamente (otimista)
    setMensagens(prev => [...prev, {
      role: 'user',
      content: texto,
      created_at: new Date().toISOString()
    }]);

    try {
      await base44.agents.addMessage(conversa, { role: 'user', content: texto });
      // loading=false será chamado pelo subscribeToConversation quando a resposta chegar
    } catch (error) {
      console.error('[SuperAgente] Erro ao enviar:', error);
      setLoading(false);
      setErro('Erro ao enviar mensagem.');
    }
  }, [mensagem, loading, conversa]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const fechar = () => {
    setAberto(false);
    setMinimizado(false);
  };

  const reiniciar = () => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    setConversa(null);
    setMensagens([]);
    setErro(null);
    iniciarConversa();
  };

  const sugestoes = [
    'Quais orçamentos estão parados?',
    'Clientes sem contato há 7 dias',
    'Resumo das vendas do mês',
    'Tarefas pendentes urgentes'
  ];

  const mensagensFiltradas = mensagens.filter(m => m.role === 'user' || m.role === 'assistant');

  return (
    <>
      {/* Botão flutuante */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-300 group"
          title="Nexus AI"
        >
          <Brain className="w-7 h-7 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          <div className="absolute right-16 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
            Nexus AI
          </div>
        </button>
      )}

      {/* Painel Chat */}
      {aberto && (
        <div className={`fixed right-6 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col transition-all duration-300 ${
          minimizado ? 'bottom-6 w-72 h-14' : 'bottom-6 w-96 h-[580px]'
        }`}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-t-2xl flex-shrink-0 cursor-pointer"
               onClick={() => minimizado && setMinimizado(false)}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Nexus AI</p>
                {!minimizado && <p className="text-white/70 text-[10px]">Superagente • Online</p>}
              </div>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={() => setMinimizado(!minimizado)}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                {minimizado ? <Maximize2 className="w-3.5 h-3.5 text-white" /> : <Minimize2 className="w-3.5 h-3.5 text-white" />}
              </button>
              <button onClick={fechar}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {!minimizado && (
            <>
              {/* Área de mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">

                {/* Estado inicial vazio */}
                {mensagensFiltradas.length === 0 && !loading && !erro && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Olá! Sou o Nexus AI</p>
                      <p className="text-xs text-slate-500 mt-1">Como posso te ajudar hoje?</p>
                    </div>
                    <div className="w-full space-y-1.5">
                      {sugestoes.map((s, i) => (
                        <button key={i} onClick={() => setMensagem(s)}
                          className="w-full text-left text-xs px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-100 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Erro */}
                {erro && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <p className="text-sm text-red-500">{erro}</p>
                    <button onClick={reiniciar}
                      className="text-xs px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                      Tentar novamente
                    </button>
                  </div>
                )}

                {/* Mensagens */}
                {mensagensFiltradas.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Brain className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Digitando... */}
                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-slate-100 rounded-2xl px-4 py-3 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                  <button
                    onClick={enviar}
                    disabled={loading || !mensagem.trim() || !conversa}
                    className="h-9 w-9 flex-shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 rounded-xl flex items-center justify-center transition-all"
                  >
                    {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                  </button>
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