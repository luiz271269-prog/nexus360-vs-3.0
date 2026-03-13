import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2, AlertCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ComentariosInternos({
  messageId,
  usuarioAtual,
  contato = null,
  atendentes = [],
  hasPermission = false,
  onCommentAdded = null
}) {
  const [aberto, setAberto] = useState(false);
  const [comentarioAtual, setComentarioAtual] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [marcado, setMarcado] = useState(false);

  const queryClient = useQueryClient();

  // Estado para gerenciar thread de comentários
  const [threadComentarios, setThreadComentarios] = useState(null);

  // Buscar ou criar thread de comentários ao abrir
  useEffect(() => {
    if (!aberto || !messageId) return;

    const criarThreadComentarios = async () => {
      try {
        // Usar threadId_comentarios como identificador único
        const threadIdComentario = `${messageId}_comentarios`;
        
        // Buscar threads existentes com esse padrão
        const threadsExistentes = await base44.entities.MessageThread.filter({
          group_name: threadIdComentario
        }, '-updated_date', 1);

        let threadId;
        if (threadsExistentes.length > 0) {
          threadId = threadsExistentes[0].id;
        } else {
          // Criar nova thread interna de comentários
          const novaThread = await base44.entities.MessageThread.create({
            thread_type: 'team_internal',
            group_name: threadIdComentario,
            is_group_chat: true,
            participants: [usuarioAtual.id],
            status: 'aberta',
            channel: 'interno'
          });
          threadId = novaThread.id;
        }
        
        setThreadComentarios(threadId);
      } catch (err) {
        console.error('[COMENTARIOS] Erro ao criar thread:', err);
      }
    };

    criarThreadComentarios();
  }, [aberto, messageId, usuarioAtual.id]);

  // Buscar comentários vinculados à mensagem
  const { data: comentarios = [] } = useQuery({
    queryKey: ['comentarios-internos', threadComentarios],
    queryFn: () => {
      if (!threadComentarios) return [];
      return base44.entities.Message.filter(
        { 
          thread_id: threadComentarios,
          channel: 'interno',
          sender_type: 'user'
        },
        '-created_date',
        50
      ).catch(() => []);
    },
    enabled: !!threadComentarios,
    staleTime: 10000
  });

  // Subscribe a atualizações em tempo real
  useEffect(() => {
    if (!threadComentarios) return;

    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.thread_id === threadComentarios) {
        queryClient.invalidateQueries({ queryKey: ['comentarios-internos', threadComentarios] });
      }
    });

    return unsubscribe;
  }, [threadComentarios, queryClient]);

  const handleEnviarComentario = async () => {
    if (!comentarioAtual.trim() || !threadComentarios) return;

    setEnviando(true);
    try {
      await base44.entities.Message.create({
        thread_id: threadComentarios,
        sender_id: usuarioAtual.id,
        sender_type: 'user',
        recipient_id: null,
        recipient_type: 'group',
        content: comentarioAtual.trim(),
        channel: 'interno',
        status: 'enviada',
        visibility: 'internal_only',
        sent_at: new Date().toISOString(),
        metadata: {
          is_internal_message: true,
          comentario_da_mensagem: messageId
        }
      });

      setComentarioAtual("");
      queryClient.invalidateQueries({ queryKey: ['comentarios-internos', threadComentarios] });
      toast.success('💬 Comentário adicionado!');
      
      if (onCommentAdded) onCommentAdded();
    } catch (err) {
      console.error('[COMENTARIOS] Erro ao enviar:', err);
      toast.error('Erro ao adicionar comentário');
    } finally {
      setEnviando(false);
    }
  };

  if (!hasPermission) return null;

  return (
    <>
      {/* BOTÃO DE ÍCONE - Mostra dentro da bolha */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setAberto(!aberto)}
        disabled={!messageId}
        className={cn(
          "h-7 w-7 rounded-full shadow-lg backdrop-blur-sm",
          "bg-white/90 hover:bg-slate-50 border border-slate-200 relative"
        )}
        title="Adicionar comentário/discussão interna">
        <MessageCircle className="w-3.5 h-3.5 text-slate-700" />
        {comentarios.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {comentarios.length}
          </span>
        )}
      </Button>

      {/* PAINEL FLUTUANTE DE COMENTÁRIOS */}
      {aberto && messageId && (
        <div className="fixed bottom-6 right-80 z-50 w-72 h-96 bg-white border-2 border-slate-300 rounded-lg shadow-2xl flex flex-col overflow-hidden">
          
          {/* HEADER */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <div>
                <p className="text-sm font-semibold">Discussão</p>
                <p className="text-xs opacity-90">{comentarios.length} comentário(s)</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAberto(false)}
              className="text-white hover:bg-white/20 w-6 h-6 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* COMENTÁRIOS */}
          <ScrollArea className="flex-1 bg-slate-50">
            <div className="p-3 space-y-3">
              {comentarios.length === 0 ? (
                <div className="flex items-center justify-center h-full py-8 text-slate-400 text-sm">
                  Nenhum comentário ainda
                </div>
              ) : (
                comentarios.map((com) => {
                  const autor = atendentes.find(a => a.id === com.sender_id) || {
                    full_name: com.metadata?.usuario_nome || 'Atendente'
                  };
                  
                  return (
                    <div key={com.id} className="bg-white p-2.5 rounded-lg border border-slate-200 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                          {(autor.full_name?.[0] || '?').toUpperCase()}
                        </span>
                        <span className="font-semibold text-slate-900 text-xs">
                          {autor.full_name || 'Atendente'}
                        </span>
                      </div>
                      <p className="text-slate-700 text-xs leading-snug ml-8">{com.content}</p>
                      <p className="text-[10px] text-slate-400 ml-8 mt-1">
                        {new Date(com.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* INPUT */}
          <div className="border-t border-slate-200 bg-white p-3 flex gap-2 flex-shrink-0">
            <Input
              placeholder="Comentar..."
              value={comentarioAtual}
              onChange={(e) => setComentarioAtual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEnviarComentario();
                }
              }}
              disabled={enviando}
              className="text-xs"
            />
            <Button
              onClick={handleEnviarComentario}
              disabled={enviando || !comentarioAtual.trim()}
              size="icon"
              className="bg-blue-600 hover:bg-blue-700 h-9 w-9">
              {enviando ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}