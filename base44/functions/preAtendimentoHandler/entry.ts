import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { thread_id, contact_id, whatsapp_integration_id, user_input } = payload;

    if (thread_id === undefined || contact_id === undefined) {
      return Response.json({ success: false, error: 'Missing IDs' }, { status: 400 });
    }

    console.log('[PRE-ATENDIMENTO v13] Pipeline start');

    // SKILL 1: ACK
    console.log('[PRE-ATENDIMENTO v13] Skill 1: ACK');
    const ack = await base44.asServiceRole.functions.invoke('skillACKImediato', {
      thread_id: thread_id,
      contact_id: contact_id,
      integration_id: whatsapp_integration_id
    });

    if (ack.skipped === true) {
      return Response.json({ success: true, skipped: true }, { status: 200 });
    }

    // SKILL 2: ROUTER
    const messageText = user_input && user_input.content ? user_input.content : '';
    let router = { setor: 'geral' };
    
    if (messageText.length > 0) {
      console.log('[PRE-ATENDIMENTO v13] Skill 2: Router');
      try {
        router = await base44.asServiceRole.functions.invoke('skillIntentRouter', {
          thread_id: thread_id,
          contact_id: contact_id,
          message_content: messageText
        });
      } catch (e) {
        console.warn('[PRE-ATENDIMENTO v13] Router error:', e.message);
      }

      // SKILL 3: QUEUE
      console.log('[PRE-ATENDIMENTO v13] Skill 3: Queue');
      const queue = await base44.asServiceRole.functions.invoke('skillQueueManager', {
        thread_id: thread_id,
        contact_id: contact_id,
        setor: router.setor || 'geral',
        integration_id: whatsapp_integration_id
      });

      return Response.json({ success: true, resultado: 'pipeline_completo' }, { status: 200 });
    }

    return Response.json({ success: true, resultado: 'ack_only' }, { status: 200 });

  } catch (error) {
    console.error('[PRE-ATENDIMENTO v13] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});