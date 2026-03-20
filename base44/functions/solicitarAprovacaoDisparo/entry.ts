import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// SOLICITAR APROVAÇÃO DISPARO v2.0
// ============================================================================
// Lê FilaDisparo pendentes → envia mensagem no grupo do setor + DM ao vendedor

// Helper: cria ou busca thread de setor
async function getOrCreateSectorThread(base44, setor) {
  const threads = await base44.asServiceRole.entities.MessageThread.filter(
    { thread_type: 'sector_group', sector_key: `sector:${setor}` },
    '-created_date', 1
  );
  if (threads[0]) return threads[0];

  return await base44.asServiceRole.entities.MessageThread.create({
    thread_type: 'sector_group',
    sector_key: `sector:${setor}`,
    sector_id: setor,
    group_name: `Setor ${setor}`,
    status: 'aberta',
    is_group_chat: true,
    participants: []
  });
}

// Helper: cria ou busca thread 1:1 entre sistema e um usuário
async function getOrCreateDMThread(base44, userId) {
  const SYSTEM_ID = 'jarvis_copiloto_ia';
  const pairKey = [SYSTEM_ID, userId].sort().join(':');

  const threads = await base44.asServiceRole.entities.MessageThread.filter(
    { pair_key: pairKey, thread_type: 'team_internal' },
    '-created_date', 1
  );
  if (threads[0]) return threads[0];

  return await base44.asServiceRole.entities.MessageThread.create({
    thread_type: 'team_internal',
    pair_key: pairKey,
    participants: [SYSTEM_ID, userId],
    is_group_chat: false,
    unread_by: { [userId]: 0 },
    total_mensagens: 0,
    status: 'aberta',
    channel: 'interno'
  });
}

// Helper: envia mensagem interna em qualquer thread
async function enviarMensagemInterna(base44, threadId, content, filaId, contactId) {
  const agora = new Date().toISOString();
  await base44.asServiceRole.entities.Message.create({
    thread_id: threadId,
    sender_id: 'jarvis_copiloto_ia',
    sender_type: 'user',
    content,
    channel: 'interno',
    visibility: 'internal_only',
    provider: 'internal_system',
    status: 'enviada',
    sent_at: agora,
    metadata: {
      is_internal_message: true,
      is_1on1: false,
      sender_name: '🤖 Nexus Disparos',
      approval_request: true,
      fila_disparo_id: filaId,
      contact_id: contactId
    }
  });

  // Atualizar thread
  await base44.asServiceRole.entities.MessageThread.update(threadId, {
    last_message_at: agora,
    last_message_content: content.substring(0, 200),
    last_message_sender: 'user',
    last_message_sender_name: '🤖 Nexus Disparos'
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const agora = new Date();

  try {
    console.log('[SOLICITAR-APROVACAO] 🔍 Buscando FilaDisparo pendentes...');

    const filasPendentes = await base44.asServiceRole.entities.FilaDisparo.filter(
      { status: 'pendente' }, '-created_date', 20
    );

    if (filasPendentes.length === 0) {
      console.log('[SOLICITAR-APROVACAO] ✅ Nenhuma fila pendente');
      return Response.json({ success: true, processados: 0, message: 'Nenhuma fila pendente' });
    }

    console.log(`[SOLICITAR-APROVACAO] 📋 ${filasPendentes.length} filas encontradas`);

    let processadas = 0;
    let erros = 0;

    for (const fila of filasPendentes) {
      try {
        const [contato, vendedor] = await Promise.all([
          base44.asServiceRole.entities.Contact.get(fila.contact_id),
          fila.vendedor_responsavel_id
            ? base44.asServiceRole.entities.User.get(fila.vendedor_responsavel_id)
            : null
        ]);

        if (!contato) {
          console.warn(`[SOLICITAR-APROVACAO] ⚠️ Contato ${fila.contact_id} não encontrado`);
          erros++;
          continue;
        }

        const setor = fila.setor || 'vendas';
        const nomeContato = contato.nome || 'Contato';
        const nomeVendedor = vendedor?.full_name || 'Vendedor';

        // Mensagem completa com todo o conteúdo para análise
        const msgContent =
          `📋 *Solicitação de Aprovação de Disparo*\n\n` +
          `👤 Contato: *${nomeContato}*\n` +
          `📞 Telefone: ${contato.telefone || 'N/A'}\n` +
          `🏷️ Motivo: ${fila.motivo_reativacao || 'manual'}\n` +
          `👔 Vendedor: ${nomeVendedor}\n` +
          `🆔 Fila ID: \`${fila.id}\`\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💬 *MSG1 (texto):*\n${fila.mensagem_1 || 'N/A'}\n\n` +
          `💬 *MSG2 (texto):*\n${fila.mensagem_2 || 'N/A'}\n\n` +
          `🎤 *MSG3 (áudio):* ${fila.mensagem_3_audio_url ? fila.mensagem_3_audio_url : 'Não configurado'}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ Responda *APROVAR* ou ❌ *REJEITAR*`;

        // 1. Enviar no grupo do setor
        const threadSetor = await getOrCreateSectorThread(base44, setor);
        await enviarMensagemInterna(base44, threadSetor.id, msgContent, fila.id, fila.contact_id);
        console.log(`[SOLICITAR-APROVACAO] ✅ Notificação no grupo do setor: ${setor}`);

        // 2. Enviar DM individual para o vendedor responsável (se existir)
        if (fila.vendedor_responsavel_id) {
          const threadDM = await getOrCreateDMThread(base44, fila.vendedor_responsavel_id);
          const msgDM =
            `🔔 *Atenção, ${nomeVendedor}!*\n\n` +
            `Há uma solicitação de disparo aguardando sua aprovação:\n\n` +
            msgContent;
          await enviarMensagemInterna(base44, threadDM.id, msgDM, fila.id, fila.contact_id);
          console.log(`[SOLICITAR-APROVACAO] ✅ DM enviada para vendedor: ${nomeVendedor}`);
        }

        // Atualizar status da fila
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'aguardando_aprovacao'
        });

        processadas++;
        console.log(`[SOLICITAR-APROVACAO] ✅ Fila processada: ${nomeContato} (${fila.id})`);

      } catch (err) {
        console.error(`[SOLICITAR-APROVACAO] ❌ Erro fila ${fila.id}:`, err.message);
        erros++;
      }
    }

    console.log(`[SOLICITAR-APROVACAO] 📊 ${processadas} processadas, ${erros} erros`);

    return Response.json({
      success: erros === 0,
      processados: processadas,
      erros,
      timestamp: agora.toISOString()
    });

  } catch (error) {
    console.error('[SOLICITAR-APROVACAO] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});