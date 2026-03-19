import { createClient } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// LER APROVAÇÃO DISPARO v1.0
// ============================================================================
// Monitora respostas "SIM" em threads de setor → muda FilaDisparo status

Deno.serve(async (req) => {
  const base44 = createClient();
  const agora = new Date();

  try {
    console.log('[LER-APROVACAO] 🔍 Buscando respostas SIM...');

    // 1. Buscar threads de setor (sector_group)
    const sectorThreads = await base44.asServiceRole.entities.MessageThread.filter(
      { thread_type: 'sector_group' },
      '-created_date',
      20
    );

    if (sectorThreads.length === 0) {
      console.log('[LER-APROVACAO] ✅ Nenhuma thread de setor');
      return Response.json({ success: true, processadas: 0 });
    }

    let aprovacoes = 0;
    let erros = 0;

    for (const thread of sectorThreads) {
      try {
        // 2. Buscar mensagens do último dia
        const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const mensagens = await base44.asServiceRole.entities.Message.filter(
          {
            thread_id: thread.id,
            sender_type: 'user',
            channel: 'interno',
            sent_at: { $gte: umDiaAtras }
          },
          '-sent_at',
          100
        );

        for (const msg of mensagens) {
          const content = (msg.content || '').toUpperCase().trim();
          
          // 3. Detectar SIM (simples pattern matching)
          if (!/^SIM|^\*SIM|\bsim\b|aprovado|ok|tá bom|pode enviar/i.test(content)) {
            continue;
          }

          // Tentar extrair fila_disparo_id do content ou metadata
          let filaId = null;
          
          // Pattern: "Fila ID: <id>" ou no metadata
          const match = content.match(/fila\s+id:\s*([a-f0-9]+)/i);
          if (match) {
            filaId = match[1];
          } else if (msg.metadata?.fila_disparo_id) {
            filaId = msg.metadata.fila_disparo_id;
          } else if (msg.reply_to_message_id) {
            // Se é resposta, buscar msg anterior com fila_disparo_id
            const msgAnterior = await base44.asServiceRole.entities.Message.get(msg.reply_to_message_id).catch(() => null);
            if (msgAnterior?.metadata?.fila_disparo_id) {
              filaId = msgAnterior.metadata.fila_disparo_id;
            }
          }

          if (!filaId) {
            console.warn('[LER-APROVACAO] ⚠️ Não conseguiu extrair fila_disparo_id da mensagem');
            continue;
          }

          // 4. Buscar fila e validar status
          const fila = await base44.asServiceRole.entities.FilaDisparo.get(filaId).catch(() => null);
          if (!fila) {
            console.warn(`[LER-APROVACAO] ⚠️ Fila ${filaId} não encontrada`);
            continue;
          }

          // 5. Se status é aguardando_aprovacao, mudar para aprovado
          if (fila.status === 'aguardando_aprovacao') {
            await base44.asServiceRole.entities.FilaDisparo.update(filaId, {
              status: 'aprovado',
              aprovado_em: agora.toISOString(),
              aprovado_por: msg.sender_id
            });

            aprovacoes++;
            console.log(`[LER-APROVACAO] ✅ Fila ${filaId} APROVADA por ${msg.sender_id}`);
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
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});