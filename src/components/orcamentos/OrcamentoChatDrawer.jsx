import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, X, MessageSquare } from 'lucide-react';
import ChatWindow from '@/components/comunicacao/ChatWindow';
import { toast } from 'sonner';

/**
 * Drawer flutuante que reusa o ChatWindow da Central de Comunicação
 * dentro do contexto do CRM (OrcamentoDetalhes).
 *
 * Resolução de thread (sem tocar Comunicacao.jsx):
 *   1. orcamento.origem_chat.thread_id  → usa direto
 *   2. cliente_telefone normalizado     → busca Contact.telefone_canonico → MessageThread canônica
 *
 * Vendedor/Cliente já vêm do orçamento (usuario_id, cliente_id, cliente_telefone).
 */
export default function OrcamentoChatDrawer({ orcamento, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [resolvendo, setResolvendo] = React.useState(false);
  const [thread, setThread] = React.useState(null);
  const [contato, setContato] = React.useState(null);
  const [erro, setErro] = React.useState(null);

  // Usuário atual
  const { data: usuario } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  // Integrações WhatsApp
  const { data: integracoes = [] } = useQuery({
    queryKey: ['integracoes'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    staleTime: 10 * 60 * 1000,
  });

  // Atendentes (para nomes/avatars)
  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes'],
    queryFn: async () => {
      const r = await base44.functions.invoke('listarUsuariosParaAtribuicao', {});
      return r?.data?.usuarios || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mensagens da thread ativa
  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens', thread?.id],
    queryFn: async () => {
      if (!thread?.id) return [];
      const msgs = await base44.entities.Message.filter(
        { thread_id: thread.id },
        '-sent_at',
        50
      );
      return msgs.reverse();
    },
    enabled: !!thread?.id,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // ─── Resolução de thread (lógica 1→2) ──────────────────────────────────────
  React.useEffect(() => {
    if (!isOpen || !orcamento) return;

    let cancelado = false;

    const resolverThread = async () => {
      setResolvendo(true);
      setErro(null);
      setThread(null);
      setContato(null);

      try {
        // CAMINHO 1: thread_id já gravado em origem_chat
        const threadIdDireto = orcamento.origem_chat?.thread_id;
        if (threadIdDireto) {
          try {
            const t = await base44.entities.MessageThread.get(threadIdDireto);
            if (t && t.status !== 'merged') {
              if (cancelado) return;
              setThread(t);
              if (t.contact_id) {
                const c = await base44.entities.Contact.get(t.contact_id).catch(() => null);
                if (!cancelado) setContato(c);
              }
              setResolvendo(false);
              return;
            }
            // Se merged, segue para canônica
            if (t?.merged_into) {
              const tc = await base44.entities.MessageThread.get(t.merged_into).catch(() => null);
              if (tc && !cancelado) {
                setThread(tc);
                if (tc.contact_id) {
                  const c = await base44.entities.Contact.get(tc.contact_id).catch(() => null);
                  if (!cancelado) setContato(c);
                }
                setResolvendo(false);
                return;
              }
            }
          } catch {
            // segue para caminho 2
          }
        }

        // CAMINHO 2: telefone canônico → Contact → MessageThread canônica
        // Tenta múltiplas variações + fallback por cliente_id
        const telefoneRaw = orcamento.cliente_telefone || orcamento.cliente_celular;
        let contatoEncontrado = null;

        if (telefoneRaw) {
          const telDigitos = String(telefoneRaw).replace(/\D/g, '');

          // Gera variações do telefone (cobrir fixo/celular com ou sem DDI/9)
          const variacoes = new Set();
          variacoes.add(telDigitos);
          if (!telDigitos.startsWith('55')) variacoes.add('55' + telDigitos);
          if (telDigitos.startsWith('55')) variacoes.add(telDigitos.substring(2));
          // Para celular: adicionar/remover o 9 após DDD (apenas se já tem DDI 55)
          if (telDigitos.length === 12 && telDigitos.startsWith('55')) {
            // 55 + DDD(2) + 8 dígitos → tenta com 9 inserido: 55 + DDD + 9 + 8
            variacoes.add(telDigitos.substring(0, 4) + '9' + telDigitos.substring(4));
          }
          if (telDigitos.length === 13 && telDigitos.startsWith('55') && telDigitos[4] === '9') {
            // 55 + DDD(2) + 9 + 8 dígitos → tenta sem 9
            variacoes.add(telDigitos.substring(0, 4) + telDigitos.substring(5));
          }
          if (telDigitos.length === 10) {
            // DDD(2) + 8 dígitos → tenta 55 + DDD + 9 + 8
            variacoes.add('55' + telDigitos.substring(0, 2) + '9' + telDigitos.substring(2));
            variacoes.add('55' + telDigitos);
          }

          // Busca por qualquer variação
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

        // FALLBACK: buscar contato vinculado ao cliente_id do orçamento
        if (!contatoEncontrado && orcamento.cliente_id) {
          const r = await base44.entities.Contact.filter(
            { cliente_id: orcamento.cliente_id }, '-updated_date', 1
          ).catch(() => []);
          if (r && r.length > 0) contatoEncontrado = r[0];
        }

        if (!contatoEncontrado) {
          setErro('Nenhum contato vinculado a este orçamento. Envie uma mensagem pela Central de Comunicação primeiro para criar a conversa.');
          setResolvendo(false);
          return;
        }

        const c = contatoEncontrado;
        if (!cancelado) setContato(c);

        // Busca thread canônica desse contato
        const threads = await base44.entities.MessageThread.filter(
          { contact_id: c.id, is_canonical: true, status: 'aberta' },
          '-last_message_at',
          1
        );

        if (!threads || threads.length === 0) {
          // fallback: qualquer thread aberta do contato
          const threadsAlt = await base44.entities.MessageThread.filter(
            { contact_id: c.id, status: 'aberta' },
            '-last_message_at',
            1
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
        console.error('[OrcamentoChatDrawer] Erro ao resolver thread:', e);
        if (!cancelado) setErro(e.message || 'Erro ao abrir conversa');
      } finally {
        if (!cancelado) setResolvendo(false);
      }
    };

    resolverThread();
    return () => { cancelado = true; };
  }, [isOpen, orcamento?.id, orcamento?.origem_chat?.thread_id, orcamento?.cliente_telefone]);

  // Handler de envio otimista (igual Comunicacao.jsx)
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

      // Registrar mensagem
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
          // 🔗 Vínculo com o orçamento (rastreabilidade no CRM)
          orcamento_id: orcamento?.id || null,
          orcamento_numero: orcamento?.numero_orcamento || null,
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
      console.error('[OrcamentoChatDrawer] Erro envio:', e);
      toast.error('Erro ao enviar: ' + e.message);
    }
  }, [thread, usuario, contato, orcamento, queryClient]);

  const handleAtualizarMensagens = React.useCallback(() => {
    if (thread?.id) queryClient.invalidateQueries({ queryKey: ['mensagens', thread.id] });
  }, [thread?.id, queryClient]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer lateral direito */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] lg:w-[560px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header do drawer */}
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                Chat do Orçamento {orcamento?.numero_orcamento ? `#${orcamento.numero_orcamento}` : ''}
              </p>
              <p className="text-[11px] text-white/80 truncate">
                {orcamento?.cliente_nome || 'Cliente'} {orcamento?.cliente_telefone ? `• ${orcamento.cliente_telefone}` : ''}
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

        {/* Conteúdo */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {resolvendo ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-amber-500" />
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