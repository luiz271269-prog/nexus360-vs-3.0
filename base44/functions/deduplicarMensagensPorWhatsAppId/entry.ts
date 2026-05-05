// ╔════════════════════════════════════════════════════════════════════════╗
// ║  DEDUPLICAR MENSAGENS POR whatsapp_message_id                          ║
// ║                                                                         ║
// ║  Detecta e remove mensagens duplicadas que compartilham o mesmo        ║
// ║  whatsapp_message_id no banco (causadas por race condition do          ║
// ║  webhook W-API processando o mesmo evento 2x).                         ║
// ║                                                                         ║
// ║  REGRA: mantém a mensagem MAIS ANTIGA (created_date) e deleta as       ║
// ║  duplicatas mais recentes.                                              ║
// ║                                                                         ║
// ║  Modo:                                                                  ║
// ║    - "diagnostico": apenas detecta, retorna lista (sem deletar)        ║
// ║    - "correcao":   detecta + deleta as duplicatas                      ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode executar' }, { status: 403 });
    }

    const { contact_id, modo = 'diagnostico' } = await req.json();
    if (!contact_id) {
      return Response.json({ error: 'contact_id obrigatório' }, { status: 400 });
    }

    // 1. Buscar todas as threads do contato
    const threads = await base44.asServiceRole.entities.MessageThread.filter({ contact_id });
    const threadIds = threads.map(t => t.id);

    if (threadIds.length === 0) {
      return Response.json({
        success: true,
        modo,
        contact_id,
        threads_analisadas: 0,
        mensagens_analisadas: 0,
        grupos_duplicados: 0,
        mensagens_duplicadas: 0,
        mensagens_deletadas: 0,
        detalhes: []
      });
    }

    // 2. Buscar mensagens de TODAS as threads do contato
    let todasMensagens = [];
    for (const threadId of threadIds) {
      const msgs = await base44.asServiceRole.entities.Message.filter(
        { thread_id: threadId },
        '-created_date',
        2000
      );
      todasMensagens = todasMensagens.concat(msgs);
    }

    // 3. Agrupar por whatsapp_message_id (ignorando vazios/null)
    const grupos = new Map();
    for (const msg of todasMensagens) {
      const wid = msg.whatsapp_message_id;
      if (!wid) continue;
      if (!grupos.has(wid)) grupos.set(wid, []);
      grupos.get(wid).push(msg);
    }

    // 4. Identificar grupos com duplicatas (2+ mensagens com mesmo whatsapp_message_id)
    const detalhes = [];
    let totalDuplicadas = 0;
    let totalDeletadas = 0;
    const errosDelete = [];

    for (const [wid, msgs] of grupos.entries()) {
      if (msgs.length < 2) continue;

      // Ordenar por created_date ASC — manter a primeira (mais antiga)
      msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const manter = msgs[0];
      const deletar = msgs.slice(1);
      totalDuplicadas += deletar.length;

      detalhes.push({
        whatsapp_message_id: wid,
        content_preview: (manter.content || '').substring(0, 80),
        thread_id: manter.thread_id,
        manter: { id: manter.id, created_date: manter.created_date },
        deletar: deletar.map(m => ({ id: m.id, created_date: m.created_date }))
      });

      // 5. Deletar duplicatas se modo=correcao
      if (modo === 'correcao') {
        for (const dup of deletar) {
          try {
            await base44.asServiceRole.entities.Message.delete(dup.id);
            totalDeletadas++;
          } catch (e) {
            errosDelete.push({ id: dup.id, erro: e.message });
          }
        }
      }
    }

    return Response.json({
      success: true,
      modo,
      contact_id,
      threads_analisadas: threadIds.length,
      mensagens_analisadas: todasMensagens.length,
      grupos_duplicados: detalhes.length,
      mensagens_duplicadas: totalDuplicadas,
      mensagens_deletadas: totalDeletadas,
      erros: errosDelete,
      detalhes
    });

  } catch (error) {
    console.error('[deduplicarMensagensPorWhatsAppId] ERRO:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});