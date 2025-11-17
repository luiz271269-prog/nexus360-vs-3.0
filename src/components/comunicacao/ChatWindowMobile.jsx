import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  ArrowLeft,
  MoreVertical,
  Phone,
  Paperclip,
  Mic,
  User
} from "lucide-react";
import { toast } from "sonner";
import MessageBubble from "./MessageBubble";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  CHAT WINDOW MOBILE-OPTIMIZED                                ║
 * ║  + Touch-friendly                                            ║
 * ║  + Keyboard-aware                                            ║
 * ║  + Pull to load more                                         ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export default function ChatWindowMobile({ threadId, onBack }) {
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Buscar thread e mensagens
  const { data: thread } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => base44.entities.MessageThread.get(threadId),
    enabled: !!threadId
  });

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      const msgs = await base44.entities.Message.filter(
        { thread_id: threadId },
        'created_date',
        100
      );
      return msgs;
    },
    enabled: !!threadId,
    refetchInterval: 3000 // Atualizar a cada 3s
  });

  const { data: contact } = useQuery({
    queryKey: ['contact', thread?.contact_id],
    queryFn: () => base44.entities.Contact.get(thread.contact_id),
    enabled: !!thread?.contact_id
  });

  // Mutation para enviar mensagem
  const enviarMutation = useMutation({
    mutationFn: async (novaMensagem) => {
      if (!thread?.whatsapp_integration_id) {
        throw new Error('Integração WhatsApp não encontrada');
      }

      // Enviar via WhatsApp
      await base44.functions.invoke('enviarWhatsApp', {
        integration_id: thread.whatsapp_integration_id,
        numero_destino: contact.telefone,
        mensagem: novaMensagem
      });

      // Registrar no banco
      await base44.entities.Message.create({
        thread_id: threadId,
        sender_id: thread.assigned_user_id || 'system',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        content: novaMensagem,
        channel: 'whatsapp',
        status: 'enviada',
        sent_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', threadId]);
      setMensagem('');
      setEnviando(false);
      scrollToBottom();
    },
    onError: (error) => {
      toast.error('Erro ao enviar: ' + error.message);
      setEnviando(false);
    }
  });

  const handleEnviar = () => {
    if (!mensagem.trim() || enviando) return;
    
    setEnviando(true);
    enviarMutation.mutate(mensagem.trim());
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-900 truncate">
            {contact?.nome || 'Carregando...'}
          </h2>
          <p className="text-xs text-slate-500 truncate">
            {contact?.telefone}
          </p>
        </div>
        
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
          <Phone className="w-5 h-5 text-slate-600" />
        </button>
        
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
          <MoreVertical className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mensagens.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 p-4 safe-area-inset-bottom">
        <div className="flex items-end gap-2">
          <button className="p-3 hover:bg-slate-100 rounded-full transition-colors active:scale-95 flex-shrink-0">
            <Paperclip className="w-5 h-5 text-slate-600" />
          </button>
          
          <div className="flex-1">
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEnviar();
                }
              }}
              placeholder="Digite uma mensagem..."
              className="w-full px-4 py-3 text-base rounded-2xl border-2 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none min-h-[44px] max-h-[120px]"
              rows={1}
            />
          </div>
          
          {mensagem.trim() ? (
            <button
              onClick={handleEnviar}
              disabled={enviando}
              className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
            >
              {enviando ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          ) : (
            <button className="p-3 hover:bg-slate-100 rounded-full transition-colors active:scale-95 flex-shrink-0">
              <Mic className="w-5 h-5 text-slate-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}