// redeploy: 2026-05-12T-B3-B4-GATE-PURO
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// PROCESS INBOUND - v12.0.0 GATE PURO (B0+B1+B2+B3+B4)
// ============================================================================
// O gate é APENAS infraestrutura: idempotência, deduplicação, filtros internos,
// reset de estado em novo ciclo, opt-out, guards de race condition.
// TODA decisão de resposta/automação/notificação é da skillPreAtendimentos.
// Fluxo: webhook → gate (puro) → skill (árbitro único) → playbookEngine.
// ============================================================================

const VERSION = 'v12.0.0-GATE-PURO';

// ── CACHE MÓDULO: chips e usuários internos (TTL 90s) ──────────────────
let _cacheChipsProc = null;
let _cacheChipsProcTs = 0;
let _cacheUsersProc = null;
let _cacheUsersProcTs = 0;
const CACHE_INTERNO_TTL = 90_000;

// ── CACHE POSITIVO de thread fresca (TTL 5s) ──────────────────────────
// SEGURANÇA v2: só cacheia quando pre_atendimento_ativo=true (lock ativo).
// Cache negativo NÃO é guardado — poderia liberar dispatch duplicado quando
// outro webhook gravou o lock entre cache e leitura. Race-condition de 500ms
// continua coberta (TTL 5s >> 500ms), sem enfraquecer o guard de duplicidade.
const _cacheThreadFresca = new Map(); // thread_id -> { thread, ts }
const CACHE_THREAD_FRESCA_TTL = 5_000;

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
    // Z-API retry sem token vai cair aqui. Silenciar 403 ruidoso (não é bug real).
    if (e?.message?.includes('private') || e?.message?.includes('auth') || e?.message?.includes('403')) {
      // [403_ORIGIN] carimbo de origem para separar dos 403 de frontend/audit no log
      console.warn(`[${VERSION}] [403_ORIGIN] etapa=processInbound_sdk_init msg="${e?.message || 'unknown'}"`);
      console.log(`[${VERSION}] ⏭️ Chamada sem auth (retry sem token) — skipped`);
      return Response.json({ success: true, skipped: true, reason: 'sdk_no_auth' });
    }
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  // ════════════════════════════════════════════════════════════════
  // [ANTI-429] JITTER ALEATÓRIO: Espalha chamadas DB simultâneas
  // Quando múltiplos webhooks chegam ao mesmo tempo, cada instância
  // espera um tempo aleatório diferente, evitando o thundering herd
  // que causa cascata de erros 429.
  // ════════════════════════════════════════════════════════════════
  const jitter = Math.floor(Math.random() * 700); // 0~700ms
  if (jitter > 50) {
    await new Promise(r => setTimeout(r, jitter));
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
    let createResult = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        createResult = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
          telefone: contact.telefone,
          pushName: contact.nome || null,
          profilePicUrl: contact.foto_perfil_url || null,
          conexaoId: integration?.id || null
        });
        break;
      } catch (retryErr) {
        const is429 = retryErr.message?.includes('429') || retryErr.message?.includes('Rate limit');
        if (is429 && attempt < 3) {
          const waitMs = attempt * 1200;
          console.warn(`[${VERSION}] ⏳ 429 em getOrCreateContact (tentativa ${attempt}/3) — aguardando ${waitMs}ms`);
          await new Promise(r => setTimeout(r, waitMs));
        } else {
          console.error(`[${VERSION}] ❌ FIX 1: Erro ao garantir contato:`, retryErr.message);
          return Response.json({ success: false, error: 'contact_creation_failed' }, { status: 500 });
        }
      }
    }
    if (createResult?.data?.success && createResult?.data?.contact?.id) {
      contact = createResult.data.contact;
      console.log(`[${VERSION}] ✅ FIX 1: Contato criado/recuperado: ${contact.id}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // [FASE 6] OPT-OUT AUTOMÁTICO — Detectar PARE/REMOVER/CANCELAR
  // Se cliente responde com palavras de descadastro, marca opt-out
  // e BLOQUEIA todos os envios automáticos futuros (promoções, broadcasts)
  // ════════════════════════════════════════════════════════════════
  if (contact?.id && message?.sender_type === 'contact' && messageContent) {
    const textoLower = messageContent.toLowerCase().trim();
    // Regex: palavras-chave isoladas ou em frases curtas
    const ehOptOut = /^(pare|parar|remover|remove|sair|cancelar|cancela|descadastrar|descadastra|nao quero|não quero|stop|unsubscribe|nao envie|não envie|chega|sem promocao|sem promoção)[\s!.?]*$/i.test(textoLower)
      || /(n[ãa]o\s*me\s*envie|n[ãa]o\s*quero\s*receber|parar\s*de\s*receber|remover\s*meu\s*n[úu]mero|n[ãa]o\s*quero\s*promo|descadastra?r?)/i.test(textoLower);

    if (ehOptOut) {
      console.warn(`[${VERSION}] 🚫 OPT-OUT DETECTADO: ${contact.nome} (${contact.telefone}) → "${messageContent.substring(0, 50)}"`);
      try {
        const tagsAtuais = Array.isArray(contact.tags) ? contact.tags : [];
        if (!tagsAtuais.includes('opt_out')) tagsAtuais.push('opt_out');

        await base44.asServiceRole.entities.Contact.update(contact.id, {
          tags: tagsAtuais,
          whatsapp_optin: false,
          observacoes: `${contact.observacoes || ''}\n[${new Date().toLocaleDateString('pt-BR')}] Opt-out automático: "${messageContent.substring(0, 100)}"`.trim()
        });

        await base44.asServiceRole.entities.AutomationLog.create({
          acao: 'outro',
          contato_id: contact.id,
          thread_id: thread?.id,
          resultado: 'sucesso',
          timestamp: now.toISOString(),
          origem: 'webhook',
          detalhes: {
            mensagem: `Opt-out automático: "${messageContent.substring(0, 100)}"`,
            dados_contexto: { palavra_detectada: textoLower.substring(0, 50) }
          }
        }).catch(() => {});

        result.actions.push('opt_out_automatico_aplicado');
      } catch (e) {
        console.error(`[${VERSION}] ❌ Erro ao aplicar opt-out:`, e.message);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // [INBOUND-GATE] CAMADA 5 — BATCH WINDOW (10 segundos)
  // [OTIMIZAÇÃO 429 v2] Skip se thread.last_inbound_at é mais antigo que 10s:
  // impossível haver msgs em janela de 10s se a última inbound foi há +10s.
  // SEGURANÇA: ausência de last_inbound_at = consulta (não pula guard).
  // Princípio: "não sei" é diferente de "posso pular".
  const hasLastInbound = !!thread?.last_inbound_at;
  const lastInboundMs = hasLastInbound
    ? Date.now() - new Date(thread.last_inbound_at).getTime()
    : null;
  if (contact?.id && (!hasLastInbound || lastInboundMs <= 10_000)) {
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
  // [INBOUND-GATE] CAMADA 1 — FILTRO INTERNO (RESTAURADO TEMPORARIAMENTE)
  // ⚠️ ROLLBACK ATIVO: Camada -2 do primeiroAtendimentoUnificado existe
  // no código mas o deploy travou. Mantendo o filtro aqui até confirmar
  // que a Camada -2 está rodando em produção.
  // ════════════════════════════════════════════════════════════════
  const canonico = (contact?.telefone || contact?.telefone_canonico || '').replace(/\D/g, '');
  if (canonico) {
    try {
      const agora = Date.now();
      if (!_cacheChipsProc || (agora - _cacheChipsProcTs) > CACHE_INTERNO_TTL) {
        try {
          const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({}, '-created_date', 30);
          _cacheChipsProc = integracoes.map(i => (i.numero_telefone || '').replace(/\D/g, '')).filter(Boolean);
          _cacheChipsProcTs = agora;
        } catch(e) {
          _cacheChipsProc = _cacheChipsProc || [];
        }
      }
      const numerosChips = _cacheChipsProc;

      if (numerosChips.includes(canonico)) {
        console.log(`[INBOUND-GATE] 🛑 CAMADA 1: Chip interno detectado (${canonico}) — pipeline interrompido`);
        return Response.json({ success: true, skipped: true, reason: 'chip_interno', pipeline: ['internal_filter'] });
      }

      if (!_cacheUsersProc || (Date.now() - _cacheUsersProcTs) > CACHE_INTERNO_TTL) {
        try {
          const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 100);
          _cacheUsersProc = usuarios
            .map(u => (u.phone || u.attendant_phone || u.whatsapp_phone || '').replace(/\D/g, ''))
            .filter(t => t && t.length >= 10);
          _cacheUsersProcTs = Date.now();
        } catch(e) {
          _cacheUsersProc = _cacheUsersProc || [];
        }
      }
      const telefonesInternos = _cacheUsersProc;

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
  // [BUSINESS HOURS] Migrado para skillPreAtendimentos (Camada 1).
  // Skill lê horário de ConfiguracaoSistema/horario_expediente,
  // mídia de ConfiguracaoMidiaSistema/pre_atendimento_logo_animado,
  // e envia ACK + vídeo + promo rotacionada (cooldown 12h).
  // processInbound deixou de competir com a skill.
  // ════════════════════════════════════════════════════════════════

  // 1. IDEMPOTÊNCIA
  result.pipeline.push('idempotency_check');
  if (message?.whatsapp_message_id && integration?.id) {
    try {
      const existing = await base44.asServiceRole.entities.Message.filter({
        whatsapp_message_id: message.whatsapp_message_id,
        'metadata.whatsapp_integration_id': integration.id
      }, '-created_date', 1);
      if (existing?.length >= 2) { // >= 2: retry real (mesma msg salva 2x+)
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
  // [PATCH B4] Camada 3 simplificada: apenas marca contexto, sem decisão de resposta.
  // Detecções (micro-intent, agenda, fiscal, brain) são todas da skill em Camada 0.
  if (thread?.assigned_user_id && thread?.sector_id && !novoCicloPreCheck) {
    console.log(`[INBOUND-GATE] 🔔 CAMADA 3 (B4): Thread contextualizada — encaminhando à skill com context.thread_assigned=true`);
    result.actions.push('context_marked_for_skill');
  }

  // [PATCH B2] HARD-STOP de humano ativo REMOVIDO.
  // A skill arbitra via Camada 0.5 (context.human_active=true → notify only).
  result.pipeline.push('human_check_observed');
  const humanAtivoFlag = thread ? humanoAtivo(thread) : false;
  if (humanAtivoFlag) {
    console.log(`[INBOUND-GATE] 👤 (B2): humano ativo observado — encaminhando à skill com context.human_active=true`);
    result.actions.push('human_active_marked_for_skill');
  }

  // [PATCH B1] Detecções Agenda mode / Claude Agenda / Doc Fiscal MIGRADAS
  // para skillPreAtendimentos Camada 0.3 (a/b/c). Gate é gate puro.

  // 6. NOVO CICLO E DECISÃO: PRÉ-ATENDIMENTO vs SKILL AUTÔNOMA
  result.pipeline.push('cycle_detection');
  const novoCiclo = novoCicloPreCheck; // já calculado acima
  const isUraActive = thread.pre_atendimento_ativo === true;
  const _janelaHumanoDormant = (thread.assigned_user_id && thread.sector_id) ? 48 : 2;
  const isHumanDormant = thread.assigned_user_id && !humanoAtivo(thread, _janelaHumanoDormant);

  // Se é novo ciclo com thread contextualizada: decidir se preserva ou reseta atendente
  if (novoCiclo && thread?.assigned_user_id && thread?.sector_id) {
    // ✅ FIX C2: NÃO zerar se contact tem atendente fidelizado — preAtendimentoHandler vai direto
    const temFidelizado =
      contact?.atendente_fidelizado_vendas ||
      contact?.atendente_fidelizado_assistencia ||
      contact?.atendente_fidelizado_financeiro ||
      contact?.atendente_fidelizado_fornecedor;

    // ✅ FIX NOVO CICLO v2: Se atendente atual está em atendentes_historico E a thread
    // foi atualizada nos últimos 7d, preserva o vínculo mas RESETA routing_stage
    // para a skill unificada reanalisar o intent (pode reatribuir se setor mudou).
    // Regra de negócio: cliente retornando dentro de 7d → mantém continuidade,
    // mas permite reroteamento se a intenção mudou de setor.
    const JANELA_PRESERVA_VINCULO_MS = 7 * 24 * 60 * 60 * 1000;
    const historico = Array.isArray(thread.atendentes_historico) ? thread.atendentes_historico : [];
    const atendenteNoHistorico = historico.includes(thread.assigned_user_id);
    const threadAtualizadaRecente = thread.updated_date
      && (Date.now() - new Date(thread.updated_date).getTime()) < JANELA_PRESERVA_VINCULO_MS;
    const preservarVinculo = atendenteNoHistorico && threadAtualizadaRecente;

    if (temFidelizado) {
      // ✅ FIX FORENSE: identifica QUAL atendente é o fidelizado e força a thread
      // para ele se a atribuição atual estiver errada (ex: thread sequestrada
      // por admin durante envio manual de promoção).
      const fidelizadoId =
        contact.atendente_fidelizado_vendas ||
        contact.atendente_fidelizado_assistencia ||
        contact.atendente_fidelizado_financeiro ||
        contact.atendente_fidelizado_fornecedor;

      const setorFidelizado =
        contact.atendente_fidelizado_vendas ? 'vendas' :
        contact.atendente_fidelizado_assistencia ? 'assistencia' :
        contact.atendente_fidelizado_financeiro ? 'financeiro' :
        contact.atendente_fidelizado_fornecedor ? 'fornecedor' : null;

      const precisaCorrigir = fidelizadoId && thread.assigned_user_id !== fidelizadoId;

      console.log(`[${VERSION}] ⚡ NOVO CICLO + FIDELIZADO → fidelizado=${fidelizadoId}, atual=${thread.assigned_user_id}, corrigir=${precisaCorrigir}`);

      try {
        const updateData = {
          pre_atendimento_ativo: false,
          pre_atendimento_state: 'INIT'
        };
        if (precisaCorrigir) {
          updateData.assigned_user_id = fidelizadoId;
          if (setorFidelizado) updateData.sector_id = setorFidelizado;
          updateData.routing_stage = 'ASSIGNED';
        }
        await base44.asServiceRole.entities.MessageThread.update(thread.id, updateData);
        thread = { ...thread, ...updateData };
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro ao resetar estado (fidelizado):`, e.message);
      }
      result.actions.push(
        precisaCorrigir
          ? 'thread_fixed_new_cycle_fidelizado_reassigned'
          : 'thread_reset_new_cycle_fidelizado_preserved'
      );
    } else if (preservarVinculo) {
      console.log(`[${VERSION}] 🔗 NOVO CICLO + atendente no histórico <7d → preservando vínculo, resetando routing_stage para reanálise`);
      try {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_ativo: false,
          pre_atendimento_state: 'INIT',
          routing_stage: 'NEW'
        });
        thread = { ...thread, pre_atendimento_ativo: false, pre_atendimento_state: 'INIT', routing_stage: 'NEW' };
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro ao preservar vínculo:`, e.message);
      }
      result.actions.push('thread_reset_new_cycle_vinculo_preservado');
    } else {
      console.log(`[${VERSION}] 🔄 NOVO CICLO com thread contextualizada → resetando estado para pré-atendimento`);
      try {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_ativo: false,
          pre_atendimento_state: 'INIT',
          assigned_user_id: null,
          sector_id: null,
          routing_stage: 'NEW'
        });
        thread = { ...thread, pre_atendimento_ativo: false, pre_atendimento_state: 'INIT', assigned_user_id: null, sector_id: null, routing_stage: 'NEW' };
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
  // [OTIMIZAÇÃO 429 v2] Skip se thread.last_outbound_at é mais antigo que 30s.
  // SEGURANÇA: ausência de last_outbound_at = consulta (não pula guard).
  // Princípio: "não sei" é diferente de "posso pular".
  // ════════════════════════════════════════════════════════════════
  const hasLastOutbound = !!thread?.last_outbound_at;
  const lastOutboundMs = hasLastOutbound
    ? Date.now() - new Date(thread.last_outbound_at).getTime()
    : null;
  if (message?.sender_type === 'contact' && (!hasLastOutbound || lastOutboundMs <= 30_000)) {
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
  // [OTIMIZAÇÃO 429 v2] Cache POSITIVO (TTL 5s):
  // • Cache positivo (pre_atendimento_ativo=true): BLOQUEIA rápido sem ler banco
  // • Cache negativo (pre_atendimento_ativo=false): NÃO confia, lê banco fresco
  // Justificativa: cache negativo poderia liberar dispatch duplicado quando o
  // lock foi gravado por outro webhook entre cache e leitura. Sem cache negativo,
  // mantém exatamente a proteção do MessageThread.get() fresco original.
  // ════════════════════════════════════════════════════════════════
  try {
    let threadFresca;
    const cached = _cacheThreadFresca.get(thread.id);
    // Cache SÓ vale se for um lock positivo (pre_atendimento_ativo=true) recente.
    if (cached?.thread?.pre_atendimento_ativo === true
        && (Date.now() - cached.ts) < CACHE_THREAD_FRESCA_TTL) {
      threadFresca = cached.thread;
      console.log(`[${VERSION}] ♻️ Cache POSITIVO hit (lock ativo, age=${Date.now() - cached.ts}ms)`);
    } else {
      threadFresca = await base44.asServiceRole.entities.MessageThread.get(thread.id);
      // Só cacheia se for lock positivo — cache negativo não é útil e é perigoso.
      if (threadFresca.pre_atendimento_ativo === true) {
        _cacheThreadFresca.set(thread.id, { thread: threadFresca, ts: Date.now() });
      } else {
        _cacheThreadFresca.delete(thread.id); // invalida cache antigo se existir
      }
      // Limpeza simples: se cache > 200 entradas, descarta o mais antigo.
      if (_cacheThreadFresca.size > 200) {
        const oldest = [..._cacheThreadFresca.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) _cacheThreadFresca.delete(oldest[0]);
      }
    }
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

  // [PATCH B2] Dispatch UNIFICADO — toda mensagem inbound válida executa a skill.
  // A skill é o árbitro único: decide se responde / só notifica / aciona playbook etc.
  // Lock pre_atendimento_ativo continua sendo gravado pra proteger contra dupla execução.
  const isUraActiveFresco = thread.pre_atendimento_ativo === true;

  // [P0-E2] LOCK OBRIGATÓRIO antes do dispatch.
  // Se a gravação do lock falhar (especialmente sob 429), NÃO chamar a skill —
  // dois webhooks paralelos sob 429 poderiam ambos passar do guard de re-leitura
  // e ambos chamar a skill sem lock confirmado, causando pré-atendimento duplicado.
  // Em vez disso, criar WorkQueueItem para retry posterior e abortar com sucesso.
  const lockStartedAt = new Date().toISOString();
  try {
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_ativo: true,
      pre_atendimento_started_at: lockStartedAt
    });
    // Atualiza cache positivo local para o próximo webhook bloquear sem nova leitura ao banco.
    _cacheThreadFresca.set(thread.id, {
      thread: { ...thread, pre_atendimento_ativo: true, pre_atendimento_started_at: lockStartedAt },
      ts: Date.now()
    });
  } catch (e) {
    const is429 = e.message?.includes('429')
      || e.message?.includes('Rate limit')
      || e.message?.includes('Limite de taxa');
    console.warn(`[${VERSION}] ⚠️ Erro ao gravar lock dispatch (is429=${is429}):`, e.message);
    result.actions.push(is429 ? 'rate_limit_lock_dispatch' : 'lock_dispatch_failed');
    await base44.asServiceRole.entities.WorkQueueItem.create({
      contact_id: contact.id,
      thread_id: thread.id,
      tipo: 'manual',
      reason: is429 ? 'rate_limit_lock_dispatch' : 'lock_dispatch_failed',
      severity: 'high',
      status: 'open',
      notes: `Falha ao gravar lock antes da skill: ${e.message}`
    }).catch(() => {});
    return Response.json({
      success: true,
      skipped: true,
      reason: is429 ? 'rate_limit_lock_dispatch' : 'lock_dispatch_failed',
      pipeline: result.pipeline,
      actions: result.actions
    });
  }

  result.pipeline.push('skill_dispatch_unificado');
  console.log(`[${VERSION}] 🎯 (B2) Dispatch unificado à skill (URA=${isUraActiveFresco}, novoCiclo=${novoCiclo}, humanAtivo=${humanAtivoFlag}, threadAssigned=${!!thread.assigned_user_id})`);
  try {
    await base44.asServiceRole.functions.invoke('skillPreAtendimentos', {
      thread_id: thread.id,
      contact_id: contact.id,
      integration_id: integration?.id || thread.whatsapp_integration_id,
      message_id: message?.id,
      message_content: messageContent || '',
      provider,
      context: {
        thread_assigned: !!(thread.assigned_user_id && thread.sector_id),
        human_active: humanAtivoFlag === true,
        novo_ciclo: novoCiclo === true,
        sector_id: thread.sector_id || null,
        assigned_user_id: thread.assigned_user_id || null,
        ura_active: isUraActiveFresco,
        human_dormant: isHumanDormant === true
      },
      _legacy_caller: 'processInbound.dispatch_unificado_b2'
    });
    result.actions.push('pre_atendimento_acionado');
  } catch (e) {
    console.error(`[${VERSION}] ❌ skillPreAtendimentos falhou: ${e.message}`);
    result.actions.push('pre_atendimento_falhou');
    await base44.asServiceRole.entities.WorkQueueItem.create({
      contact_id: contact.id,
      thread_id: thread.id,
      tipo: 'manual',
      reason: 'pre_atendimento_falhou',
      severity: 'high',
      status: 'open',
      notes: `skillPreAtendimentos falhou: ${e.message}`
    }).catch(() => {});
  }
  // [PATCH B3] Nexus Brain fallback REMOVIDO. A skill é o árbitro único — invoca
  // o Brain (modo copilot) quando precisa em Camada 0.4. Aqui não há mais fallback.
  return Response.json({ success: true, pipeline: result.pipeline, actions: result.actions });
});