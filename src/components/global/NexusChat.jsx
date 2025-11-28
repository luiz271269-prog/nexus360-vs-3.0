import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { AnimatePresence, motion } from 'framer-motion';

export default function NexusChat({ isOpen, onToggle }) {
  const [mensagens, setMensagens] = useState([]);
  const [inputMensagem, setInputMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState(null);
  const messagesEndRef = useRef(null);

  // ✅ ADICIONAR PROTEÇÃO DE RATE LIMIT
  const [ultimaConsulta, setUltimaConsulta] = useState(0);
  const MIN_INTERVALO = 2000; // 2 segundos entre mensagens

  useEffect(() => {
    if (isOpen) {
      inicializar();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const inicializar = async () => {
    try {
      const user = await base44.auth.me();
      setUsuario(user);

      if (mensagens.length === 0) {
        adicionarMensagemSistema(
          `Olá, ${user.full_name}! 👋\n\n` +
          `Sou o **Nexus**, seu assistente inteligente do VendaPro.\n\n` +
          `**Posso ajudar você a:**\n` +
          `• 🔍 Buscar clientes, produtos e orçamentos\n` +
          `• 📝 Criar tarefas para vendedores\n` +
          `• 📊 Gerar relatórios e análises\n` +
          `• 💬 Registrar interações com clientes\n` +
          `• ❓ Responder perguntas sobre o sistema\n\n` +
          `**Exemplos de comandos:**\n` +
          `"Buscar cliente Empresa X"\n` +
          `"Criar tarefa urgente para João"\n` +
          `"Quantos orçamentos tenho pendentes?"\n\n` +
          `Como posso ajudar você hoje?`
        );
      }
    } catch (error) {
      console.error('Erro ao inicializar Nexus:', error);
      setErro('Erro ao conectar com o sistema. Verifique sua conexão.');
      toast.error('Erro ao inicializar Nexus');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const adicionarMensagemSistema = (conteudo) => {
    const novaMensagemSistema = {
      id: Date.now(),
      role: 'assistant',
      content: conteudo,
      timestamp: new Date().toISOString()
    };
    setMensagens(prev => [...prev, novaMensagemSistema]);
  };

  const handleEnviarMensagem = async (e) => { // Renamed from handleEnviar in outline to match existing function name
    e.preventDefault();

    if (!inputMensagem.trim() || enviando) return;

    // ✅ PROTEÇÃO: Rate limit local
    const agora = Date.now();
    const tempoDecorrido = agora - ultimaConsulta;

    if (tempoDecorrido < MIN_INTERVALO) {
      toast.warning('⏳ Aguarde alguns segundos antes de enviar outra mensagem');
      return;
    }

    const mensagemUsuario = inputMensagem.trim();
    setInputMensagem('');
    setEnviando(true);
    setUltimaConsulta(agora);
    setErro(null); // Clear previous errors

    const novaMensagem = {
      id: Date.now(),
      role: 'user',
      content: mensagemUsuario,
      timestamp: new Date().toISOString()
    };

    setMensagens(prev => [...prev, novaMensagem]);

    try {
      // ✅ TIMEOUT: 15 segundos máximo
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 15000);
      });

      const { InvokeLLM } = await import("@/integrations/Core");

      // Contexto das últimas mensagens
      const contextoConversa = mensagens
        .slice(-5) // Get last 5 messages for context
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      // Enhance context with user info if available
      const userInfo = usuario ? `Nome do usuário: ${usuario.full_name}\nEmail: ${usuario.email}` : '';

      const consultaPromise = InvokeLLM({
        prompt: `Você é o Nexus, assistente inteligente do VendaPro. Seu objetivo é ajudar o usuário com tarefas e informações relacionadas ao sistema VendaPro.

${userInfo ? `**INFORMAÇÕES DO USUÁRIO:**\n${userInfo}\n\n` : ''}
**HISTÓRICO DA CONVERSA:**
${contextoConversa.map(c => `${c.role}: ${c.content}`).join('\n')}

**PERGUNTA DO USUÁRIO:**
${mensagemUsuario}

Responda de forma clara, concisa e útil.`,
        add_context_from_internet: false // As per outline, explicitly set to false
      });

      const resultado = await Promise.race([consultaPromise, timeoutPromise]);

      const respostaIA = {
        id: Date.now() + 1,
        role: 'assistant',
        content: resultado,
        timestamp: new Date().toISOString()
      };

      setMensagens(prev => [...prev, respostaIA]);

    } catch (error) {
      console.error('[NEXUS CHAT] Erro:', error);

      let mensagemErro = 'Desculpe, houve um erro ao processar sua mensagem.';

      if (error.message === 'Timeout') {
        mensagemErro = '⏱️ A consulta demorou muito. Tente novamente com uma pergunta mais simples.';
        toast.error(mensagemErro);
      } else if (error.message?.includes('Rate limit')) {
        mensagemErro = '🚫 Muitas consultas. Aguarde alguns segundos e tente novamente.';
        toast.error(mensagemErro);
      } else {
        toast.error('Erro ao processar mensagem: ' + error.message);
      }

      const erroMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: mensagemErro,
        timestamp: new Date().toISOString()
      };

      setMensagens(prev => [...prev, erroMsg]);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleEnviarMensagem(e);
    }
  };

  const limparConversa = () => {
    setMensagens([]);
    setErro(null);
    inicializar();
    toast.success('Conversa limpa');
  };

  const renderMensagem = (mensagem) => {
    const isUser = mensagem.role === 'user';

    const getIcon = () => {
      switch (mensagem.role) {
        case 'user':
          return <User className="w-4 h-4" />;
        case 'assistant':
          // Check for specific assistant messages
          if (mensagem.content.startsWith('❌') || mensagem.content.startsWith('⏱️') || mensagem.content.startsWith('🚫')) return <AlertCircle className="w-4 h-4 text-red-500" />;
          return <Bot className="w-4 h-4 text-purple-500" />;
        default:
          return <Bot className="w-4 h-4 text-purple-500" />;
      }
    };

    const getBackgroundColor = () => {
      if (isUser) return 'bg-blue-500 text-white';
      if (mensagem.content.startsWith('❌') || mensagem.content.startsWith('⏱️') || mensagem.content.startsWith('🚫')) return 'bg-red-50 text-red-800 border border-red-200';
      return 'bg-white border border-gray-200';
    };

    return (
      <div key={mensagem.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-500 text-white' :
          (mensagem.content.startsWith('❌') || mensagem.content.startsWith('⏱️') || mensagem.content.startsWith('🚫')) ? 'bg-red-100' :
          'bg-purple-100'
        }`}>
          {getIcon()}
        </div>
        <div className={`flex-1 max-w-xs ${isUser ? 'text-right' : ''}`}>
          <div className={`inline-block p-3 rounded-lg text-sm ${getBackgroundColor()}`}>
            <div className="whitespace-pre-wrap break-words">{mensagem.content}</div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {mensagem.timestamp ? format(new Date(mensagem.timestamp), 'HH:mm') : ''}
          </p>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="fixed bottom-24 right-6 w-[480px] h-[680px] bg-white rounded-2xl shadow-2xl border-2 border-purple-200 flex flex-col z-50"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold">Nexus AI</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-purple-100">Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={limparConversa}
                className="text-white hover:bg-white/20"
                title="Limpar conversa"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggle} className="text-white hover:bg-white/20">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto scrollbar-custom bg-gray-50">
            {erro && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-800">{erro}</p>
                  </div>
                </div>
              )}
            <div className="space-y-4">
              {mensagens.map(renderMensagem)}
              {enviando && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-white border border-gray-200 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                        <span className="text-sm text-gray-600">Nexus está digitando...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-200">
            <form onSubmit={handleEnviarMensagem} className="flex gap-2">
              <Input
                value={inputMensagem}
                onChange={(e) => setInputMensagem(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={"Digite sua mensagem..."}
                disabled={enviando}
                className="flex-1 text-sm"
              />
              <Button
                type="submit"
                disabled={enviando || !inputMensagem.trim()}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {enviando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}