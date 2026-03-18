import React from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Hooks para handlers de mensagens
 * Reduz ~250 linhas do Comunicacao.jsx
 */

export function useMessageHandlers({
  threadAtiva,
  usuario,
  queryClient,
  contatos,
  contatoPreCarregado,
  integracoes
}) {
  // Atualizar após envio de mensagem
  const handleAtualizarMensagens = React.useCallback(async (novasMensagens) => {
    if (novasMensagens) {
      queryClient.setQueryData(['mensagens', threadAtiva?.id], novasMensagens);
    } else {
      queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva?.id] });
    }
    const isInterna = threadAtiva?.thread_type === 'team_internal' || threadAtiva?.thread_type === 'sector_group';
    queryClient.invalidateQueries({ queryKey: [isInterna ? 'threads-internas' : 'threads-externas'] });
  }, [threadAtiva, queryClient]);

  // Enviar mensagem interna com UI otimista
  const handleEnviarMensagemInternaOtimista = React.useCallback(async (dadosEnvio) => {
    if (!threadAtiva || !usuario) return;

    const { texto, pastedImage, attachedFile, attachedFileType, replyToMessage, audioBlob } = dadosEnvio;

    let mediaUrlFinal = null;
    let mediaTypeFinal = 'none';
    let mediaCaptionFinal = null;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (audioBlob) {
        const timestamp = Date.now();
        const audioFile = new File([audioBlob], `audio-internal-${timestamp}.ogg`, {
          type: 'audio/ogg; codecs=opus',
          lastModified: timestamp
        });

        const uploadResponse = await base44.integrations.Core.UploadFile({ file: audioFile });
        mediaUrlFinal = uploadResponse.file_url;
        mediaTypeFinal = 'audio';
      } else if (pastedImage) {
        const timestamp = Date.now();
        let mimeType = pastedImage.type || 'image/png';
        if (!mimeType.startsWith('image/')) mimeType = 'image/png';
        const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';

        const imageFile = new File([pastedImage], `internal-${timestamp}.${ext}`, {
          type: mimeType,
          lastModified: timestamp
        });

        const uploadResponse = await base44.integrations.Core.UploadFile({ file: imageFile });
        mediaUrlFinal = uploadResponse.file_url;
        mediaTypeFinal = 'image';
        mediaCaptionFinal = texto?.trim() || null;
      } else if (attachedFile) {
        const timestamp = Date.now();
        const ext = attachedFile.name.split('.').pop() || 'file';
        const uploadFile = new File([attachedFile], `internal-${timestamp}.${ext}`, {
          type: attachedFile.type,
          lastModified: timestamp
        });

        const uploadResponse = await base44.integrations.Core.UploadFile({ file: uploadFile });
        mediaUrlFinal = uploadResponse.file_url;
        mediaTypeFinal = attachedFileType;
        mediaCaptionFinal = texto?.trim() || null;
      }

      if (!texto?.trim() && !mediaUrlFinal) {
        toast.error('Digite uma mensagem ou anexe uma mídia');
        return;
      }

      const contentFinal = texto?.trim() || (mediaUrlFinal ? `[${mediaTypeFinal}]` : '');

      const msgTemp = {
        id: tempId,
        thread_id: threadAtiva.id,
        sender_id: usuario.id,
        sender_type: "user",
        content: contentFinal,
        channel: "interno",
        status: "enviando",
        sent_at: new Date().toISOString(),
        media_url: mediaUrlFinal,
        media_type: mediaTypeFinal,
        media_caption: mediaCaptionFinal,
        reply_to_message_id: replyToMessage?.id || null,
        metadata: {
          optimistic: true,
          user_name: usuario.full_name
        }
      };

      queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
        return [...antigas, msgTemp];
      });

      const payload = {
        thread_id: threadAtiva.id,
        content: contentFinal,
        media_type: mediaTypeFinal,
        media_url: mediaUrlFinal,
        media_caption: mediaCaptionFinal,
        reply_to_message_id: replyToMessage?.id || null
      };

      const resultado = await base44.functions.invoke('sendInternalMessage', payload);

      if (resultado.data.success) {
        queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
          return antigas.filter((m) => m.id !== tempId);
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] }),
          queryClient.invalidateQueries({ queryKey: ['threads-internas'] })
        ]);

        toast.success('✅ Mensagem enviada!');
      } else {
        throw new Error(resultado.data.error || 'Erro ao enviar');
      }
    } catch (error) {
      console.error('[OPTIMISTIC INTERNO] Erro:', error);

      queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
        return antigas.filter((m) => m.id !== tempId);
      });

      toast.error(`Erro ao enviar: ${error.message}`);
    }
  }, [threadAtiva, usuario, queryClient]);

  // Enviar mensagem externa (WhatsApp) com UI otimista
  const handleEnviarMensagemOtimista = React.useCallback(async (dadosEnvio) => {
    if (!threadAtiva || !usuario) return;

    const { texto, integrationId, replyToMessage, mediaUrl, mediaType, mediaCaption, isAudio } = dadosEnvio;

    if (usuario.role !== 'admin') {
      const whatsappPerms = usuario.whatsapp_permissions || [];
      if (whatsappPerms.length > 0) {
        const perm = whatsappPerms.find((p) => p.integration_id === integrationId);
        if (!perm || perm.can_send !== true) {
          toast.error('❌ Você não tem permissão para enviar mensagens por esta conexão');
          return;
        }
      }
    }

    // ✅ Verificar status da instância selecionada ANTES de enviar (feedback imediato)
    const integracaoSelecionada = integracoes?.find((i) => i.id === integrationId);
    if (integracaoSelecionada && integracaoSelecionada.status !== 'conectado') {
      toast.error(
        `📵 A instância "${integracaoSelecionada.nome_instancia}" está ${integracaoSelecionada.status}. Reconecte-a nas configurações.`,
        { duration: 8000 }
      );
      return;
    }

    const msgTemp = {
      id: `temp-${Date.now()}`,
      thread_id: threadAtiva.id,
      sender_id: usuario.id,
      sender_type: "user",
      recipient_id: threadAtiva.contact_id,
      recipient_type: "contact",
      content: texto || (mediaType === 'image' ? '[Imagem]' : mediaType === 'audio' ? '[Áudio]' : '[Mídia]'),
      channel: "whatsapp",
      status: "enviando",
      sent_at: new Date().toISOString(),
      media_url: mediaUrl || null,
      media_type: mediaType || 'none',
      media_caption: mediaCaption || null,
      reply_to_message_id: replyToMessage?.id || null,
      metadata: {
        whatsapp_integration_id: integrationId,
        optimistic: true
      }
    };

    queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
      return [...antigas, msgTemp];
    });

    try {
      const _c = contatos.find((c) => c.id === threadAtiva.contact_id) || contatoPreCarregado;
      const contatoAtual = (!_c?.telefone && !_c?.celular && threadAtiva.contact_id)
        ? await base44.entities.Contact.get(threadAtiva.contact_id).catch(() => _c)
        : _c;
      const telefone = contatoAtual?.telefone || contatoAtual?.celular;
      if (!telefone) { throw new Error('Contato sem telefone cadastrado'); }

      const payload = {
        integration_id: integrationId,
        numero_destino: telefone
      };

      if (mediaUrl) {
        if (isAudio || mediaType === 'audio') {
          payload.audio_url = mediaUrl;
          payload.media_type = 'audio';
        } else {
          payload.media_url = mediaUrl;
          payload.media_type = mediaType;
          if (mediaCaption || texto) {
            payload.media_caption = mediaCaption || texto;
          }
        }
      } else if (texto) {
        payload.mensagem = texto;
      }

      if (replyToMessage?.whatsapp_message_id) {
        payload.reply_to_message_id = replyToMessage.whatsapp_message_id;
      }

      const resultado = await base44.functions.invoke('enviarWhatsApp', payload);

      if (resultado.data.success) {
        await base44.entities.Message.create({
          thread_id: threadAtiva.id,
          sender_id: usuario.id,
          sender_type: "user",
          recipient_id: threadAtiva.contact_id,
          recipient_type: "contact",
          content: msgTemp.content,
          channel: "whatsapp",
          status: "enviada",
          whatsapp_message_id: resultado.data.message_id,
          sent_at: new Date().toISOString(),
          media_url: mediaUrl || null,
          media_type: mediaType || 'none',
          media_caption: mediaCaption || null,
          reply_to_message_id: replyToMessage?.id || null,
          metadata: {
            whatsapp_integration_id: integrationId
          }
        });

        await base44.entities.MessageThread.update(threadAtiva.id, {
          last_message_content: msgTemp.content.substring(0, 100),
          last_message_at: new Date().toISOString(),
          last_message_sender: "user",
          last_human_message_at: new Date().toISOString(),
          last_media_type: mediaType || 'none',
          whatsapp_integration_id: integrationId,
          pre_atendimento_ativo: false
        });

        queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] });
        queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
      } else {
        // ✅ Propagar error_message amigável quando disponível (ex: INSTANCIA_DESCONECTADA)
        const errCode = resultado.data.error || '';
        const errMsg = resultado.data.error_message || errCode || 'Erro ao enviar';
        const err = new Error(errMsg);
        err.code = errCode;
        throw err;
      }
    } catch (error) {
      console.error('[OPTIMISTIC] ❌ Erro:', error);

      queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
        return antigas.filter((m) => m.id !== msgTemp.id);
      });

      const msg = error.message || '';
      const code = error.code || '';

      if (code === 'INSTANCIA_DESCONECTADA' || msg.includes('INSTANCIA_DESCONECTADA') || /disconnect|not.connect|desconect/i.test(msg)) {
        // Mostrar mensagem amigável com nome da instância se disponível
        toast.error(`📵 ${msg || 'Instância WhatsApp desconectada! Verifique as configurações.'}`, { duration: 8000 });
      } else if (!msg || msg === 'Contato sem telefone cadastrado') {
        toast.error(`❌ ${msg || 'Erro ao enviar mensagem'}`);
      } else {
        toast.error(`❌ Erro ao enviar: ${msg}`);
      }
    }
  }, [threadAtiva, usuario, queryClient, contatos, contatoPreCarregado]);

  return {
    handleAtualizarMensagens,
    handleEnviarMensagemInternaOtimista,
    handleEnviarMensagemOtimista
  };
}