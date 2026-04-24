import { createClientFromRequest } from 'npm:@base44/sdk@0.8.26';

// ============================================================================
// HISTÓRICO + PROGRESSO DE PROMOÇÕES (consome PromotionDispatchLog)
// ============================================================================
// Retorna campanhas/disparos agrupados com KPIs em tempo real.
//
// Payload:
//   { dias?: number = 30, trigger?: string, status?: string }
//
// Retorna:
//   {
//     campanhas: [{ campaign_id, promotion_titulo, trigger, total, enviadas,
//                   bloqueadas, erros, enfileiradas, primeiro_envio,
//                   ultimo_envio, status_geral }],
//     resumo: { total, enviadas, bloqueadas, erros, taxa_sucesso }
//   }
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dias = body.dias || 30;
    const trigger = body.trigger || null;

    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const filter = { created_date: { $gte: desde } };
    if (trigger) filter.trigger = trigger;

    const logs = await base44.asServiceRole.entities.PromotionDispatchLog.filter(
      filter, '-created_date', 5000
    );

    if (!logs.length) {
      return Response.json({
        success: true,
        campanhas: [],
        resumo: { total: 0, enviadas: 0, bloqueadas: 0, erros: 0, taxa_sucesso: 0 }
      });
    }

    // Agrupar por campaign_id (ou por promotion_id+trigger se não houver campaign_id)
    const campanhasMap = new Map();
    for (const log of logs) {
      const key = log.campaign_id || `${log.promotion_id}_${log.trigger}_${log.created_date?.slice(0, 10)}`;
      if (!campanhasMap.has(key)) {
        campanhasMap.set(key, {
          campaign_id: log.campaign_id || null,
          group_key: key,
          promotion_id: log.promotion_id,
          promotion_titulo: log.promotion_titulo || 'Sem título',
          trigger: log.trigger,
          initiated_by: log.initiated_by,
          total: 0,
          enviadas: 0,
          bloqueadas: 0,
          erros: 0,
          enfileiradas: 0,
          canceladas: 0,
          motivos_bloqueio: {},
          primeiro_envio: log.created_date,
          ultimo_envio: log.created_date
        });
      }
      const c = campanhasMap.get(key);
      c.total++;
      if (log.status === 'enviada') c.enviadas++;
      else if (log.status === 'bloqueada') {
        c.bloqueadas++;
        const motivo = log.bloqueio_motivo || 'desconhecido';
        c.motivos_bloqueio[motivo] = (c.motivos_bloqueio[motivo] || 0) + 1;
      }
      else if (log.status === 'erro') c.erros++;
      else if (log.status === 'enfileirada') c.enfileiradas++;
      else if (log.status === 'cancelada') c.canceladas++;

      if (log.created_date < c.primeiro_envio) c.primeiro_envio = log.created_date;
      if (log.created_date > c.ultimo_envio) c.ultimo_envio = log.created_date;
    }

    const campanhas = Array.from(campanhasMap.values())
      .map(c => ({
        ...c,
        taxa_sucesso: c.total > 0 ? (c.enviadas / c.total * 100) : 0,
        status_geral: c.enfileiradas > 0 ? 'em_andamento'
                    : c.erros > c.enviadas ? 'falhou'
                    : c.enviadas > 0 ? 'concluida'
                    : 'sem_envios'
      }))
      .sort((a, b) => b.ultimo_envio.localeCompare(a.ultimo_envio));

    // Resumo geral
    const resumo = logs.reduce((acc, l) => {
      acc.total++;
      if (l.status === 'enviada') acc.enviadas++;
      else if (l.status === 'bloqueada') acc.bloqueadas++;
      else if (l.status === 'erro') acc.erros++;
      return acc;
    }, { total: 0, enviadas: 0, bloqueadas: 0, erros: 0 });
    resumo.taxa_sucesso = resumo.total > 0 ? (resumo.enviadas / resumo.total * 100) : 0;

    return Response.json({
      success: true,
      dias,
      campanhas,
      resumo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[getPromotionDispatchHistory] ❌', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});