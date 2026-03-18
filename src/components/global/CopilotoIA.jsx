import React, { useState, useEffect, useRef } from 'react';
import { X, Brain, Send, Loader2, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

const PERSONA_SISTEMA = `Você é o Copiloto IA do Nexus360, assistente da NeuralTec para a equipe da Liesch Informática.
Responda de forma direta, objetiva e profissional em português brasileiro.
Você auxilia a equipe com: análise de clientes, estratégias de vendas, redação de mensagens comerciais, interpretação de dados do CRM, sugestões de abordagem, e dúvidas operacionais do sistema Nexus360.
Seja conciso. Use listas quando ajudar. Evite respostas genéricas — seja específico ao contexto da empresa.`;

export default function CopilotoIA({ isOpen, onClose, contextoAtivo = null, usuario = null }) {
  const [mensagens, setMensagens] = useState([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll automático ao fim
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, carregando]);

  // Focar input ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Limpar histórico ao fechar
  useEffect(() => {
    if (!isOpen) {
      setMensagens([]);
      setInput('');
    }
  }, [isOpen]);

  const buildSystemPrompt = () => {
    let prompt = PERSONA_SISTEMA;

    if (usuario) {
      prompt += `\n\nUSUÁRIO LOGADO:
- Nome: ${usuario.full_name || 'Não informado'}
- Email: ${usuario.email || ''}
- Role: ${usuario.role || 'user'}
- Setor: ${usuario.attendant_sector || 'geral'}
- Nível: ${usuario.attendant_role || 'pleno'}`;
    }

    if (contextoAtivo) {
      prompt += `\n\nCONTEXTO ATIVO NA TELA: ${contextoAtivo}`;
    }

    prompt += `\n\nData/hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

    return prompt;
  };

  const derivarSetor = (user) => {
    if (!user) return 'geral';
    if (user.role === 'admin') return 'admin';
    // Priorizar campo nativo do usuário
    if (user.attendant_sector) return user.attendant_sector;
    const email = user.email || '';
    if (email.includes('vendas')) return 'vendas';
    if (email.includes('financeiro')) return 'financeiro';
    if (email.includes('assistencia')) return 'assistencia';
    if (email.includes('compras')) return 'fornecedor';
    return 'geral';
  };

  const enviarMensagem = async () => {
    const texto = input.trim();
    if (!texto || carregando) return;

    const novaMensagem = { role: 'user', content: texto };
    const historicoAtualizado = [...mensagens, novaMensagem];

    setMensagens(historicoAtualizado);
    setInput('');
    setCarregando(true);

    try {
      const resposta = await base44.functions.invoke('agentCommand', {
        command: 'chat',
        user_message: texto,
        context: {
          user: {
            id: usuario?.id,
            nome: usuario?.full_name,
            role: usuario?.role,
            sector: derivarSetor(usuario),
          },
          page: 'copiloto',
          historico: mensagens.slice(-6).map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        },
      });

      const data = resposta?.data || resposta || {};
      const textoResposta =
        data.response || data.result || data.message || data.content ||
        (typeof data === 'string' ? data : 'Não foi possível obter resposta.');

      setMensagens(prev => [...prev, { role: 'assistant', content: textoResposta }]);
    } catch (error) {
      console.error('[CopilotoIA] Erro:', error);
      setMensagens(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Erro ao processar sua mensagem. Tente novamente.',
        erro: true
      }]);
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const limparConversa = () => {
    setMensagens([]);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
          onClick={onClose}
        />
      )}

      {/* Drawer lateral */}
      <div
        className={`fixed top-0 right-0 h-full z-[61] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } w-full md:w-[420px]`}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-700 to-violet-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">Copiloto IA — Nexus360</h2>
              <p className="text-purple-200 text-xs">Assistente da equipe Liesch</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {mensagens.length > 0 && (
              <button
                onClick={limparConversa}
                title="Limpar conversa"
                className="w-8 h-8 text-white/60 hover:text-white hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de contexto ativo */}
        {contextoAtivo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border-b border-purple-100 flex-shrink-0">
            <span className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 animate-pulse" />
            <span className="text-xs text-purple-700 truncate">
              <span className="font-semibold">Contexto:</span> {contextoAtivo}
            </span>
          </div>
        )}

        {/* Área de mensagens */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50"
        >
          {mensagens.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-slate-700 font-semibold mb-1">Copiloto IA pronto</h3>
              <p className="text-slate-400 text-sm max-w-[260px]">
                Pergunte sobre clientes, estratégias de vendas, redação de mensagens ou qualquer dúvida operacional.
              </p>
            </div>
          )}

          {mensagens.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-gradient-to-br from-purple-600 to-violet-700 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                  <Brain className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-sm'
                    : msg.erro
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-sm'
                    : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' && !msg.erro ? (
                  <ReactMarkdown
                    className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"
                    components={{
                      p: ({ children }) => <p className="my-1">{children}</p>,
                      ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                      ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                      li: ({ children }) => <li className="my-0.5">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      code: ({ children }) => <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {carregando && (
            <div className="flex justify-start">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-600 to-violet-700 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                <span className="text-slate-400 text-sm">Pensando...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-200">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta... (Enter para enviar)"
              rows={1}
              disabled={carregando}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50 max-h-28 overflow-y-auto"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px';
              }}
            />
            <button
              onClick={enviarMensagem}
              disabled={!input.trim() || carregando}
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0"
            >
              {carregando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
        </div>
      </div>
    </>
  );
}