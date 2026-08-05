import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════════════
// 🔔 AUTO-LEMBRETES DE TAREFA DA AGENDA — REGRA DIÁRIA 07:00
// ═══════════════════════════════════════════════════════════════════════════
// REGRA ÚNICA E PREVISÍVEL:
//   Todo lembrete é disparado às 07:00 (horário de Brasília).
//   Para cada tarefa com prazo, são criados no máximo 2 lembretes:
//     1) VÉSPERA  → 07:00 do dia anterior ao prazo
//     2) DIA DO PRAZO → 07:00 do próprio dia do prazo
//   Lembretes cujo horário já passou não são criados.
//
// IDEMPOTÊNCIA:
//   A chave usa o timestamp numérico do prazo (não a string ISO), então
//   variações de formato/milissegundos não geram duplicidade.
//
// ESCOPO:
//   Só mexe em lembretes criados por este worker (prefixo "agenda:<task_id>:").
//   Lembretes manuais ou de outros sistemas nunca são tocados.
// ═══════════════════════════════════════════════════════════════════════════

const HORA_ENVIO_BRT = 7;      // 07:00 em Brasília
const OFFSET_BRT_HORAS = 3;    // BRT = UTC-3 → 07:00 BRT = 10:00 UTC

// Retorna o instante das 07:00 BRT do dia (em BRT) de uma data de referência
function seteDaManhaBrt(dataRef, diasAntes) {
  const brt = new Date(dataRef.getTime() - OFFSET_BRT_HORAS * 3600 * 1000);
  const ano = brt.getUTCFullYear();
  const mes = brt.getUTCMonth();
  const dia = brt.getUTCDate() - diasAntes;
  // 07:00 BRT = 10:00 UTC do mesmo dia civil
  return new Date(Date.UTC(ano, mes, dia, HORA_ENVIO_BRT + OFFSET_BRT_HORAS, 0, 0, 0));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { task_id } = await req.json();

    if (!task_id) {
      return Response.json({ success: false, error: 'task_id obrigatório' }, { status: 400 });
    }

    const task = await base44.asServiceRole.entities.ScheduleTask.get(task_id).catch(() => null);
    if (!task) {
      return Response.json({ success: false, error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const prefixo = `agenda:${task_id}:`;
    const existentes = await base44.asServiceRole.entities.ScheduleReminder
      .filter({ task_id: task_id }, '-created_date', 50)
      .catch(() => []);
    const meus = (existentes || []).filter((r) => (r.send_dedupe_key || '').startsWith(prefixo));

    // Cancela lembretes automáticos pendentes se a tarefa saiu do ar
    const encerrada = ['concluida', 'cancelada'].includes(task.status);
    if (encerrada || !task.prazo_em || !task.responsavel_id) {
      let cancelados = 0;
      for (const r of meus.filter((x) => x.status === 'pending')) {
        await base44.asServiceRole.entities.ScheduleReminder.update(r.id, {
          status: 'skipped',
          error_details: encerrada ? `Tarefa ${task.status}` : 'Tarefa sem prazo ou sem responsável'
        }).catch(() => null);
        cancelados++;
      }
      return Response.json({ success: true, criados: 0, cancelados, motivo: 'Tarefa sem lembretes aplicáveis' });
    }

    const prazo = new Date(task.prazo_em);
    if (isNaN(prazo.getTime())) {
      return Response.json({ success: false, error: 'prazo_em inválido' }, { status: 400 });
    }

    // Timestamp estável → base da chave de deduplicação
    const prazoTs = prazo.getTime();
    const agoraMs = Date.now();

    const regras = [
      { tag: 'vespera_07h', diasAntes: 1 },
      { tag: 'dia_07h', diasAntes: 0 }
    ];

    const chavesAtuais = new Set();
    const novos = [];

    for (const regra of regras) {
      const envio = seteDaManhaBrt(prazo, regra.diasAntes);
      const dedupeKey = `${prefixo}${regra.tag}:${prazoTs}`;
      chavesAtuais.add(dedupeKey);

      // Não cria lembrete no passado, nem depois do próprio prazo
      if (envio.getTime() <= agoraMs) continue;
      if (envio.getTime() > prazoTs) continue;
      if (meus.some((r) => r.send_dedupe_key === dedupeKey)) continue;

      novos.push({
        task_id: task_id,
        target_user_id: task.responsavel_id,
        offset_minutes: Math.round((prazoTs - envio.getTime()) / 60000),
        send_at: envio.toISOString(),
        relative_rule: regra.tag,
        channel: 'app',
        status: 'pending',
        send_dedupe_key: dedupeKey,
        retry_count: 0
      });
    }

    // Cancela lembretes automáticos de um prazo anterior (prazo foi alterado)
    const obsoletos = meus.filter(
      (r) => r.status === 'pending' && !chavesAtuais.has(r.send_dedupe_key)
    );
    for (const r of obsoletos) {
      await base44.asServiceRole.entities.ScheduleReminder.update(r.id, {
        status: 'skipped',
        error_details: 'Prazo da tarefa foi alterado'
      }).catch(() => null);
    }

    if (novos.length > 0) {
      await base44.asServiceRole.entities.ScheduleReminder.bulkCreate(novos);
    }

    console.log(`[AUTO-LEMBRETE] Tarefa ${task_id}: ${novos.length} criados, ${obsoletos.length} cancelados`);

    return Response.json({
      success: true,
      criados: novos.length,
      cancelados: obsoletos.length,
      agendados_para: novos.map((n) => n.send_at),
      responsavel_id: task.responsavel_id
    });
  } catch (error) {
    console.error('[AUTO-LEMBRETE] ❌', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});