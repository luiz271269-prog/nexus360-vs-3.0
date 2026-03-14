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

  // ════════════════════════════════════════════════════════════════
  // [FIX 1] GARANTIR CONTATO ANTES DE QUALQUER LÓGICA
  // Se contact.id não existe, chamar getOrCreateContactCentralized
  // para criar o contato IMEDIATAMENTE
  // ════════════════════════════════════════════════════════════════
  if (!contact?.id && contact?.telefone) {
    console.log(`[${VERSION}] 🆕 FIX 1: Contato sem ID encontrado, criando...`);
    try {
      const createResult = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
        telefone: contact.telefone,
        pushName: contact.nome || null,
        profilePicUrl: contact.foto_perfil_url || null,
        conexaoId: integration?.id || null
      });
      if (createResult.data?.success && createResult.data?.contact?.id) {
        contact = createResult.data.contact;
        console.log(`[${VERSION}] ✅ FIX 1: Contato criado/recuperado: ${contact.id}`);
        result.actions.push('contact_ensured');
      }
    } catch (e) {
      console.error(`[${VERSION}] ❌ FIX 1: Erro ao garantir contato:`, e.message);
      return Response.json({ success: false, error: 'contact_creation_failed' }, { status: 500 });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // [INBOUND-GATE] CAMADA 5 — BATCH WINDOW (10 segundos)
  // Foto + legenda chegam como 2 webhooks separados (1-3s de diferença).
  // Se há 2+ mensagens do mesmo contato nos últimos 10s, aguarda 3s
  // para agrupar antes de prosseguir — evita duplo disparo de URA.
  // ════════════════════════════════════════════════════════════════
  if (contact?.id) {
    try {
      const dezSegAtras = new Date(Date.now() - 10_000).toISOString();
      const msgRecentes = await base44.asServiceRole.entities.Message.filter({
        sender_id: contact.id,
        sender_type: 'contact',
        created_date: { $gte: dezSegAtras }
      }, '-created_date', 3);

      if (msgRecentes && msgRecentes.length >= 2) {
        console.log(`[INBOUND-GATE] ⏳ CAMADA 5 BATCH WINDOW: ${msgRecentes.length} msgs em 10s — aguardando 3s`);
        await new Promise(r => setTimeout(r, 3000));
        console.log(`[INBOUND-GATE] ✅ CAMADA 5: janela encerrada, processando`);
      }
    } catch (e) {
      console.warn(`[INBOUND-GATE] ⚠️ Erro batch window:`, e.message);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // [INBOUND-GATE] CAMADA 1 — FILTRO INTERNO
  // Se o número pertence a um User do sistema OU a um chip da empresa
  // (WhatsAppIntegration): salva mensagem e para — zero automação.
  // ════════════════════════════════════════════════════════════════
  const canonico = (contact?.telefone || contact?.telefone_canonico || '').replace(/\D/g, '');
  if (canonico) {
    try {
      // 1a. Verificar chips da empresa (número entre as integrações cadastradas)
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({}, '-created_date', 30);
      const numerosChips = integracoes
        .map(i => (i.numero_telefone || '').replace(/\D/g, ''))
        .filter(Boolean);

      if (numerosChips.includes(canonico)) {
        console.log(`[INBOUND-GATE] 🛑 CAMADA 1: Chip interno detectado (${canonico}) — pipeline interrompido`);
        return Response.json({ success: true, skipped: true, reason: 'chip_interno', pipeline: ['internal_filter'] });
      }

      // 1b. Verificar usuários do sistema (atendentes com telefone cadastrado)
      const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 100);
      const telefonesInternos = usuarios
        .map(u => (u.phone || u.attendant_phone || u.whatsapp_phone || '').replace(/\D/g, ''))
        .filter(t => t && t.length >= 10);

      if (telefonesInternos.includes(canonico)) {
        console.log(`[INBOUND-GATE] 🛑 CAMADA 1: Usuário interno detectado (${canonico}) — pipeline interrompido`);
        return Response.json({ success: true, skipped: true, reason: 'usuario_interno', pipeline: ['internal_filter'] });
      }

      console.log(`[INBOUND-GATE] ✅ CAMADA 1: Número externo (${canonico})`);
    } catch (e) {
      console.warn(`[INBOUND-GATE] ⚠️ Erro filtro interno (prosseguindo):`, e.message);
    }
  }

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

  // ════════════════════════════════════════════════════════════════
  // [INBOUND-GATE] CAMADA 2 — DEDUP REFORÇADO (já existe abaixo como "1. IDEMPOTÊNCIA")
  // A verificação abaixo é o ponto oficial de dedup — nada a adicionar aqui.
  // ════════════════════════════════════════════════════════════════

  // [INBOUND-GATE] CAMADA 3 — THREAD JÁ CONTEXTUALIZADA
  // Se thread tem atendente E setor definidos: apenas notifica o atendente,
  // não dispara URA nem automações. Evita URA aparecer pra clientes que já
  // estão sendo atendidos quando humano está em silêncio temporário.
  result.pipeline.push('context_check');
  if (thread?.assigned_user_id && thread?.sector_id && !humanoAtivo(thread)) {
    console.log(`[INBOUND-GATE] 🔔 CAMADA 3: Thread contextualizada (atendente=${thread.assigned_user_id}, setor=${thread.sector_id}) — apenas notificando, sem URA`);
    result.actions.push('context_notify_only');
    try {
      await base44.asServiceRole.entities.NotificationEvent.create({
        tipo: 'mensagem_cliente_contextualizada',
        titulo: `Nova mensagem de ${contact?.nome || 'contato'}`,
        mensagem: `Mensagem recebida em thread já atribuída. Atendente: ${thread.assigned_user_id}`,
        prioridade: 'media',
        metadata: {
          thread_id: thread.id,
          contact_id: contact?.id,
          message_id: message?.id,
          assigned_user_id: thread.assigned_user_id,
          sector_id: thread.sector_id
        }
      });
    } catch (e) { /* silencioso */ }

    // ── NEXUS BRAIN: fire-and-forget (não bloqueia resposta do webhook) ─────
    // Thread contextualizada = atendente existe mas humano dormiu → Brain sugere resposta
    if (integration?.id && contact?.id && message?.sender_type === 'contact' && (messageContent || '').length > 2) {
      base44.asServiceRole.functions.invoke('nexusAgentBrain', {
        thread_id: thread.id,
        contact_id: contact.id,
        message_content: messageContent,
        integration_id: integration.id,
        provider,
        trigger: 'inbound',
        mode: 'copilot'
      }).then(() => {
        console.log(`[INBOUND-GATE] 🧠 Brain CAMADA 3 concluído para thread ${thread.id}`);
      }).catch(e => {
        console.warn(`[INBOUND-GATE] ⚠️ Brain CAMADA 3 erro: ${e.message}`);
      });
      result.actions.push('nexus_brain_copilot_dispatched');
    }

    return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, stop: true, reason: 'context_notify_only' });
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

  // 5b. AGENDA IA (CLAUDE): Detectar intenção de agendamento ANTES da URA
  result.pipeline.push('claude_agenda_check');
  if (message?.sender_type === 'contact' && messageContent?.length > 2) {
    if (!integration?.id) {
      console.warn(`[${VERSION}] ⚠️ integration.id ausente — claudeAgendaAgent não pode ser acionado`);
    } else {
      const textoAgenda = (messageContent || '').toLowerCase();
      const ehAgenda = /(agendar|agendamento|marcar|desmarcar|reagendar|remarcar|cancelar|horário|horario|disponível|disponivel|consulta|visita|reunião|reuniao)/.test(textoAgenda);
      if (ehAgenda) {
        result.pipeline.push('claude_agenda_dispatch');
        try {
          console.log(`[${VERSION}] 📅 Intenção de agendamento detectada — ativando claudeAgendaAgent`);
          await base44.asServiceRole.functions.invoke('claudeAgendaAgent', {
            thread_id: thread.id,
            contact_id: contact.id,
            message_content: messageContent,
            integration_id: integration.id,
            provider,
          });
          result.actions.push('claude_agenda_responded');
        } catch (e) {
          console.error(`[${VERSION}] ❌ claudeAgendaAgent falhou: ${e.message}`);
          result.actions.push('claude_agenda_failed');
        }
        return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, routed: true, to: 'claude_agenda' });
      }
    }
  }

  // 6. NOVO CICLO E DECISÃO: PRÉ-ATENDIMENTO vs SKILL AUTÔNOMA
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
    // DECISÃO: Pré-atendimento clássico OU skill autônoma?
    // Se é novo contato E sem atendente → menu completo
    // Se tem intenção clara → direto para atribuição
    
    const temAtendente = !!thread.assigned_user_id;
    const ehPrimeiraMsg = !thread.last_human_message_at;
    
    if (!temAtendente && !ehPrimeiraMsg) {
      // Contato voltou → pré-atendimento com sticky (memória)
      result.pipeline.push('pre_atendimento_sticky');
      console.log(`[${VERSION}] 🔄 Contato recorrente → pré-atendimento com contexto`);
    } else if (!temAtendente && ehPrimeiraMsg) {
      // Primeiro contato novo → usar skill autônoma para eficiência
      result.pipeline.push('skill_primeiro_contato_autonomo');
    
      // ════════════════════════════════════════════════════════════════
      // 🆕 PRIMEIRO ATENDIMENTO: SKILL AUTÔNOMA (eficiente + boas-vindas)
      // Detecta intenção → atribui atendente → envia mensagem de boas-vindas
      // ════════════════════════════════════════════════════════════════
      try {
        console.log(`[${VERSION}] 🤖 Primeiro contato → skill autônoma`);
        
        await base44.asServiceRole.functions.invoke('skillPrimeiroContatoAutonomo', {
          thread_id: thread.id,
          contact_id: contact.id,
          force_retry: false
        });
        
        result.actions.push('skill_autonoma_acionada');
        return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, handled_by: 'skill_autonoma' });
        
      } catch (e) {
        console.error(`[${VERSION}] ❌ Skill autônoma falhou:`, e.message);
        result.actions.push('skill_autonoma_falhou');
        
        // Fallback: pré-atendimento clássico com menu
        console.log(`[${VERSION}] ⏸️ Fallback: acionando pré-atendimento menu`);
        try {
          await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
            thread_id: thread.id,
            contact_id: contact.id,
            whatsapp_integration_id: thread.whatsapp_integration_id,
            user_input: { type: 'system', content: '' }
          });
          result.actions.push('pre_atendimento_fallback');
        } catch (uraErr) {
          console.error(`[${VERSION}] ❌ Pré-atendimento também falhou:`, uraErr.message);
          // Última opção: enfileirar
          await base44.asServiceRole.entities.WorkQueueItem.create({
            contact_id: contact.id,
            thread_id: thread.id,
            tipo: 'manual',
            reason: 'ambas_habilidades_falharam',
            severity: 'high',
            status: 'open',
            notes: `Skill + pré-atendimento falharam. Mensagem: "${messageContent}"`
          }).catch(() => {});
        }
        
        return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, fallback: 'triggered' });
      }
    } else if (isHumanDormant) {
      // ════════════════════════════════════════════════════════════════
      // HUMANO DORMINDO: Reativar com pré-atendimento menu
      // ════════════════════════════════════════════════════════════════
      result.pipeline.push('pre_atendimento_reativacao');
      try {
        console.log(`[${VERSION}] 😴 Atendente dormindo → menu pré-atendimento`);
        await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
          thread_id: thread.id,
          contact_id: contact.id,
          whatsapp_integration_id: thread.whatsapp_integration_id,
          user_input: { type: 'system', content: '' }
        });
        result.actions.push('pre_atendimento_reativacao_acionado');
        return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions });
      } catch (e) {
        console.error(`[${VERSION}] ❌ Pré-atendimento reativação falhou:`, e.message);
      }
    }

  // NEXUS BRAIN: Agente autônomo — percepção → decisão → ação
  result.pipeline.push('nexus_brain');
  if (message?.sender_type === 'contact' && messageContent?.length > 2) {
    if (!integration?.id) {
      console.warn(`[${VERSION}] ⚠️ integration.id ausente — nexusAgentBrain não pode ser acionado`);
      result.actions.push('nexus_brain_skipped_no_integration');
    } else {
      try {
        console.log(`[${VERSION}] 🧠 Ativando Nexus Brain`);
        await base44.asServiceRole.functions.invoke('nexusAgentBrain', {
          thread_id: thread.id,
          contact_id: contact.id,
          message_content: messageContent,
          integration_id: integration.id,
          provider,
          trigger: 'inbound',
          mode: 'copilot'
        });
        result.actions.push('nexus_brain_responded');
      } catch (e) {
        console.error(`[${VERSION}] ❌ nexusAgentBrain falhou: ${e.message}`);
        result.actions.push('nexus_brain_failed');
      }
    }
  }

  result.pipeline.push('normal_message');
  result.actions.push('message_in_cycle_no_ura');
  console.log(`[${VERSION}] ✅ Mensagem processada`);
  return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions });
});