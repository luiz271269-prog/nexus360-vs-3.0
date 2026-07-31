import { base44 } from '@/api/base44Client';

/**
 * FUNÇÃO ÚNICA de encaminhamento — usada por todo o app.
 * Contatos externos: 1 destino = envio direto; 2+ = fila anti-spam (WorkQueueItem).
 */
export async function encaminharParaContatos({ message, thread, integracoes = [], usuarioAtual, contatos = [] }) {
  let integrationId =
    message?.metadata?.whatsapp_integration_id ||
    thread?.whatsapp_integration_id ||
    (Array.isArray(thread?.origin_integration_ids) && thread.origin_integration_ids[0]) ||
    null;

  if (!integrationId && integracoes.length > 0) {
    integrationId = integracoes.find((i) => i.status === 'conectado')?.id || integracoes[0]?.id || null;
  }
  if (!integrationId) throw new Error('Nenhuma integração WhatsApp disponível para encaminhar');

  let sucessos = 0, erros = 0, enfileirados = 0;

  // 2+ destinatários → fila (horário comercial, delay 4-15s, limite diário, retry)
  if (contatos.length >= 2) {
    const broadcastId = `forward_${message.id}_${Date.now()}`;
    const agora = Date.now();
    const texto = message?.content || '';
    const conteudoFinal = texto ? `📨 *[Mensagem Encaminhada]*\n\n${texto}` : '';
    const isAudio = message?.media_type === 'audio';

    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];
      if (!contato?.telefone) { erros++; continue; }
      try {
        await base44.entities.WorkQueueItem.create({
          tipo: 'enviar_broadcast_avulso',
          contact_id: contato.id,
          status: 'pendente',
          scheduled_for: new Date(agora + 30000 + i * 30000).toISOString(),
          payload: {
            integration_id: integrationId,
            mensagem: isAudio ? '' : conteudoFinal,
            media_url: message?.media_url || null,
            media_type: message?.media_type || 'none',
            media_caption: message?.media_caption || null,
            sender_id: usuarioAtual?.id || null,
            broadcast_id: broadcastId,
            origem: 'forward_multiple',
            original_message_id: message.id
          },
          metadata: {
            encaminhada_de_thread: thread?.id || null,
            total_destinatarios: contatos.length
          }
        });
        enfileirados++;
      } catch (error) {
        console.error('[ENCAMINHAR-FILA] Erro ao enfileirar:', error);
        erros++;
      }
    }
    return { sucessos, erros, enfileirados };
  }

  // 1 destinatário → envio direto e imediato
  for (const contato of contatos) {
    if (!contato?.telefone) { erros++; continue; }
    try {
      const resultado = await base44.functions.invoke('encaminharMensagem', {
        message_id: message.id,
        target_phone: contato.telefone,
        integration_id: integrationId
      });
      if (resultado?.data?.success) sucessos++;
      else { console.error('[ENCAMINHAR] Falha:', resultado?.data?.error); erros++; }
    } catch (error) {
      console.error('[ENCAMINHAR] Erro:', error);
      erros++;
    }
  }
  return { sucessos, erros, enfileirados };
}

/** Encaminha para threads internas já resolvidas (usuário 1:1, setor ou grupo). */
export async function encaminharParaThreadsInternas({ message, threadIds = [] }) {
  const content = message?.content ? `↩ ${message.content}` : '[Mensagem encaminhada]';
  const mediaType = message?.media_type && message.media_type !== 'none' ? message.media_type : 'none';

  let sucessos = 0, erros = 0;
  const falhas = [];
  for (const threadId of threadIds) {
    try {
      const res = await base44.functions.invoke('sendInternalMessage', {
        thread_id: threadId,
        content,
        media_type: mediaType,
        media_url: message?.media_url || null,
        media_caption: message?.media_caption || null
      });
      // ✅ A função retorna 4xx com { success:false, error } sem lançar exceção —
      // sem esta checagem um destino que falhou era contado como enviado.
      const ok = res?.data?.success ?? res?.success;
      if (ok) sucessos++;
      else {
        erros++;
        falhas.push({ threadId, motivo: res?.data?.error || res?.error || 'resposta sem success' });
        console.error('[ENCAMINHAR-INTERNO] Falha na thread', threadId, res?.data || res);
      }
    } catch (error) {
      console.error('[ENCAMINHAR-INTERNO] Erro:', threadId, error);
      erros++;
      falhas.push({ threadId, motivo: error.message });
    }
  }
  return { sucessos, erros, falhas };
}