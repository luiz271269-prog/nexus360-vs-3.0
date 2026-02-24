/**
 * Hook para envio de arquivos (imagem, vídeo, documento/PDF) via WhatsApp
 * Extraído de ChatWindow para manter tamanho do arquivo gerenciável
 */
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Envia um arquivo anexado (imagem, vídeo ou documento) para o WhatsApp.
 * 
 * Fluxo para documentos:
 * 1. Cria mensagem com status 'enviando' e media_url = 'pending_download' (mostra spinner no bubble)
 * 2. Faz upload do arquivo para storage
 * 3. Envia via ZAPI/WAPI
 * 4. Atualiza mensagem com media_url real + status 'enviada'
 */
export async function enviarArquivoAnexado({
  file,
  fileType,
  legendaTexto = '',
  thread,
  usuario,
  contatoCompleto,
  canalSelecionado,
  mensagemResposta,
  autoAtribuirThreadSeNecessario,
  onAtualizarMensagens,
  setUploadingPastedFile,
  setMensagemResposta,
  // Broadcast
  modoSelecaoMultipla,
  contatosSelecionados,
  handleEnviarBroadcast,
}) {
  if (!file) {
    toast.error('Nenhum arquivo para enviar');
    return;
  }

  // ──────────────────────────────────────────────
  // MODO BROADCAST
  // ──────────────────────────────────────────────
  if (modoSelecaoMultipla && contatosSelecionados.length > 0) {
    setUploadingPastedFile(true);
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'file';
      const uploadFile = new File([file], `broadcast-${timestamp}.${ext}`, {
        type: file.type,
        lastModified: timestamp
      });

      toast.info('📤 Fazendo upload do arquivo...');
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: uploadFile });
      const fileUrl = uploadResponse.file_url;

      toast.info('📤 Enviando para os contatos selecionados...');
      await handleEnviarBroadcast({
        texto: legendaTexto,
        mediaUrl: fileUrl,
        mediaType: fileType,
        mediaCaption: file.name || legendaTexto.trim() || null
      });
    } catch (error) {
      console.error('[EnviarArquivo] Erro broadcast:', error);
      toast.error('Erro ao enviar arquivo: ' + error.message);
    } finally {
      setUploadingPastedFile(false);
    }
    return;
  }

  // ──────────────────────────────────────────────
  // MODO INDIVIDUAL
  // ──────────────────────────────────────────────
  if (!thread || !usuario) {
    toast.error('Dados da conversa não disponíveis');
    return;
  }

  const contatoTel = contatoCompleto?.telefone || contatoCompleto?.celular;
  if (!contatoTel) {
    toast.error('Contato sem telefone cadastrado.');
    return;
  }

  const integrationIdParaUso = canalSelecionado || thread.whatsapp_integration_id;
  if (!integrationIdParaUso) {
    toast.error('Thread sem integração WhatsApp configurada.');
    return;
  }

  await autoAtribuirThreadSeNecessario(thread);

  const respostaParaMensagem = mensagemResposta;
  setMensagemResposta(null);
  setUploadingPastedFile(true);

  // Detectar nomes e previews por tipo
  const isDocument = fileType === 'document';
  const contentPreview = fileType === 'image' ? '[Imagem]' :
    fileType === 'video' ? '[Vídeo]' :
    isDocument ? '[Documento]' : '[Arquivo]';

  // Para documentos: media_url = 'pending_download' → exibe spinner no bubble
  // Para imagens/vídeos: sem media_url (sem preview local)
  let novaMensagem;
  try {
    novaMensagem = await base44.entities.Message.create({
      thread_id: thread.id,
      sender_id: usuario.id,
      sender_type: 'user',
      recipient_id: thread.contact_id,
      recipient_type: 'contact',
      content: contentPreview,
      channel: 'whatsapp',
      status: 'enviando',
      sent_at: new Date().toISOString(),
      media_type: fileType,
      // ✅ PDF/doc: 'pending_download' para mostrar spinner enquanto envia
      media_url: isDocument ? 'pending_download' : undefined,
      // ✅ CRÍTICO: Usar nome real do arquivo como caption
      media_caption: file.name || legendaTexto || null,
      reply_to_message_id: respostaParaMensagem?.id || null,
      metadata: {
        whatsapp_integration_id: integrationIdParaUso,
        local_preview: true
      }
    });

    if (onAtualizarMensagens) onAtualizarMensagens();
  } catch (createError) {
    console.error('[EnviarArquivo] Erro ao criar mensagem:', createError);
    toast.error('Erro ao preparar envio.');
    setUploadingPastedFile(false);
    return;
  }

  // Upload e envio assíncrono (não bloqueia UI)
  (async () => {
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'file';
      const uploadFile = new File([file], `${fileType}-${timestamp}.${ext}`, {
        type: file.type,
        lastModified: timestamp
      });

      const uploadResponse = await base44.integrations.Core.UploadFile({ file: uploadFile });
      const fileUrl = uploadResponse.file_url;

      const dadosEnvio = {
        integration_id: integrationIdParaUso,
        numero_destino: contatoTel,
        media_url: fileUrl,
        media_type: fileType,
        // ✅ Nome real do arquivo (crítico para ZAPI reconhecer como PDF)
        media_caption: file.name || legendaTexto || null
      };
      if (respostaParaMensagem?.whatsapp_message_id) {
        dadosEnvio.reply_to_message_id = respostaParaMensagem.whatsapp_message_id;
      }

      console.log('[EnviarArquivo] 📤 Enviando:', {
        tipo: fileType,
        nome: file.name,
        url: fileUrl?.substring(0, 60),
        caption: dadosEnvio.media_caption
      });

      const resultado = await base44.functions.invoke('enviarWhatsApp', dadosEnvio);

      if (resultado.data.success) {
        // ✅ Atualizar com URL real + status enviada + nome do arquivo
        await base44.entities.Message.update(novaMensagem.id, {
          status: 'enviada',
          whatsapp_message_id: resultado.data.message_id,
          media_url: fileUrl,
          media_caption: file.name || legendaTexto || null
        });

        await base44.entities.MessageThread.update(thread.id, {
          last_message_content: contentPreview,
          last_message_at: new Date().toISOString(),
          last_message_sender: 'user',
          last_human_message_at: new Date().toISOString(),
          last_media_type: fileType,
          pre_atendimento_ativo: false
        });

        console.log('[EnviarArquivo] ✅ Enviado com sucesso!');
      } else {
        await base44.entities.Message.update(novaMensagem.id, {
          status: 'falhou',
          media_url: null,
          erro_detalhes: resultado.data.error || 'Erro no envio'
        });
        toast.error(`Falha ao enviar ${isDocument ? 'documento' : 'arquivo'}: ${resultado.data.error || ''}`);
      }
    } catch (error) {
      console.error('[EnviarArquivo] Erro:', error);
      await base44.entities.Message.update(novaMensagem.id, {
        status: 'falhou',
        media_url: null,
        erro_detalhes: error.message
      });
      toast.error('Erro ao enviar arquivo: ' + error.message);
    } finally {
      setUploadingPastedFile(false);
      if (onAtualizarMensagens) {
        setTimeout(() => onAtualizarMensagens(), 500);
      }
    }
  })();
}