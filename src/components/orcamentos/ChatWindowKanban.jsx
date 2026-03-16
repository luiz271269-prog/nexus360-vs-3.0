import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Image as ImageIcon, Paperclip, Smile, Phone, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ChatWindowKanban({ thread, onClose }) {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    carregarMensagens();
  }, [thread?.id]);

  const carregarMensagens = async () => {
    if (!thread?.id) return;
    try {
      setLoading(true);
      const msgs = await base44.entities.Message.filter(
        { thread_id: thread.id },
        '-sent_at',
        50
      );
      setMessages(msgs.reverse());
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    try {
      setSending(true);
      await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'sistema',
        sender_type: 'user',
        content: messageText,
        channel: 'interno',
        status: 'enviada',
        visibility: 'public_to_customer'
      });
      
      setMessageText('');
      await carregarMensagens();
      toast.success('Mensagem enviada');
    } catch (error) {
      console.error('Erro ao enviar:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const contato = thread?.contato || {};
  const nomeExibicao = contato?.nome || contato?.telefone || 'Contato';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">{nomeExibicao}</h3>
          {contato?.empresa && <p className="text-white/80 text-[10px]">{contato.empresa}</p>}
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 p-2 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-50 to-white">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">Carregando...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                  msg.sender_type === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-slate-200 text-slate-900 rounded-bl-none'
                }`}
              >
                <p>{msg.content}</p>
                <span className={`text-[10px] block mt-1 ${
                  msg.sender_type === 'user' ? 'text-blue-100' : 'text-slate-500'
                }`}>
                  {msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm') : ''}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-slate-200 p-3 bg-white space-y-2">
        <form onSubmit={handleEnviarMensagem} className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="flex-1 text-sm h-9"
            disabled={sending}
          />
          <Button
            type="submit"
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white h-9 px-3"
            disabled={sending || !messageText.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Smile className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}