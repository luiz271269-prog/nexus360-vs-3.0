// redeploy: 2026-03-20T16:00-FIX-HUMAN-ACTIVE
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// PROCESS INBOUND - v11.0.0 INLINE (sem imports locais)
// ============================================================================
// Pipeline: normalize → dedup → reset_promos → human_check → URA dispatch
// ============================================================================

const VERSION = 'v11.1.0-BUSINESS-HOURS';

// ── Verificar horário comercial (Brasília = UTC-3) ──────────────────────
// Regra: Seg-Sex 08:00-18:00. Sábado e Domingo: FECHADO.
function isWithinBusinessHours() {
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const diaSemana = brasilia.getUTCDay(); // 0=dom, 1=seg, ..., 6=sab
  const minutosTotais = brasilia.getUTCHours() * 60 + brasilia.getUTCMinutes();

  // Somente Seg(1) a Sex(5)
  if (diaSemana < 1 || diaSemana > 5) return false;
  return minutosTotais >= 8 * 60 && minutosTotais < 18 * 60;
}

function humanoAtivo(thread, horasStale = 2) {
  if (!thread.assigned_user_id) return false;
  if (thread.pre_atendimento_ativo) return false;
  if (!thread.last_human_message_at) return false;
  
  // ✅ FIX CRÍTICO: last_human_message_at pode ter sido setado por sync WA Web (isFromMe)
  // OU por mensagens automáticas do sistema. Verificar se o timestamp é recente E
  // se o assigned_user_id é um ObjectId real (não 'system', 'nexus_agent', integrationId)
  const isRealUserId = /^[a-f0-9]{24}$/i.test(String(thread.assigned_user_id));
  if (!isRealUserId) return false;
  
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

  const { message, integration, provider, messageContent, rawPayload } = payload;
  let { contact, thread } = payload;

  // ════════════════════════════════════════════════════════════════
  // GUARD ECHO: Bloquear mensagens enviadas pelo próprio sistema.
  // fromMe=true, fromMe=null, ou sender_type='user' = mensagem de saída.
  // Sem este guard, a W-API re-entrega o webhook das msgs enviadas
  // pelo sistema e o pipeline processa como se fosse o cliente.
  // ════════════════════════════════════════════════════════════════
  const isFromMe = rawPayload?.fromMe === true ||
    rawPayload?.key?.fromMe === true ||
    message?.sender_type === 'user';

  if (isFromMe) {
    console.log(`[${VERSION}] 🛑 ECHO GUARD: mensagem de saída ignorada (fromMe=true ou sender_type=user)`);
    return Response.json({ success: true, skipped: true, reason: 'echo_outbound' });
  }

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

  // ════════════════════════════════════════════════════════════════
  // [BUSINESS HOURS] VERIFICAÇÃO DE HORÁRIO COMERCIAL
  // Se fora do expediente: enviar mensagem automática e aguardar abertura
  // ════════════════════════════════════════════════════════════════
  if (message?.sender_type === 'contact') {
    const dentroHorario = isWithinBusinessHours();

    if (!dentroHorario) {
      console.log(`[${VERSION}] 🕐 FORA DO HORÁRIO COMERCIAL — verificando se já avisou...`);
      result.pipeline.push('business_hours_check');

      // Verificar se já enviamos QUALQUER msg outbound nas últimas 8h nessa thread
      // (cobre: nexus_agent, skillACKImediato, preAtendimentoHandler, motorDecisao)
      const oitoHorasAtras = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
      let jaAviso = false;
      try {
        const msgsRecentes = await base44.asServiceRole.entities.Message.filter({
          thread_id: thread?.id,
          sender_type: 'user',
          created_date: { $gte: oitoHorasAtras }
        }, '-created_date', 1);
        jaAviso = (msgsRecentes?.length || 0) > 0;
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro ao verificar aviso horário:`, e.message);
      }

      if (!jaAviso) {
        const msgFechado = `Olá! Recebemos sua mensagem 😊\n\nNosso atendimento funciona de *segunda a sexta, das 08h às 18h* (horário de Brasília).\n\nNossa equipe entrará em contato assim que abrirmos. Até logo! 👋`;

        // Enviar mensagem de fora do horário
        try {
          const integrationId = integration?.id || thread?.whatsapp_integration_id;
          if (integrationId) {
            await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
              integration_id: integrationId,
              numero_destino: contact?.telefone,
              mensagem: msgFechado
            });

            // Salvar mensagem no histórico
            await base44.asServiceRole.entities.Message.create({
              thread_id: thread?.id,
              sender_id: 'nexus_agent',
              sender_type: 'user',
              content: msgFechado,
              channel: 'whatsapp',
              status: 'enviada',
              sent_at: now.toISOString(),
              visibility: 'public_to_customer',
              metadata: { is_ai_response: true, ai_agent: 'processInbound', trigger: 'business_hours_closed' }
            }).catch(() => {});

            console.log(`[${VERSION}] ✅ Mensagem fora do horário enviada para ${contact?.nome}`);
          }
        } catch (e) {
          console.warn(`[${VERSION}] ⚠️ Falha ao enviar msg fora horário:`, e.message);
        }
      } else {
        console.log(`[${VERSION}] ⏭️ Aviso de fora do horário já enviado nas últimas 8h — não repetindo`);
      }

      // Marcar thread como aguardando horário comercial
      try {
        await base44.asServiceRole.entities.MessageThread.update(thread?.id, {
          routing_stage: 'WAITING_BUSINESS_HOURS',
          last_message_at: now.toISOString(),
          last_inbound_at: now.toISOString(),
          last_message_sender: 'contact',
          last_message_content: (messageContent || '').substring(0, 200)
        });
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Falha ao marcar WAITING_BUSINESS_HOURS:`, e.message);
      }

      result.actions.push('business_hours_closed');
      return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, stop: true, reason: 'outside_business_hours' });
    }

    // Dentro do horário: se estava aguardando, limpar o stage
    if (thread?.routing_stage === 'WAITING_BUSINESS_HOURS') {
      try {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          routing_stage: 'NEW',
          pre_atendimento_state: 'INIT',
          pre_atendimento_ativo: false,
          assigned_user_id: null,
          sector_id: null
        });
        thread = { ...thread, routing_stage: 'NEW', pre_atendimento_state: 'INIT', pre_atendimento_ativo: false, assigned_user_id: null, sector_id: null };
        console.log(`[${VERSION}] 🔄 Thread saiu de WAITING_BUSINESS_HOURS → resetada para INIT`);
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Falha ao limpar WAITING_BUSINESS_HOURS:`, e.message);
      }
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
      if (existing?.length >= 1) { // >= 1: msg já foi salva (retry detectado)
        console.log(`[${VERSION}] ⏭️ DUPLICATA: ${message.whatsapp_message_id}`)
        result.actions.push('skipped_duplicate');
        return Response.json({ success: true, skipped: true, reason: 'duplicate', pipeline: result.pipeline, actions: result.actions });
      }
    } catch (e) {
      // ✅ FIX: Se rate limited durante idempotência, abortar com segurança
      if (e.message?.includes('429') || e.message?.includes('Rate limit')) {
        console.warn(`[${VERSION}] ⚠️ Rate limit (429) na idempotência — abortando para evitar duplicação`);
        return Response.json({ success: true, skipped: true, reason: 'rate_limit_idempotency', pipeline: result.pipeline, actions: ['rate_limit_idempotency'] });
      }
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

  // ✅ Garantir que assigned_user_id está em participants[] E atendentes_historico[]
  // Isso garante que a thread aparece em "Minhas Conversas" do atendente
  if (thread?.assigned_user_id && message?.sender_type === 'contact') {
    try {
      const participants = Array.isArray(thread.participants) ? [...thread.participants] : [];
      const atendentesHistorico = Array.isArray(thread.atendentes_historico) ? [...thread.atendentes_historico] : [];
      const updateData = {};
      
      if (!participants.includes(thread.assigned_user_id)) {
        participants.push(thread.assigned_user_id);
        updateData.participants = participants;
      }
      if (!atendentesHistorico.includes(thread.assigned_user_id)) {
        atendentesHistorico.push(thread.assigned_user_id);
        updateData.atendentes_historico = atendentesHistorico;
      }
      if (Object.keys(updateData).length > 0) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, updateData);
        console.log(`[${VERSION}] ✅ assigned_user_id adicionado a participants[] e atendentes_historico[]`);
      }
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro ao atualizar participants[]:`, e.message);
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
  // ⚠️ NOVO CICLO (>12h sem mensagem) tem PRIORIDADE sobre esta camada —
  // cliente voltou depois de horas/dias → deve passar pelo pré-atendimento.
  const novoCicloPreCheck = detectNovoCiclo(thread?.last_inbound_at);
  result.pipeline.push('context_check');
  // ✅ FIX CRÍTICO: Se é novo ciclo (>12h), NUNCA bloquear na Camada 3
  // O cliente voltou depois de horas/dias → precisa do pré-atendimento
  if (thread?.assigned_user_id && thread?.sector_id && !humanoAtivo(thread) && !novoCicloPreCheck) {
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
  if (thread.assistant_mode === 'agenda' || integration?.nome_instancia === 'NEXUS_AGENDA_INTEGRATION' || contact?.telefone === '+5548999142800') {
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

  // ── ACK IMEDIATO foi removido deste ponto — o preAtendimentoHandler v12 já envia saudação ──

  // 5c. SOLICITAÇÃO DE DOCUMENTO FISCAL — detectar e disparar PDF automaticamente
  result.pipeline.push('doc_fiscal_check');
  if (message?.sender_type === 'contact' && contact?.id && (messageContent || '').length > 2) {
    try {
      const deteccaoFiscal = await base44.asServiceRole.functions.invoke('detectarSolicitacaoDocFiscal', {
        mensagem: messageContent,
        contact_id: contact.id,
        thread_id: thread?.id
      });

      if (deteccaoFiscal?.data?.eh_solicitacao_fiscal && deteccaoFiscal.data.notas?.length > 0) {
        console.log(`[${VERSION}] 📄 Solicitação fiscal detectada! Notas encontradas: ${deteccaoFiscal.data.notas_encontradas}`);
        result.actions.push('doc_fiscal_detectado');

        // Enviar a nota mais recente com PDF disponível
        const notaComPDF = deteccaoFiscal.data.notas.find(n => n.pdf_url);
        if (notaComPDF) {
          await base44.asServiceRole.functions.invoke('dispararNotaFiscalWhatsApp', {
            nota_fiscal_id: notaComPDF.id,
            contact_id: contact.id,
            thread_id: thread?.id,
            integration_id: integration?.id || thread?.whatsapp_integration_id
          });
          result.actions.push('nf_enviada_automaticamente');
          console.log(`[${VERSION}] ✅ NF ${notaComPDF.numero_nf} enviada automaticamente`);
          return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions, routed: true, to: 'doc_fiscal_auto' });
        }
      }
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ doc_fiscal_check falhou (prosseguindo): ${e.message}`);
    }
  }

  // 6. NOVO CICLO E DECISÃO: PRÉ-ATENDIMENTO vs SKILL AUTÔNOMA
  result.pipeline.push('cycle_detection');
  const novoCiclo = novoCicloPreCheck; // já calculado acima
  const isUraActive = thread.pre_atendimento_ativo === true;
  const isHumanDormant = thread.assigned_user_id && !humanoAtivo(thread, 2);

  // Se é novo ciclo com thread contextualizada: resetar estado para forçar menu
  if (novoCiclo && thread?.assigned_user_id && thread?.sector_id) {
    // ✅ FIX C2: NÃO zerar se contact tem atendente fidelizado — preAtendimentoHandler vai direto
    const temFidelizado =
      contact?.atendente_fidelizado_vendas ||
      contact?.atendente_fidelizado_assistencia ||
      contact?.atendente_fidelizado_financeiro ||
      contact?.atendente_fidelizado_fornecedor;

    if (temFidelizado) {
      console.log(`[${VERSION}] ⚡ NOVO CICLO + FIDELIZADO → preservando atendente, apenas resetando estado`);
      try {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_ativo: false,
          pre_atendimento_state: 'INIT'
        });
        thread = { ...thread, pre_atendimento_ativo: false, pre_atendimento_state: 'INIT' };
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro ao resetar estado (fidelizado):`, e.message);
      }
      result.actions.push('thread_reset_new_cycle_fidelizado_preserved');
    } else {
      console.log(`[${VERSION}] 🔄 NOVO CICLO com thread contextualizada → resetando estado para pré-atendimento`);
      try {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_ativo: false,
          pre_atendimento_state: 'INIT',
          assigned_user_id: null,
          sector_id: null
        });
        thread = { ...thread, pre_atendimento_ativo: false, pre_atendimento_state: 'INIT', assigned_user_id: null, sector_id: null };
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro ao resetar thread para novo ciclo:`, e.message);
      }
      result.actions.push('thread_reset_new_cycle');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // GUARD OUTBOUND: Se há mensagem do sistema nos últimos 30s, URA já está ativa.
  // Resolve a race condition onde 2 webhooks chegam com < 500ms de diferença
  // e ambos passam pelo lock check antes de qualquer um gravar no banco.
  // ════════════════════════════════════════════════════════════════
  if (message?.sender_type === 'contact') {
    try {
      const trintaSegAtras = new Date(Date.now() - 30000).toISOString();
      const msgsSistema = await base44.asServiceRole.entities.Message.filter({
        thread_id: thread.id,
        sender_type: 'user',
        created_date: { $gte: trintaSegAtras }
      }, '-created_date', 1);

      if (msgsSistema && msgsSistema.length > 0) {
        console.log(`[${VERSION}] 🔒 GUARD OUTBOUND: já existe resposta do sistema nos últimos 30s (${msgsSistema[0].id}) — skip dispatch`);
        result.actions.push('skipped_outbound_guard');
        return Response.json({ success: true, skipped: true, reason: 'outbound_guard_30s', pipeline: result.pipeline, actions: result.actions });
      }
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro no outbound guard (prosseguindo):`, e.message);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // OPÇÃO C: Re-buscar thread fresca ANTES de calcular shouldDispatch.
  // Garante que o 2º webhook lê pre_atendimento_ativo=true gravado pelo 1º.
  // ════════════════════════════════════════════════════════════════
  try {
    const threadFresca = await base44.asServiceRole.entities.MessageThread.get(thread.id);
    if (threadFresca.pre_atendimento_ativo === true) {
      const ageMs = threadFresca.pre_atendimento_started_at
        ? Date.now() - new Date(threadFresca.pre_atendimento_started_at).getTime()
        : 0;
      if (ageMs < 45_000) {
        console.log(`[${VERSION}] 🔒 Opção C: pre_atendimento_ativo=true no banco (age=${ageMs}ms) — skip`);
        result.actions.push('skipped_pre_atendimento_already_active');
        return Response.json({ success: true, skipped: true, reason: 'pre_atendimento_already_active', pipeline: result.pipeline, actions: result.actions });
      }
    }
    thread = threadFresca; // usar dados frescos
  } catch (e) {
    console.warn(`[${VERSION}] ⚠️ Erro ao re-buscar thread fresca (prosseguindo):`, e.message);
  }

  let shouldDispatch = false;
  const isUraActiveFresco = thread.pre_atendimento_ativo === true;
  if (isUraActiveFresco) shouldDispatch = true;
  else if (novoCiclo) shouldDispatch = true;
  else if (isHumanDormant && messageContent?.length > 4) shouldDispatch = true;
  else if (!thread.assigned_user_id) shouldDispatch = true;

  if (shouldDispatch) {
    // Gravar lock no banco antes de disparar
    try {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_ativo: true,
        pre_atendimento_started_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro ao gravar lock dispatch:`, e.message);
    }
  }

  if (shouldDispatch) {
    result.pipeline.push('pre_atendimento_dispatch');
    console.log(`[${VERSION}] 🎯 Despachando para preAtendimentoHandler (URA ativa=${isUraActive}, novoCiclo=${novoCiclo}, dormant=${isHumanDormant})`);
    try {
      await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
        thread_id: thread.id,
        contact_id: contact.id,
        whatsapp_integration_id: integration?.id || thread.whatsapp_integration_id,
        user_input: { type: 'text', content: messageContent || '' }
      });
      result.actions.push('pre_atendimento_acionado');
    } catch (e) {
      console.error(`[${VERSION}] ❌ preAtendimentoHandler falhou: ${e.message}`);
      result.actions.push('pre_atendimento_falhou');
      // Fallback: enfileirar para atendimento manual
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id: contact.id,
        thread_id: thread.id,
        tipo: 'manual',
        reason: 'pre_atendimento_falhou',
        severity: 'high',
        status: 'open',
        notes: `preAtendimentoHandler falhou: ${e.message}`
      }).catch(() => {});
    }
    return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions });
  }

  // ✅ FIX: NUNCA chamar Nexus Brain se pré-atendimento foi acionado
  // preAtendimentoHandler já disparou as Skills autônomas (ACK, IntentRouter, QueueManager)
  // Chamar Brain aqui causaria duplicação de atendimento
  const preAtendimentoDispatchado = result.actions.includes('pre_atendimento_acionado');

  result.pipeline.push('nexus_brain');
  if (!preAtendimentoDispatchado && message?.sender_type === 'contact' && messageContent?.length > 2) {
    if (!integration?.id) {
      console.warn(`[${VERSION}] ⚠️ integration.id ausente — nexusAgentBrain não pode ser acionado`);
      result.actions.push('nexus_brain_skipped_no_integration');
    } else {
      try {
        console.log(`[${VERSION}] 🧠 Ativando Nexus Brain (pré-atendimento não foi despachado)`);
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
  } else if (preAtendimentoDispatchado) {
    console.log(`[${VERSION}] ⏭️ Pré-atendimento já foi despachado — Nexus Brain SKIPPED para evitar duplicação`);
    result.pipeline.push('nexus_brain_skipped_pre_atendimento_active');
  }

  result.pipeline.push('normal_message');
  result.actions.push('message_in_cycle_no_ura');
  console.log(`[${VERSION}] ✅ Mensagem processada`);

  return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions });
});