import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { enviarMensagemUnificada } from '@/functions/enviarMensagemUnificada';

export default function KanbanChatWindow({ orcamento, usuario, onClose }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [thread, setThread] = useState(null);
  const [contact, setContact] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    carregarConversa();
  }, [orcamento?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const carregarConversa = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;
      if (!telefone) {
        setErro('Telefone não cadastrado para este cliente.');
        setCarregando(false);
        return;
      }

      const tel = telefone.replace(/\D/g, '');

      // Busca por telefone_canonico ou telefone direto
      let contatos = await base44.entities.Contact.filter({ telefone_canonico: tel });
      if (!contatos?.length) {
        contatos = await base44.entities.Contact.filter({ telefone: telefone });
      }
      if (!contatos?.length) {
        setErro(`Contato não encontrado para o telefone: ${telefone}`);
        setCarregando(false);
        return;
      }

      const c = contatos[0];
      setContact(c);

      const threads = await base44.entities.MessageThread.filter({ contact_id: c.id, is_canonical: true });
      if (!threads?.length) {
        setErro('Nenhuma conversa WhatsApp encontrada para este contato.');
        setCarregando(false);
        return;
      }

      const t = threads[0];
      setThread(t);

      const msgs = await base44.entities.Message.filter({ thread_id: t.id }, '-sent_at', 50);
      setMensagens((msgs || []).reverse());
    } catch (e) {
      setErro('Erro ao carregar conversa: ' + (e.message || 'erro desconhecido'));
    } finally {
      setCarregando(false);
    }
  };

  const enviarMensagem = async () => {
    if (!texto.trim() || !thread || !contact) return;
    const textoEnvio = texto.trim();
    setEnviando(true);
    setTexto('');

    // Mensagem otimista
    const msgTemp = {
      id: 'temp-' + Date.now(),
      thread_id: thread.id,
      sender_id: usuario?.id,
      sender_type: 'user',
      content: textoEnvio,
      status: 'enviando',
      sent_at: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, msgTemp]);

    try {
      // Usa o mesmo canal do sistema real
      await enviarMensagemUnificada({
        thread_id: thread.id,
        contact_id: contact.id,
        content: textoEnvio,
        sender_id: usuario?.id,
        sender_name: usuario?.full_name,
      });

      // Atualiza status da mensagem temp para enviada
      setMensagens(prev => prev.map(m =>
        m.id === msgTemp.id ? { ...m, status: 'enviada' } : m
      ));
    } catch (e) {
      // Remove mensagem temp em caso de erro
      setMensagens(prev => prev.filter(m => m.id !== msgTemp.id));
      setTexto(textoEnvio);
    } finally {
      setEnviando(false);
    }
  };

  const formatHora = (ts) => {
    if (!ts) return '';
    try { return format(new Date(ts), 'HH:mm'); } catch { return ''; }
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      style={{ maxHeight: '480px', minHeight: '300px' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {orcamento.cliente_nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-xs truncate">{orcamento.cliente_nome}</p>
            <p className="text-slate-400 text-[10px] truncate">
              {contact?.telefone || orcamento.cliente_telefone || orcamento.cliente_celular || 'Sem telefone'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-2 flex-shrink-0 p-1 rounded-lg hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 min-h-0">
        {carregando ? (
          <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            <span className="text-[10px] text-slate-400">Carregando conversa...</span>
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4 gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-red-500 font-semibold mb-1">Não foi possível abrir</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">{erro}</p>
            </div>
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400 gap-2">
            <MessageSquare className="w-8 h-8 opacity-20" />
            <span className="text-xs">Nenhuma mensagem ainda</span>
          </div>
        ) : mensagens.map((msg) => {
          const isUser = msg.sender_type === 'user';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                isUser
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-br-sm shadow-sm'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
              } ${msg.id?.startsWith('temp-') ? 'opacity-70' : ''}`}>
                <p>{msg.content}</p>
                <p className={`text-[9px] mt-0.5 ${isUser ? 'text-green-100' : 'text-slate-400'} text-right`}>
                  {msg.id?.startsWith('temp-') ? '...' : formatHora(msg.sent_at || msg.created_date)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!erro && (
        <div className="flex-shrink-0 border-t border-slate-200 p-2 bg-white flex gap-2">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
            placeholder="Digite uma mensagem..."
            className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
            disabled={enviando || carregando}
            autoFocus
          />
          <button
            onClick={enviarMensagem}
            disabled={!texto.trim() || enviando || carregando}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 text-white p-2 rounded-xl transition-all flex-shrink-0 active:scale-95"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}