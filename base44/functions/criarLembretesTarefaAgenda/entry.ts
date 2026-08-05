import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════════════
// 🔔 AUTO-CRIAÇÃO DE LEMBRETES PARA TAREFAS DE AGENDA
// ═══════════════════════════════════════════════════════════════════════════
// Chamada pelo workflow "Auto-Lembretes de Tarefa da Agenda" quando uma
// ScheduleTask é criada ou tem o prazo_em alterado.
// Cria lembretes 24h antes e 1h antes do prazo, canal "app" (chat interno + push).
// Idempotente via send_dedupe_key.
// ═══════════════════════════════════════════════════════════════════════════

const OFFSETS = [
  { minutes: 1440, tag: '24h' },
  { minutes: 60, tag: '1h' }
];

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

    if (['concluida', 'cancelada'].includes(task.status)) {
      return Response.json({ success: true, criados: 0, motivo: `Tarefa ${task.status}` });
    }

    if (!task.prazo_em || !task.responsavel_id) {
      return Response.json({ success: true, criados: 0, motivo: 'Sem prazo_em ou responsavel_id' });
    }

    const prazoMs = new Date(task.prazo_em).getTime();
    const agoraMs = Date.now();

    // Lembretes já existentes desta tarefa (evita duplicar em updates de prazo)
    const existentes = await base44.asServiceRole.entities.ScheduleReminder.filter({
      task_id: task_id
    }, '-created_date', 50).catch(() => []);

    const chavesExistentes = new Set((existentes || []).map((r) => r.send_dedupe_key));

    const novos = [];
    for (const offset of OFFSETS) {
      const sendAtMs = prazoMs - offset.minutes * 60 * 1000;

      // Não criar lembretes que já passaram
      if (sendAtMs <= agoraMs) continue;

      const dedupeKey = `task:${task_id}:${offset.tag}:${task.prazo_em}`;
      if (chavesExistentes.has(dedupeKey)) continue;

      novos.push({
        task_id: task_id,
        target_user_id: task.responsavel_id,
        offset_minutes: offset.minutes,
        send_at: new Date(sendAtMs).toISOString(),
        relative_rule: `${offset.tag}_antes_do_prazo`,
        channel: 'app',
        status: 'pending',
        send_dedupe_key: dedupeKey,
        retry_count: 0
      });
    }

    // Cancelar SOMENTE lembretes automáticos deste worker referentes a um prazo antigo.
    // Lembretes criados manualmente ou por outros sistemas nunca são tocados.
    const prefixoAuto = `task:${task_id}:`;
    const obsoletos = (existentes || []).filter(
      (r) =>
        r.status === 'pending' &&
        r.send_dedupe_key &&
        r.send_dedupe_key.startsWith(prefixoAuto) &&
        !r.send_dedupe_key.endsWith(task.prazo_em)
    );
    for (const obsoleto of obsoletos) {
      await base44.asServiceRole.entities.ScheduleReminder.update(obsoleto.id, {
        status: 'skipped',
        error_details: 'Prazo da tarefa foi alterado'
      }).catch(() => null);
    }

    if (novos.length > 0) {
      await base44.asServiceRole.entities.ScheduleReminder.bulkCreate(novos);
    }

    console.log(`[AUTO-LEMBRETE] Tarefa ${task_id}: ${novos.length} criados, ${obsoletos.length} obsoletos cancelados`);

    return Response.json({
      success: true,
      criados: novos.length,
      cancelados: obsoletos.length,
      responsavel_id: task.responsavel_id
    });
  } catch (error) {
    console.error('[AUTO-LEMBRETE] ❌', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});