import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// NEXUS NOTIFICAR v1.0 — Utilitário centralizado de notificações internas
// ============================================================================
// Envia notificação no grupo do setor + DM ao vendedor responsável
// Elimina duplicação entre processarFilaDisparo, solicitarAprovacaoDisparo, etc.
//
// Payload esperado:
// {
//   setor: string,                    // 'vendas' | 'assistencia' | etc.
//   conteudo: string,                 // texto da mensagem
//   vendedor_responsavel_id?: string, // ID do User (opcional — DM individual)
//   metadata?: object                 // campos extras para Message.metadata
// }
// ============================================================================

const SYSTEM_ID = 'jarvis_copiloto_ia';
const SYSTEM_NAME = '🤖 Nexus';

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

async function getOrCreateDMThread(base44, userId) {
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

async function criarMensagem(base44, threadId, conteudo, metadataExtra = {}) {
  const agora = new Date().toISOString();
  await base44.asServiceRole.entities.Message.create({
    thread_id: threadId,
    sender_id: SYSTEM_ID,
    sender_type: 'user',
    content: conteudo,
    channel: 'interno',
    visibility: 'internal_only',
    provider: 'internal_system',
    status: 'enviada',
    sent_at: agora,
    metadata: {
      is_internal_message: true,
      is_1on1: false,
      sender_name: SYSTEM_NAME,
      ...metadataExtra
    }
  });
  await base44.asServiceRole.entities.MessageThread.update(threadId, {
    last_message_at: agora,
    last_message_content: conteudo.substring(0, 200),
    last_message_sender: 'user',
    last_message_sender_name: SYSTEM_NAME
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const payload = await req.json();
    const { setor, conteudo, vendedor_responsavel_id, metadata = {} } = payload;

    if (!setor || !conteudo) {
      return Response.json({ success: false, error: 'setor e conteudo são obrigatórios' }, { status: 400 });
    }

    const enviados = [];

    // 1. Grupo do setor
    const threadSetor = await getOrCreateSectorThread(base44, setor);
    await criarMensagem(base44, threadSetor.id, conteudo, metadata);
    enviados.push({ destino: `setor:${setor}`, thread_id: threadSetor.id });
    console.log(`[NEXUS_NOTIFICAR] ✅ Grupo setor ${setor}`);

    // 2. DM ao vendedor (se informado)
    if (vendedor_responsavel_id) {
      const threadDM = await getOrCreateDMThread(base44, vendedor_responsavel_id);
      await criarMensagem(base44, threadDM.id, conteudo, { ...metadata, is_1on1: true });
      enviados.push({ destino: `dm:${vendedor_responsavel_id}`, thread_id: threadDM.id });
      console.log(`[NEXUS_NOTIFICAR] ✅ DM para vendedor ${vendedor_responsavel_id}`);
    }

    return Response.json({ success: true, enviados });

  } catch (error) {
    console.error('[NEXUS_NOTIFICAR] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});