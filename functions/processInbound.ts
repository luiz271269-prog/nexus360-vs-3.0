// redeploy: 2026-03-03T15:00
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// PROCESS INBOUND - v11.0.0 INLINE (sem imports locais)
// ============================================================================
// Pipeline: normalize → dedup → reset_promos → human_check → URA dispatch
// ============================================================================

const VERSION = 'v11.0.0-INLINE';

function humanoAtivo(thread, horasStale = 2) {
  if (!thread.assigned_user_id) return false;
  if (thread.pre_atendimento_ativo) return false;
  if (!thread.last_human_message_at) return false;
  const hoursGap = (Date.now() - new Date(thread.last_human_message_at).getTime()) / (1000 * 60 * 60);
  return hoursGap < horasStale;
}

function detectNovoCiclo(lastInboundAt) {
  if (!lastInboundAt) return true;
  const hoursGap = (Date.now() - new Date(lastInboundAt).getTime()) / (1000 * 60 * 60);
  return hoursGap >= 12;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const { message, contact, thread, integration, provider, messageContent, rawPayload } = payload;

  console.log(`[${VERSION}] 📩 Message: ${message?.id} | Contact: ${contact?.nome} | Thread: ${thread?.id}`);

  const result = { pipeline: [], actions: [] };
  const now = new Date();

  // 1. IDEMPOTÊNCIA
  result.pipeline.push('idempotency_check');
  if (message?.whatsapp_message_id && integration?.id) {
    try {
      const existing = await base44.asServiceRole.entities.Message.filter({
        whatsapp_message_id: message.whatsapp_message_id,
        'metadata.whatsapp_integration_id': integration.id
      }, '-created_date', 1);
      if (existing?.length > 1) { // > 1 porque a própria msg já foi gravada
        console.log(`[${VERSION}] ⏭️ DUPLICATA: ${message.whatsapp_message_id}`);
        result.actions.push('skipped_duplicate');
        return Response.json({ success: true, skipped: true, reason: 'duplicate', pipeline: result.pipeline, actions: result.actions });
      }
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro idempotência:`, e.message);
    }
  }

  // 2. RESET FUNIL PROMOÇÕES
  if (message?.sender_type === 'contact') {
    result.pipeline.push('promotion_reset');
    if (thread?.autoboost_stage || thread?.last_boost_at) {
      try {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          autoboost_stage: null,
          last_boost_at: null,
          promo_cooldown_expires_at: null
        });
        result.actions.push('reset_promotion_funnel');
      } catch (e) {}
    }
  }

  // 3. ATUALIZAR ENGAGEMENT STATE
  result.pipeline.push('engagement_state');
  try {
    const states = await base44.asServiceRole.entities.ContactEngagementState.filter({
      contact_id: contact.id,
      status: 'active'
    }, '-created_date', 1);
    if (states?.length > 0) {
      await base44.asServiceRole.entities.ContactEngagementState.update(states[0].id, {
        status: 'paused',
        last_inbound_at: now.toISOString(),
        last_thread_id: thread.id
      });
      result.actions.push('engagement_paused');
    }
  } catch (e) {
    console.warn(`[${VERSION}] ⚠️ Erro engagement:`, e.message);
  }

  // 4. HARD-STOP: Humano ativo
  result.pipeline.push('human_check');
  if (humanoAtivo(thread)) {
    result.actions.push('human_active_stop');
    console.log(`[${VERSION}] 🛑 Humano ativo - parando pipeline`);
    return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, stop: true, reason: 'human_active' });
  }

  // 5. AGENDA IA CHECK
  result.pipeline.push('agenda_ia_check');
  if (thread.assistant_mode === 'agenda' || integration?.nome_instancia === 'NEXUS_AGENDA_INTEGRATION') {
    result.actions.push('routing_to_agenda_ia');
    try {
      await base44.asServiceRole.functions.invoke('routeToAgendaIA', {
        thread_id: thread.id,
        message_id: message?.id,
        content: messageContent,
        from_type: 'external_contact',
        from_id: message?.sender_id
      });
      result.actions.push('agenda_ia_dispatched');
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro agenda IA:`, e.message);
    }
    return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, routed: true, to: 'agenda_ia' });
  }

  // 6. NOVO CICLO E DECISÃO URA
  result.pipeline.push('cycle_detection');
  const novoCiclo = detectNovoCiclo(thread.last_inbound_at);
  const isUraActive = thread.pre_atendimento_ativo === true;
  const isHumanDormant = thread.assigned_user_id && !humanoAtivo(thread, 2);

  let shouldDispatch = false;
  if (isUraActive) shouldDispatch = true;
  else if (novoCiclo) shouldDispatch = true;
  else if (isHumanDormant && messageContent?.length > 4) shouldDispatch = true;
  else if (!thread.assigned_user_id) shouldDispatch = true;

  if (shouldDispatch) {
    result.pipeline.push('ura_dispatch');
    // Verificar playbook ativo
    try {
      const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
        is_pre_atendimento_padrao: true,
        ativo: true
      }, '-created_date', 1);

      if (!playbooks?.length) {
        console.log(`[${VERSION}] 🚫 Sem playbook ativo - bloqueando URA`);
        result.actions.push('ura_blocked_no_playbook');
        return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, stop: true, reason: 'pre_atendimento_desativado' });
      }
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro ao verificar playbooks:`, e.message);
    }

    try {
      await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
        thread_id: thread.id,
        contact_id: contact.id,
        whatsapp_integration_id: integration?.id,
        user_input: { type: 'text', content: messageContent || '', id: null },
        intent_context: null,
        is_new_cycle: novoCiclo,
        provider,
        whatsappIntegration: integration
      });
      result.actions.push('ura_dispatched');
      console.log(`[${VERSION}] ✅ preAtendimentoHandler invocado`);
    } catch (e) {
      console.error(`[${VERSION}] ❌ Erro ao disparar URA:`, e.message);
      result.actions.push('ura_dispatch_failed');
    }

    return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, handled_by_ura: true });
  }

  result.pipeline.push('normal_message');
  result.actions.push('message_in_cycle_no_ura');
  console.log(`[${VERSION}] ✅ Mensagem processada sem URA`);
  return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions });
});