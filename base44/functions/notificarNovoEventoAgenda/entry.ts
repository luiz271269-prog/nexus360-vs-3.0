import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════════════
// 📲 NOTIFICAR NOVO EVENTO DE AGENDA (push no celular)
// Chamado pelo workflow "Push — Novo Evento de Agenda" quando um
// ScheduleEvent é criado. Envia push para o responsável e participantes
// internos, com action_url que abre o evento na Agenda com um toque.
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { event_id } = await req.json();
    if (!event_id) {
      return Response.json({ success: false, error: 'event_id obrigatório' }, { status: 400 });
    }

    const evento = await base44.asServiceRole.entities.ScheduleEvent.get(event_id).catch(() => null);
    if (!evento) {
      return Response.json({ success: false, error: 'Evento não encontrado' }, { status: 404 });
    }

    // Não notificar eventos já encerrados/cancelados
    if (['cancelled', 'completed'].includes(evento.status)) {
      return Response.json({ success: true, sent: 0, reason: 'evento_encerrado' });
    }

    const quando = evento.start_at
      ? new Date(evento.start_at).toLocaleString('pt-BR', {
          timeZone: evento.timezone || 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'short'
        })
      : '';

    // Destinatários: responsável + participantes internos (sem duplicar)
    const destinatarios = [...new Set(
      [evento.assigned_user_id, ...(evento.participants_internal || [])].filter(Boolean)
    )];

    let sent = 0;
    let failed = 0;

    for (const userId of destinatarios) {
      try {
        const res = await base44.asServiceRole.functions.invoke('enviarWakeUpPush', {
          target_user_id: userId,
          tipo: 'message',
          title: `📅 Novo evento: ${evento.title}`,
          body: `${quando}${evento.location ? ` • ${evento.location}` : ''}`,
          action_url: `/Agenda?item=${evento.id}`
        });
        const ok = Boolean(res?.data?.sent || res?.sent);
        if (ok) sent++; else failed++;
      } catch (e) {
        console.warn(`[NOVO-EVENTO-PUSH] ⚠️ Falha para ${userId}: ${e.message}`);
        failed++;
      }
    }

    console.log(`[NOVO-EVENTO-PUSH] ✅ Evento ${event_id} | push enviados: ${sent} | falhas: ${failed}`);
    return Response.json({ success: true, sent, failed, destinatarios: destinatarios.length });
  } catch (error) {
    console.error('[NOVO-EVENTO-PUSH] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});