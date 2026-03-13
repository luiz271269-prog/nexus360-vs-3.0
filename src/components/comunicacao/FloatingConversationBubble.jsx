import React, { useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  MessageCircle, X, Send, Loader2, AlertCircle, Users 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export default function FloatingConversationBubble({
  threadId,
  contato,
  usuarioAtual,
  atendentes = [],
  hasPermission = false
}) {
  const [aberto, setAberto] = useState(false);
  const [mensagemAtual, setMensagemAtual] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [threadInterna, setThreadInterna] = useState(null);

  const queryClient = useQueryClient();

  // Buscar usuários internos para consultar
  useEffect(() => {
    const carregarUsuarios = async () => {
      try {
        const users = await base44.entities.User.list('-created_date', 50);
        const filtrados = users.filter(u => u.id !== usuarioAtual?.id);
        setUsuariosDisponiveis(filtrados);
      } catch (err) {
        console.error('[BUBBLE] Erro ao carregar usuários:', err);
      }
    };
    if (aberto && hasPermission) {
      carregarUsuarios();
    }
  }, [aberto, usuarioAtual?.id, hasPermission]);

  // Mensagens da thread interna 1:1
  const { data: mensagensInternas = [] } = useQuery({
    queryKey: ['mensagens-internas', threadInterna?.id],
    queryFn: () => {
      if (!threadInterna?.id) return [];
      return base44.entities.Message.filter(
        { thread_id: threadInterna.id },
        '-created_date',
        100
      );
    },
    enabled: !!threadInterna?.id,
    staleTime: 10000
  });

  // Subscribe a atualizações em tempo real
  useEffect(() => {
    if (!threadInterna?.id) return;

    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.thread_id === threadInterna.id) {
        queryClient.invalidateQueries({ queryKey: ['mensagens-internas', threadInterna.id] });
      }
    });

    return unsubscribe;
  }, [threadInterna?.id, queryClient]);

  const selecionarUsuario = async (usuario) => {
    try {
      const res = await base44.functions.invoke('getOrCreateInternalThread', {
        user_ids: [usuarioAtual.id, usuario.id]
      });
      const threadId = res?.data?.thread_id || res?.data?.thread?.id || res?.data?.id;
      if (threadId) {
        const thread = { id: threadId, ...usuario };
        setThreadInterna(thread);
        setUsuarioSelecionado(usuario);
      }
    } catch (err) {
      console.error('[BUBBLE] Erro ao criar thread:', err);
      toast.error('Erro ao abrir conversa');
    }
  };

  const handleEnviarMensagem = async () => {
    if (!mensagemAtual.trim() || !threadInterna) return;

    setEnviando(true);
    try {
      await base44.functions.invoke('sendInternalMessage', {
        thread_id: threadInterna.id,
        content: mensagemAtual,
        media_type: 'none'
      });
      setMensagemAtual("");
      queryClient.invalidateQueries({ queryKey: ['mensagens-internas', threadInterna.id] });
    } catch (err) {
      console.error('[BUBBLE] Erro ao enviar:', err);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  if (!hasPermission) return null;

  return (
    <>
      {/* BOTÃO FLUTUANTE */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center"
          title="Discutir com atendente">
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* DRAWER FLUTUANTE */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none">
          <div className="w-96 h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col pointer-events-auto rounded-tl-xl">
            
            {/* HEADER */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 flex items-center justify-between rounded-tl-xl">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <div>
                  <p className="text-sm font-semibold">
                    {threadInterna ? `Conversa: ${usuarioSelecionado?.display_name || usuarioSelecionado?.full_name}` : 'Consultar com Atendente'}
                  </p>
                  {contato?.nome && (
                    <p className="text-xs opacity-90">Cliente: {contato.nome}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setAberto(false);
                  setThreadInterna(null);
                  setUsuarioSelecionado(null);
                }}
                className="text-white hover:bg-white/20">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* CONTEÚDO */}
            {!threadInterna ? (
              // SELEÇÃO DE USUÁRIO
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  <p className="text-xs text-slate-500 font-medium mb-3">Selecione um atendente:</p>
                  {usuariosDisponiveis.map((usuario) => (
                    <button
                      key={usuario.id}
                      onClick={() => selecionarUsuario(usuario)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(usuario.display_name || usuario.full_name || usuario.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {usuario.display_name || usuario.full_name || usuario.email}
                        </p>
                        <p className="text-xs text-slate-500">
                          {usuario.attendant_sector || 'geral'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <>
                {/* MENSAGENS */}
                <ScrollArea className="flex-1 bg-slate-50">
                  <div className="p-4 space-y-3">
                    {mensagensInternas.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <p className="text-sm">Nenhuma mensagem ainda</p>
                      </div>
                    ) : (
                      mensagensInternas.map((msg) => {
                        const isOwn = msg.sender_id === usuarioAtual?.id;
                        return (
                          <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-xs rounded-lg px-3 py-2 text-sm",
                              isOwn
                                ? "bg-blue-500 text-white"
                                : "bg-white text-slate-900 border border-slate-200"
                            )}>
                              <p>{msg.content}</p>
                              <p className={cn("text-xs mt-1 opacity-70", isOwn ? "text-blue-100" : "text-slate-500")}>
                                {new Date(msg.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* INPUT */}
                <div className="border-t border-slate-200 bg-white p-3 rounded-bl-xl flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={mensagemAtual}
                    onChange={(e) => setMensagemAtual(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEnviarMensagem();
                      }
                    }}
                    disabled={enviando}
                    className="text-sm"
                  />
                  <Button
                    onClick={handleEnviarMensagem}
                    disabled={enviando || !mensagemAtual.trim()}
                    size="icon"
                    className="bg-blue-500 hover:bg-blue-600">
                    {enviando ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}