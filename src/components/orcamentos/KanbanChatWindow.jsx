import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function KanbanChatWindow({ orcamento, usuario, onClose }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [thread, setThread] = useState(null);
  const [contact, setContact] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    carregarConversa();
  }, [orcamento]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const [erro, setErro] = useState(null);

  const carregarConversa = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;
      if (!telefone) { setErro('Telefone não cadastrado para este cliente.'); setCarregando(false); return; }

      const tel = telefone.replace(/\D/g, '');
      const contatos = await base44.entities.Contact.filter({ telefone_canonico: tel });
      if (!contatos?.length) { setErro('Contato não encontrado no sistema.'); setCarregando(false); return; }

      const c = contatos[0];
      setContact(c);

      const threads = await base44.entities.MessageThread.filter({ contact_id: c.id, is_canonical: true });
      if (!threads?.length) { setErro('Nenhuma conversa encontrada para este contato.'); setCarregando(false); return; }

      const t = threads[0];
      setThread(t);

      const msgs = await base44.entities.Message.filter({ thread_id: t.id }, '-sent_at', 50);
      setMensagens((msgs || []).reverse());
    } catch (e) {
      setErro('Erro ao carregar conversa: ' + e.message);
    } finally {
      setCarregando(false);
    }
  };

  const enviarMensagem = async () => {
    if (!texto.trim() || !thread) return;
    setEnviando(true);
    try {
      const nova = await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: usuario?.id,
        sender_type: 'user',
        content: texto.trim(),
        channel: thread.channel || 'whatsapp',
        status: 'enviando',
        sent_at: new Date().toISOString(),
        visibility: 'public_to_customer',
        metadata: { user_name: usuario?.full_name }
      });
      setMensagens(prev => [...prev, nova]);
      setTexto('');
    } catch (e) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  const formatHora = (ts) => {
    if (!ts) return '';
    try { return format(new Date(ts), 'HH:mm'); } catch { return ''; }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      style={{ maxHeight: '480px' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {orcamento.cliente_nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-xs truncate">{orcamento.cliente_nome}</p>
            <p className="text-slate-400 text-[10px] truncate">{contact?.telefone || ''}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 min-h-0">
        {carregando ? (
          <div className="flex items-center justify-center h-full py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-xs text-red-500 font-medium mb-1">Não foi possível abrir a conversa</p>
            <p className="text-[10px] text-slate-400">{erro}</p>
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">Nenhuma mensagem</span>
          </div>
        ) : mensagens.map((msg) => {
          const isUser = msg.sender_type === 'user';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                isUser
                  ? 'bg-green-500 text-white rounded-br-sm'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
              }`}>
                <p>{msg.content}</p>
                <p className={`text-[9px] mt-0.5 ${isUser ? 'text-green-100' : 'text-slate-400'} text-right`}>
                  {formatHora(msg.sent_at || msg.created_date)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-slate-200 p-2 bg-white flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
          placeholder="Digite uma mensagem..."
          className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
          disabled={enviando || carregando}
        />
        <button
          onClick={enviarMensagem}
          disabled={!texto.trim() || enviando || carregando}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white p-2 rounded-xl transition-colors flex-shrink-0"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}