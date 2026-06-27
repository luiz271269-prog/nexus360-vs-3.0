import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

/**
 * Varredura de MessageThread para encontrar contatos com MAIS DE UMA
 * thread com is_canonical=true (bug secundário identificado no caso "Tu").
 *
 * Read-only. Admin-only. Não modifica nada.
 *
 * Retorna apenas o resumo agregado (não devolve threads inteiras).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const PAGE_SIZE = 200;
    const MAX_PAGES = 50; // teto de segurança = 10k threads
    const byContact = new Map();
    let totalScanned = 0;
    let pages = 0;

    for (let skip = 0; skip < PAGE_SIZE * MAX_PAGES; skip += PAGE_SIZE) {
      const batch = await base44.asServiceRole.entities.MessageThread.filter(
        {
          is_canonical: true,
          thread_type: 'contact_external',
          merged_into: null,
        },
        '-last_message_at',
        PAGE_SIZE,
        skip
      );

      if (!batch || batch.length === 0) break;
      pages++;
      totalScanned += batch.length;

      for (const t of batch) {
        const cid = t.contact_id;
        if (!cid) continue;
        if (!byContact.has(cid)) byContact.set(cid, []);
        byContact.get(cid).push({
          id: t.id,
          last_message_at: t.last_message_at || null,
          total_mensagens: t.total_mensagens || 0,
          whatsapp_integration_id: t.whatsapp_integration_id || null,
          assigned_user_id: t.assigned_user_id || null,
          sector_id: t.sector_id || null,
          created_date: t.created_date || null,
          updated_date: t.updated_date || null,
        });
      }

      if (batch.length < PAGE_SIZE) break;
    }

    // Filtra apenas contatos com >1 canônica
    const casos = [];
    for (const [contact_id, threads] of byContact.entries()) {
      if (threads.length > 1) {
        casos.push({ contact_id, threads });
      }
    }

    // Enriquece com nome do contato (apenas para os casos detectados, em paralelo)
    const enriched = await Promise.all(
      casos.slice(0, 100).map(async (c) => {
        try {
          const contact = await base44.asServiceRole.entities.Contact.get(c.contact_id);
          return {
            contact_id: c.contact_id,
            contact_nome: contact?.nome || null,
            contact_telefone: contact?.telefone || null,
            contact_empresa: contact?.empresa || null,
            num_canonicas: c.threads.length,
            threads: c.threads.sort((a, b) => {
              const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
              const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
              return tb - ta;
            }),
          };
        } catch {
          return {
            contact_id: c.contact_id,
            contact_nome: null,
            contact_telefone: null,
            num_canonicas: c.threads.length,
            threads: c.threads,
          };
        }
      })
    );

    return Response.json({
      success: true,
      versao: '1.0.0',
      total_threads_canonicas_scaneadas: totalScanned,
      paginas_lidas: pages,
      total_contatos_unicos: byContact.size,
      contatos_com_multiplas_canonicas: casos.length,
      casos_retornados: enriched.length,
      casos: enriched,
    });
  } catch (error) {
    console.error('[diagnosticarThreadsCanonicasDuplicadas]', error);
    return Response.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
});