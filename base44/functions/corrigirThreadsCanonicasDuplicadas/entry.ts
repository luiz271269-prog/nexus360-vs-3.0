import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

/**
 * Corrige contatos com MAIS DE UMA thread is_canonical=true.
 *
 * Regra de eleição da canônica vencedora:
 *  1. Maior last_message_at (mais recente)
 *  2. Empate -> maior total_mensagens
 *  3. Empate -> maior updated_date
 *  4. Empate -> id lexicograficamente menor (estável)
 *
 * Ação:
 *  - Vencedora: mantém is_canonical=true, merged_into=null, status='aberta' (se 'merged')
 *  - Perdedoras: is_canonical=false, merged_into=<vencedora_id>, status='merged'
 *
 * NÃO move mensagens (handleSelecionarThread já auto-redireciona merged).
 *
 * Payload: { dry_run: true|false, limit?: number, contact_id?: string }
 *  - dry_run=true (default): simula, não escreve
 *  - limit: corrige apenas N contatos (default: todos)
 *  - contact_id: restringe a 1 contato específico (debug)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default TRUE
    const limit = body.limit || null;
    const onlyContactId = body.contact_id || null;

    const PAGE_SIZE = 200;
    const MAX_PAGES = 50;
    const byContact = new Map();

    // 1. Varrer todas as canônicas
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
      for (const t of batch) {
        if (!t.contact_id) continue;
        if (onlyContactId && t.contact_id !== onlyContactId) continue;
        if (!byContact.has(t.contact_id)) byContact.set(t.contact_id, []);
        byContact.get(t.contact_id).push(t);
      }
      if (batch.length < PAGE_SIZE) break;
    }

    // 2. Filtrar contatos com >1 canônica
    const casos = [];
    for (const [contact_id, threads] of byContact.entries()) {
      if (threads.length > 1) casos.push({ contact_id, threads });
    }

    // 3. Aplicar limit
    const casosParaCorrigir = limit ? casos.slice(0, limit) : casos;

    // 4. Eleger vencedora e gerar plano por contato
    const plano = [];
    for (const c of casosParaCorrigir) {
      const sorted = [...c.threads].sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        if (tb !== ta) return tb - ta;
        const ma = a.total_mensagens || 0;
        const mb = b.total_mensagens || 0;
        if (mb !== ma) return mb - ma;
        const ua = a.updated_date ? new Date(a.updated_date).getTime() : 0;
        const ub = b.updated_date ? new Date(b.updated_date).getTime() : 0;
        if (ub !== ua) return ub - ua;
        return String(a.id).localeCompare(String(b.id));
      });

      const vencedora = sorted[0];
      const perdedoras = sorted.slice(1);

      plano.push({
        contact_id: c.contact_id,
        vencedora_id: vencedora.id,
        vencedora_last_message_at: vencedora.last_message_at,
        vencedora_total_mensagens: vencedora.total_mensagens || 0,
        perdedoras: perdedoras.map((p) => ({
          id: p.id,
          last_message_at: p.last_message_at,
          total_mensagens: p.total_mensagens || 0,
        })),
      });
    }

    // 5. Se dry-run, retornar plano e parar
    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        total_contatos_afetados: casos.length,
        contatos_no_plano: plano.length,
        total_threads_a_marcar_merged: plano.reduce((s, p) => s + p.perdedoras.length, 0),
        plano: plano.slice(0, 50), // amostra
        plano_truncado: plano.length > 50,
      });
    }

    // 6. EXECUÇÃO REAL
    let totalUpdated = 0;
    let totalErros = 0;
    const erros = [];

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    for (const p of plano) {
      for (const perd of p.perdedoras) {
        let success = false;
        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await base44.asServiceRole.entities.MessageThread.update(perd.id, {
              is_canonical: false,
              merged_into: p.vencedora_id,
              status: 'merged',
            });
            totalUpdated++;
            success = true;
            break;
          } catch (e) {
            lastErr = e;
            const is429 = e.message?.includes('Rate limit') || e.message?.includes('429');
            if (is429) {
              await sleep(1500 * (attempt + 1)); // backoff exponencial
              continue;
            }
            break;
          }
        }
        if (!success) {
          totalErros++;
          erros.push({ thread_id: perd.id, error: lastErr?.message || 'unknown' });
        }
        await sleep(80); // throttle entre updates
      }
    }

    // Log de auditoria
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        acao: 'corrigirThreadsCanonicasDuplicadas',
        detalhes: {
          contatos_corrigidos: plano.length,
          threads_marcadas_merged: totalUpdated,
          erros: totalErros,
          executado_por: user.email,
        },
        executado_por: user.email,
      });
    } catch {
      // AuditLog é best-effort
    }

    return Response.json({
      success: true,
      dry_run: false,
      contatos_corrigidos: plano.length,
      threads_marcadas_merged: totalUpdated,
      total_erros: totalErros,
      erros: erros.slice(0, 20),
    });
  } catch (error) {
    console.error('[corrigirThreadsCanonicasDuplicadas]', error);
    return Response.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
});