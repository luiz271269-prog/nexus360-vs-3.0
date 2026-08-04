import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();
    const tasks = await base44.asServiceRole.entities.ScheduleTask.filter({
      status: { $in: ['pendente', 'confirmada', 'em_andamento', 'aguardando_terceiro', 'adiada'] },
      prazo_em: { $lt: now }
    }, 'prazo_em', 100);

    if (!tasks.length) return Response.json({ success: true, vencidas: 0 });

    await base44.asServiceRole.entities.ScheduleTask.bulkUpdate(tasks.map(task => ({
      id: task.id,
      status: 'vencida',
      vencida_em: now
    })));

    await base44.asServiceRole.entities.ScheduleActivityLog.bulkCreate(tasks.map(task => ({
      task_id: task.id,
      acao: 'vencida',
      usuario_id: task.responsavel_id,
      data_em: now,
      dados_anteriores: { status: task.status },
      dados_novos: { status: 'vencida' },
      origem: 'sistema',
      visible_user_ids: [task.responsavel_id].filter(Boolean)
    })));

    return Response.json({ success: true, vencidas: tasks.length });
  } catch (error) {
    console.error('[AGENDA OPERACIONAL]', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});