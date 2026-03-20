import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// LER APROVAÇÃO DISPARO v2.0
// ============================================================================
// Monitora respostas "SIM" em threads de setor E em DMs individuais
// (debate: 2 números recebem preview, primeiro SIM dispara)

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const agora = new Date();

  try {
    console.log('[LER-APROVACAO] 🔍 Buscando respostas SIM...');

    // Buscar threads de setor E threads 1:1 internas (DMs)
    // onde possam ter chegado aprovações
    const [sectorThreads, dmThreads] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.filter(
        { thread_type: 'sector_group' }, '-updated_date', 20
      ),
      base44.asServiceRole.entities.MessageThread.filter(
        { thread_type: 'team_internal', is_group_chat: false }, '-updated_date', 50
      )
    ]);

    const todasThreads = [...sectorThreads, ...dmThreads];

    if (todasThreads.length === 0) {
      console.log('[LER-APROVACAO] ✅ Nenhuma thread encontrada');
      return Response.json({ success: true, processadas: 0 });
    }

    let aprovacoes = 0;
    let erros = 0;

    const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();

    for (const thread of todasThreads) {
      try {
        const mensagens = await base44.asServiceRole.entities.Message.filter(
          {
            thread_id: thread.id,
            sender_type: 'user',
            channel: 'interno',
            sent_at: { $gte: umDiaAtras }
          },
          '-sent_at',
          50
        );

        for (const msg of mensagens) {
          const content = (msg.content || '').trim();

          // Detectar SIM / APROVAR
          if (!/^(sim|aprovar|aprovado|ok|tá bom|pode enviar|\*sim\*|\*aprovar\*)/i.test(content)) {
            continue;
          }

          // Extrair fila_disparo_id por 3 métodos
          let filaId = null;

          const match = content.match(/fila\s+id:\s*`?([a-f0-9-]+)`?/i);
          if (match) {
            filaId = match[1];
          } else if (msg.metadata?.fila_disparo_id) {
            filaId = msg.metadata.fila_disparo_id;
          } else if (msg.reply_to_message_id) {
            const msgOrigem = await base44.asServiceRole.entities.Message.get(msg.reply_to_message_id).catch(() => null);
            if (msgOrigem?.metadata?.fila_disparo_id) {
              filaId = msgOrigem.metadata.fila_disparo_id;
            }
          }

          if (!filaId) {
            // Verificar se há mensagens recentes na mesma thread com fila_disparo_id
            const msgsSistema = mensagens.filter(m =>
              m.sender_id === 'jarvis_copiloto_ia' && m.metadata?.fila_disparo_id
            );
            if (msgsSistema.length > 0) {
              // Pegar a mais recente que ainda está aguardando
              filaId = msgsSistema[0].metadata.fila_disparo_id;
              console.log(`[LER-APROVACAO] 🔍 filaId inferido do contexto da thread: ${filaId}`);
            }
          }

          if (!filaId) {
            console.warn('[LER-APROVACAO] ⚠️ Não conseguiu extrair fila_disparo_id');
            continue;
          }

          const fila = await base44.asServiceRole.entities.FilaDisparo.get(filaId).catch(() => null);
          if (!fila) {
            console.warn(`[LER-APROVACAO] ⚠️ Fila ${filaId} não encontrada`);
            continue;
          }

          // Só aprovar se ainda está aguardando
          if (fila.status === 'aguardando_aprovacao') {
            await base44.asServiceRole.entities.FilaDisparo.update(filaId, {
              status: 'aprovado',
              aprovado_em: agora.toISOString(),
              aprovado_por: msg.sender_id
            });

            aprovacoes++;
            console.log(`[LER-APROVACAO] ✅ Fila ${filaId} APROVADA por ${msg.sender_id} (thread: ${thread.thread_type})`);
          }
        }
      } catch (err) {
        console.error(`[LER-APROVACAO] ❌ Erro na thread ${thread.id}:`, err.message);
        erros++;
      }
    }

    console.log(`[LER-APROVACAO] 📊 Resumo: ${aprovacoes} aprovadas, ${erros} erros`);

    return Response.json({
      success: erros === 0,
      processadas: aprovacoes,
      erros,
      timestamp: agora.toISOString()
    });

  } catch (error) {
    console.error('[LER-APROVACAO] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});