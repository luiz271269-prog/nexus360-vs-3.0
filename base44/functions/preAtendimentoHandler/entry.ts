import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { thread_id, contact_id, whatsapp_integration_id, user_input } = payload;

    if (!thread_id || !contact_id) {
      return Response.json(
        { success: false, error: 'Missing thread_id or contact_id' },
        { status: 400, headers }
      );
    }

    const userInputNorm = user_input || { type: 'text', content: '' };
    console.log('[PRE-ATENDIMENTO v13] Starting pipeline');

    // ─────────────────────────────────────────────────────────────
    // SKILL 1: ACK IMEDIATO
    // ─────────────────────────────────────────────────────────────
    console.log('[PRE-ATENDIMENTO v13] Invoking skillACKImediato');
    const ackResponse = await base44.functions.invoke('skillACKImediato', {
      thread_id: thread_id,
      contact_id: contact_id,
      integration_id: whatsapp_integration_id
    });

    if (!ackResponse || !ackResponse.success) {
      console.error('[PRE-ATENDIMENTO v13] ACK failed:', ackResponse);
      return Response.json({ success: false, error: 'ACK skill failed' }, { status: 500, headers });
    }

    if (ackResponse.skipped) {
      console.log('[PRE-ATENDIMENTO v13] ACK skipped');
      return Response.json({ success: true, skipped: true }, { status: 200, headers });
    }

    console.log('[PRE-ATENDIMENTO v13] ACK success');

    // ─────────────────────────────────────────────────────────────
    // SKILL 2: INTENT ROUTER
    // ─────────────────────────────────────────────────────────────
    let routerResponse = { setor: 'geral' };
    if (userInputNorm.content && userInputNorm.content.length > 0) {
      console.log('[PRE-ATENDIMENTO v13] Invoking skillIntentRouter');
      try {
        routerResponse = await base44.functions.invoke('skillIntentRouter', {
          thread_id: thread_id,
          contact_id: contact_id,
          message_content: userInputNorm.content
        });
        console.log('[PRE-ATENDIMENTO v13] Router success, setor:', routerResponse.setor);
      } catch (err) {
        console.warn('[PRE-ATENDIMENTO v13] Router failed:', err.message);
        routerResponse = { setor: 'geral' };
      }

      // ─────────────────────────────────────────────────────────────
      // SKILL 3: QUEUE MANAGER
      // ─────────────────────────────────────────────────────────────
      console.log('[PRE-ATENDIMENTO v13] Invoking skillQueueManager');
      try {
        const queueResponse = await base44.functions.invoke('skillQueueManager', {
          thread_id: thread_id,
          contact_id: contact_id,
          setor: routerResponse.setor,
          integration_id: whatsapp_integration_id
        });
        console.log('[PRE-ATENDIMENTO v13] Queue success');
        return Response.json({ success: true, resultado: 'pipeline_completo' }, { status: 200, headers });
      } catch (err) {
        console.error('[PRE-ATENDIMENTO v13] Queue failed:', err.message);
        return Response.json({ success: false, error: 'Queue skill failed' }, { status: 500, headers });
      }
    }

    return Response.json({ success: true, resultado: 'ack_only' }, { status: 200, headers });

  } catch (error) {
    console.error('[PRE-ATENDIMENTO v13] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});