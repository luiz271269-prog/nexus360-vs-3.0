import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, X, MessageSquare } from 'lucide-react';
import ChatWindow from '@/components/comunicacao/ChatWindow';
import { toast } from 'sonner';

/**
 * Drawer flutuante que reusa o ChatWindow da Central de Comunicação
 * dentro do contexto de Gestão de Clientes.
 *
 * Resolução de thread:
 *   1. cliente.telefone → buscar Contact (variações de telefone)
 *   2. fallback: Contact.cliente_id === cliente.id
 *   3. abrir thread canônica do contato
 */
export default function ClienteChatDrawer({ cliente, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [resolvendo, setResolvendo] = React.useState(false);
  const [thread, setThread] = React.useState(null);
  const [contato, setContato] = React.useState(null);
  const [erro, setErro] = React.useState(null);

  const { data: usuario } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: integracoes = [] } = useQuery({
    queryKey: ['integracoes'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes'],
    queryFn: async () => {
      const r = await base44.functions.invoke('listarUsuariosParaAtribuicao', {});
      return r?.data?.usuarios || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens', thread?.id],
    queryFn: async () => {
      if (!thread?.id) return [];
      const msgs = await base44.entities.Message.filter(
        { thread_id: thread.id }, '-sent_at', 50
      );
      return msgs.reverse();
    },
    enabled: !!thread?.id,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // Resolução de thread
  React.useEffect(() => {
    if (!isOpen || !cliente) return;
    let cancelado = false;

    const resolverThread = async () => {
      setResolvendo(true);
      setErro(null);
      setThread(null);
      setContato(null);

      try {
        const telefoneRaw = cliente.telefone || cliente.celular;
        let contatoEncontrado = null;

        if (telefoneRaw) {
          const telDigitos = String(telefoneRaw).replace(/\D/g, '');
          const variacoes = new Set();
          variacoes.add(telDigitos);
          if (!telDigitos.startsWith('55')) variacoes.add('55' + telDigitos);
          if (telDigitos.startsWith('55')) variacoes.add(telDigitos.substring(2));
          if (telDigitos.length === 12 && telDigitos.startsWith('55')) {
            variacoes.add(telDigitos.substring(0, 4) + '9' + telDigitos.substring(4));
          }
          if (telDigitos.length === 13 && telDigitos.startsWith('55') && telDigitos[4] === '9') {
            variacoes.add(telDigitos.substring(0, 4) + telDigitos.substring(5));
          }
          if (telDigitos.length === 10) {
            variacoes.add('55' + telDigitos.substring(0, 2) + '9' + telDigitos.substring(2));
            variacoes.add('55' + telDigitos);
          }

          for (const v of variacoes) {
            const r = await base44.entities.Contact.filter(
              { telefone_canonico: v }, '-updated_date', 1
            ).catch(() => []);
            if (r && r.length > 0) {
              contatoEncontrado = r[0];
              break;
            }
          }
        }

        // Fallback por cliente_id
        if (!contatoEncontrado && cliente.id) {
          const r = await base44.entities.Contact.filter(
            { cliente_id: cliente.id }, '-updated_date', 1
          ).catch(() => []);
          if (r && r.length > 0) contatoEncontrado = r[0];
        }

        if (!contatoEncontrado) {
          setErro('Nenhum contato vinculado a este cliente. Envie uma mensagem pela Central de Comunicação primeiro para criar a conversa.');
          setResolvendo(false);
          return;
        }

        if (!cancelado) setContato(contatoEncontrado);

        const threads = await base44.entities.MessageThread.filter(
          { contact_id: contatoEncontrado.id, is_canonical: true, status: 'aberta' },
          '-last_message_at', 1
        );

        if (!threads || threads.length === 0) {
          const threadsAlt = await base44.entities.MessageThread.filter(
            { contact_id: contatoEncontrado.id, status: 'aberta' },
            '-last_message_at', 1
          );
          if (threadsAlt && threadsAlt.length > 0) {
            if (!cancelado) setThread(threadsAlt[0]);
          } else {
            setErro('Contato encontrado mas sem conversa ativa. Envie uma mensagem pela Central de Comunicação primeiro.');
          }
        } else {
          if (!cancelado) setThread(threads[0]);
        }
      } catch (e) {
        console.error('[ClienteChatDrawer] Erro:', e);
        if (!cancelado) setErro(e.message || 'Erro ao abrir conversa');
      } finally {
        if (!cancelado) setResolvendo(false);
      }
    };

    resolverThread();
    return () => { cancelado = true; };
  }, [isOpen, cliente?.id, cliente?.telefone]);

  const handleEnviarOtimista = React.useCallback(async (dados) => {
    const { texto, integrationId, replyToMessage, mediaUrl, mediaType, mediaCaption, isAudio } = dados;
    if (!thread || !usuario) return;
    if (!contato?.telefone) {
      toast.error('Contato sem telefone cadastrado');
      return;
    }

    try {
      const payload = {
        integration_id: integrationId,
        numero_destino: contato.telefone,
      };
      if (mediaUrl) {
        if (isAudio || mediaType === 'audio') {
          payload.audio_url = mediaUrl;
          payload.media_type = 'audio';
        } else {
          payload.media_url = mediaUrl;
          payload.media_type = mediaType;
          if (mediaCaption || texto) payload.media_caption = mediaCaption || texto;
        }
      } else if (texto) {
        payload.mensagem = texto;
      }
      if (replyToMessage?.whatsapp_message_id) {
        payload.reply_to_message_id = replyToMessage.whatsapp_message_id;
      }

      const r = await base44.functions.invoke('enviarWhatsApp', payload);
      if (!r.data?.success) throw new Error(r.data?.error || 'Erro no envio');

      await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: usuario.id,
        sender_type: 'user',
        recipient_id: thread.contact_id,
        recipient_type: 'contact',
        content: texto || (mediaType === 'audio' ? '[Áudio]' : mediaType === 'image' ? '[Imagem]' : '[Mídia]'),
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: r.data.message_id,
        sent_at: new Date().toISOString(),
        media_url: mediaUrl || null,
        media_type: mediaType || 'none',
        media_caption: mediaCaption || null,
        reply_to_message_id: replyToMessage?.id || null,
        metadata: {
          whatsapp_integration_id: integrationId,
          cliente_id: cliente?.id || null,
          cliente_nome: cliente?.razao_social || cliente?.nome_fantasia || null,
        },
      });

      await base44.entities.MessageThread.update(thread.id, {
        last_message_content: (texto || '[Mídia]').substring(0, 100),
        last_message_at: new Date().toISOString(),
        last_message_sender: 'user',
        last_human_message_at: new Date().toISOString(),
        last_media_type: mediaType || 'none',
        whatsapp_integration_id: integrationId,
      });

      queryClient.invalidateQueries({ queryKey: ['mensagens', thread.id] });
    } catch (e) {
      console.error('[ClienteChatDrawer] Erro envio:', e);
      toast.error('Erro ao enviar: ' + e.message);
    }
  }, [thread, usuario, contato, cliente, queryClient]);

  const handleAtualizarMensagens = React.useCallback(() => {
    if (thread?.id) queryClient.invalidateQueries({ queryKey: ['mensagens', thread.id] });
  }, [thread?.id, queryClient]);

  if (!isOpen) return null;

  const nomeExibicao = cliente?.razao_social || cliente?.nome_fantasia || 'Cliente';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] lg:w-[560px] bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Chat do Cliente</p>
              <p className="text-[11px] text-white/80 truncate">
                {nomeExibicao} {cliente?.telefone ? `• ${cliente.telefone}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {resolvendo ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-500" />
              <p className="text-sm">Localizando conversa…</p>
            </div>
          ) : erro ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-700 font-medium mb-2">Não foi possível abrir a conversa</p>
              <p className="text-sm text-slate-500">{erro}</p>
            </div>
          ) : thread ? (
            <ChatWindow
              thread={thread}
              mensagens={mensagens}
              usuario={usuario}
              contatoPreCarregado={contato}
              integracoes={integracoes}
              atendentes={atendentes}
              onSendMessageOptimistic={handleEnviarOtimista}
              onAtualizarMensagens={handleAtualizarMensagens}
              onFecharChat={onClose}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}