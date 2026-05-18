// skillPromocoes.js — Motor de transmissão de promoções em camadas.
// Estrutura idêntica ao skillPreAtendimentos, porém voltado para
// campanhas outbound: seleção de público → elegibilidade → envio → auditoria.
//
// LISTAS SUPORTADAS:
//   urgentes      — sempre recorrente (contatos sem resposta >= 48h)
//   [id da lista] — configuradas em PromotionList (nome, período, repetição)
//
// FLUXO:
//   CAMADA 1 — Selecionar público (por tipo de lista)
//   CAMADA 2 — Dry-run de elegibilidade por contato
//   CAMADA 3 — Envio via enviarPromocao (motor central)
//   CAMADA 4 — Auditoria e métricas no PromotionDispatchLog

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

// Cache de config em memória (5min)
let _cfgCache = null;
let _cfgCacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Status de elegibilidade padronizados (conforme estudo)
const ELIGIBILITY = {
  ELIGIBLE_NOW: 'eligible_now',
  ELIGIBLE_WITH_TEMPLATE: 'eligible_with_template',
  BLOCKED_PERMANENT: 'blocked_permanent',
  BLOCKED_TEMPORARY: 'blocked_temporary',
  NEEDS_HUMAN_REVIEW: 'needs_human_review',
  NO_ACTIVE_CAMPAIGN: 'no_active_campaign',
};

// Tipos de contato bloqueados permanentemente para transmissão
const BLOCKED_CONTACT_TYPES = ['fornecedor', 'parceiro', 'ex_cliente'];

// Tags que bloqueiam permanentemente
const BLOCKED_TAGS = ['fornecedor', 'compras', 'colaborador', 'interno', 'optout', 'opt_out', 'pare', 'stop'];

// Setores bloqueados para transmissão
const BLOCKED_SECTORS = ['financeiro', 'compras', 'fornecedor'];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

async function carregarConfig(base44) {
  const agora = Date.now();
  if (_cfgCache && agora - _cfgCacheAt < CACHE_TTL_MS) return _cfgCache;

  const lista = await base44.asServiceRole.entities.BroadcastConfig
    .filter({ nome_config: 'default', ativo: true }).catch(() => []);
  const c = lista?.[0];

  _cfgCache = {
    horario_inicio: c?.horario_inicio ?? 8,
    horario_fim: c?.horario_fim ?? 20,
    almoco_inicio: c?.horario_almoco_inicio ?? 12,
    almoco_fim: c?.horario_almoco_fim ?? 13.5,
    enviar_fim_semana: c?.enviar_fim_semana === true,
    feriados_extras: Array.isArray(c?.feriados_extras) ? c.feriados_extras : [],
    feriados_fixos: Array.isArray(c?.feriados_nacionais_fixos) ? c.feriados_nacionais_fixos : [],
    // Cooldowns
    cooldown_universal_ms: (c?.gap_promo_fora_horario_horas ?? 12) * 60 * 60 * 1000,
    cooldown_eventual_ms: 48 * 60 * 60 * 1000,
    // Limites por lote
    limite_por_execucao: 50,
    delay_entre_envios_ms: (c?.delay_min_segundos ?? 4) * 1000,
    // Limites por bucket de inatividade (pacing por temperatura)
    // Buckets mais frios = volume menor por execução (mais risco com Meta)
    limite_por_bucket: {
      ativo: 50,        // ≤7d  — janela quente
      morno: 30,        // ≤30d — ainda contextual
      esfriando: 15,    // ≤60d — reativação inicial
      reativacao: 8,    // ≤90d — reativação forte (precisa template)
      perdido: 3,       // >90d — muito frio, mínimo
    },
    // Meta / WhatsApp
    janela_meta_horas: 24,
  };
  _cfgCacheAt = agora;
  return _cfgCache;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE HORÁRIO
// ─────────────────────────────────────────────────────────────────────────────

function dentroDaJanelaComercial(cfg) {
  const brt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dow = brt.getDay();
  if (!cfg.enviar_fim_semana && (dow === 0 || dow === 6)) return false;

  const mm = String(brt.getMonth() + 1).padStart(2, '0');
  const dd = String(brt.getDate()).padStart(2, '0');
  const yyyy = brt.getFullYear();
  const mmdd = `${mm}-${dd}`;
  const iso = `${yyyy}-${mm}-${dd}`;
  if (cfg.feriados_fixos.includes(mmdd) || cfg.feriados_extras.includes(iso)) return false;

  const min = brt.getHours() * 60 + brt.getMinutes();
  const m = (h) => Math.round(h * 60);
  const manha = min >= m(cfg.horario_inicio) && min < m(cfg.almoco_inicio);
  const tarde = min >= m(cfg.almoco_fim) && min < m(cfg.horario_fim);
  return manha || tarde;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMADA 2 — DRY-RUN / ELEGIBILIDADE (pré-filtro de pacing)
//
// IMPORTANTE (Fase 2 — Sprint 2): esta função NÃO é a fonte de verdade.
// O motor `enviarPromocao` aplica TODAS estas regras novamente antes de enviar
// (com locks distribuídos, atualizações atômicas e auditoria em PromotionDispatchLog).
//
// Aqui, a pré-validação serve a 3 propósitos legítimos:
//   1. Pacing — evita gastar 1 chamada do motor por contato obviamente bloqueado
//      (opt-out, tag, tipo proibido) em listas grandes (50-200 contatos por ciclo)
//   2. Bucketing — produz `legitimacy_tier` e `relationshipState` usados nos logs
//   3. Skip silencioso de `human_active` (não polui PromotionDispatchLog)
//
// Se o motor mudar uma regra (ex: novo bloqueio), esta função pode ficar
// desatualizada SEM quebrar nada — o motor sempre tem a palavra final.
// ─────────────────────────────────────────────────────────────────────────────

async function avaliarElegibilidade(base44, { contact, thread, cfg, integracoes }) {
  const agora = Date.now();

  // BLOQUEIO PERMANENTE: opt-out
  if (contact.whatsapp_optin === false) {
    return { status: ELIGIBILITY.BLOCKED_PERMANENT, motivo: 'opt_out' };
  }

  // BLOQUEIO PERMANENTE: tipo de contato proibido
  if (BLOCKED_CONTACT_TYPES.includes(contact.tipo_contato)) {
    return { status: ELIGIBILITY.BLOCKED_PERMANENT, motivo: 'blocked_contact_type_' + contact.tipo_contato };
  }

  // BLOQUEIO PERMANENTE: tags proibidas
  const tags = Array.isArray(contact.tags) ? contact.tags : [];
  const tagBloqueada = tags.find(t => BLOCKED_TAGS.includes((t || '').toLowerCase()));
  if (tagBloqueada) {
    return { status: ELIGIBILITY.BLOCKED_PERMANENT, motivo: 'blocked_tag_' + tagBloqueada };
  }

  // BLOQUEIO PERMANENTE: contato bloqueado
  if (contact.bloqueado) {
    return { status: ELIGIBILITY.BLOCKED_PERMANENT, motivo: 'contact_blocked' };
  }

  // BLOQUEIO PERMANENTE: WhatsApp inválido
  if (contact.whatsapp_status === 'invalido' || contact.whatsapp_status === 'bloqueado') {
    return { status: ELIGIBILITY.BLOCKED_PERMANENT, motivo: 'whatsapp_' + contact.whatsapp_status };
  }

  // BLOQUEIO POR POLÍTICA: setor bloqueado na thread
  if (thread && BLOCKED_SECTORS.includes(thread.sector_id)) {
    return { status: ELIGIBILITY.BLOCKED_PERMANENT, motivo: 'blocked_sector_' + thread.sector_id };
  }

  // BLOQUEIO POR CANAL: integração financeira/cobrança
  if (thread?.whatsapp_integration_id) {
    const integ = integracoes.find(i => i.id === thread.whatsapp_integration_id);
    if (integ) {
      const setoresInteg = Array.isArray(integ.setores_atendidos) ? integ.setores_atendidos : [];
      if (setoresInteg.includes('financeiro') || integ.setor_principal === 'financeiro') {
        return { status: ELIGIBILITY.BLOCKED_PERMANENT, motivo: 'blocked_integration_financial' };
      }
      // Integração pausada por rate-limit/bloqueio
      if (['erro_conexao', 'token_invalido'].includes(integ.status)) {
        return { status: ELIGIBILITY.BLOCKED_TEMPORARY, motivo: 'integration_paused_' + integ.status };
      }
      // SAÚDE DE INTEGRAÇÃO: proporção outbound/inbound desbalanceada (sinal de spam para Meta)
      const stats = integ.estatisticas || {};
      const out = stats.total_mensagens_enviadas || 0;
      const inb = stats.total_mensagens_recebidas || 0;
      if (out > 500 && inb > 0 && (out / inb) > 5) {
        return { status: ELIGIBILITY.BLOCKED_TEMPORARY, motivo: 'integration_outbound_ratio_high' };
      }
    }
  }

  // RECIPROCIDADE HISTÓRICA: bloqueia base totalmente fria sem histórico de relação
  // (contato com 0 mensagens trocadas E não-cliente conhecido)
  const totalMsgs = thread?.total_mensagens || 0;
  const tipoConhecido = ['cliente', 'lead'].includes(contact.tipo_contato);
  if (totalMsgs < 2 && !tipoConhecido) {
    return { status: ELIGIBILITY.NEEDS_HUMAN_REVIEW, motivo: 'no_reciprocity_history' };
  }

  // REVISÃO HUMANA: atendente humano ativo na conversa
  if (thread) {
    const doisMinAtras = new Date(agora - 2 * 60 * 1000).toISOString();
    const ultimaMsg = await base44.asServiceRole.entities.Message.filter({
      thread_id: thread.id,
      sender_type: 'user',
      'metadata.is_ack': { $ne: true },
      'metadata.is_ai_response': { $ne: true },
      created_date: { $gte: doisMinAtras }
    }, '-created_date', 1).catch(() => []);

    if (ultimaMsg.length > 0) {
      return { status: ELIGIBILITY.NEEDS_HUMAN_REVIEW, motivo: 'human_active' };
    }
  }

  // COOLDOWN UNIVERSAL: 12h entre qualquer promoção
  const lastAny = contact.last_any_promo_sent_at || thread?.last_any_promo_sent_at;
  if (lastAny) {
    const cooldown = contact.tipo_contato === 'eventual' ? cfg.cooldown_eventual_ms : cfg.cooldown_universal_ms;
    if (agora - new Date(lastAny).getTime() < cooldown) {
      return { status: ELIGIBILITY.BLOCKED_TEMPORARY, motivo: 'cooldown_universal' };
    }
  }

  // P1 — SILENT SUPPRESSION: contato em supressão silenciosa (decidido pelo sistema)
  if (contact.suppressed_until) {
    const suppressedUntilMs = new Date(contact.suppressed_until).getTime();
    if (agora < suppressedUntilMs) {
      return { status: ELIGIBILITY.BLOCKED_TEMPORARY, motivo: 'silent_suppression' };
    }
  }

  // P0 — FADIGA DE CONTATO: streak de promoções ignoradas
  // Reset implícito: se o contato respondeu DEPOIS da última promo, ignora o streak.
  const streak = contact.outbound_streak_sem_resposta || 0;
  const lastInboundMs = thread?.last_inbound_at ? new Date(thread.last_inbound_at).getTime() : 0;
  const lastAnyPromoMs = lastAny ? new Date(lastAny).getTime() : 0;
  const respondeuAposUltimaPromo = lastInboundMs > lastAnyPromoMs && lastAnyPromoMs > 0;

  if (!respondeuAposUltimaPromo && streak >= 3) {
    // Ativa supressão silenciosa: 60 dias sem novas promoções
    const supressaoAte = new Date(agora + 60 * 24 * 60 * 60 * 1000).toISOString();
    await base44.asServiceRole.entities.Contact.update(contact.id, {
      suppressed_until: supressaoAte
    }).catch(() => null);
    return { status: ELIGIBILITY.BLOCKED_TEMPORARY, motivo: `fatigue_streak_${streak}_auto_suppressed_60d` };
  }

  // JANELA META 24H + classificação de legitimidade (rótulo derivado, custo zero)
  let horasDesdeInbound = null;
  let legitimacyTier = 'unknown';
  if (thread?.last_inbound_at) {
    horasDesdeInbound = (agora - new Date(thread.last_inbound_at).getTime()) / (60 * 60 * 1000);
    if (horasDesdeInbound <= 24) legitimacyTier = 'contextual_window';
    else if (horasDesdeInbound <= 168) legitimacyTier = 'recent_followup';      // até 7d
    else if (horasDesdeInbound <= 336) legitimacyTier = 'warm_reactivation';     // até 14d
    else legitimacyTier = 'cold_reactivation';

    if (horasDesdeInbound > cfg.janela_meta_horas) {
      return {
        status: ELIGIBILITY.ELIGIBLE_WITH_TEMPLATE,
        motivo: 'window_expired_' + Math.round(horasDesdeInbound) + 'h',
        legitimacy_tier: legitimacyTier
      };
    }
  }

  return { status: ELIGIBILITY.ELIGIBLE_NOW, motivo: 'all_checks_passed', legitimacy_tier: legitimacyTier };
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMADA 1 — SELEÇÃO DE PÚBLICO
// Cada tipo de lista tem sua própria lógica de filtro
// ─────────────────────────────────────────────────────────────────────────────

async function selecionarPublicoUrgentes(base44, cfg) {
  // Contatos urgentes: threads com last_inbound_at entre 48h e 14 dias atrás
  // E que ainda NÃO foram respondidas (last_outbound_at < last_inbound_at OU sem outbound)
  const agora = new Date();
  const limite48h = new Date(agora.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const limite14d = new Date(agora.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Query mais ampla (sem $exists), filtro fino em memória
  const brutas = await base44.asServiceRole.entities.MessageThread.filter({
    thread_type: 'contact_external',
    status: 'aberta',
    last_inbound_at: { $gte: limite14d, $lte: limite48h }
  }, '-last_inbound_at', cfg.limite_por_execucao * 3).catch(() => []);

  const threads = brutas.filter(t => {
    // Precisa ter contato vinculado
    if (!t.contact_id) return false;
    // Precisa NÃO ter sido respondida depois do inbound
    if (t.last_outbound_at && t.last_inbound_at) {
      if (new Date(t.last_outbound_at) > new Date(t.last_inbound_at)) return false;
    }
    return true;
  }).slice(0, cfg.limite_por_execucao);

  console.log(`[SKILL-PROMO] 📋 Urgentes: ${brutas.length} brutas → ${threads.length} elegíveis (após filtro de resposta)`);
  return threads;
}

async function selecionarPublicoCustom(base44, listaConfig, cfg) {
  // Lista customizada com filtros configuráveis
  // Filtros de Contact (tipo, tags) são aplicados em memória após carregar contatos
  const filtros = listaConfig.filtros || {};
  const query = { thread_type: 'contact_external', status: 'aberta' };

  if (filtros.dias_sem_resposta_min) {
    const limite = new Date(Date.now() - filtros.dias_sem_resposta_min * 24 * 60 * 60 * 1000).toISOString();
    query['last_inbound_at'] = { $lte: limite };
  }

  const brutas = await base44.asServiceRole.entities.MessageThread.filter(
    query, '-last_inbound_at', cfg.limite_por_execucao * 3
  ).catch(() => []);

  // Filtro em memória: tem contact_id + não foi respondida
  const threads = brutas.filter(t => {
    if (!t.contact_id) return false;
    if (t.last_outbound_at && t.last_inbound_at) {
      if (new Date(t.last_outbound_at) > new Date(t.last_inbound_at)) return false;
    }
    return true;
  }).slice(0, cfg.limite_por_execucao);

  console.log(`[SKILL-PROMO] 📋 Lista "${listaConfig.nome}": ${brutas.length} brutas → ${threads.length} elegíveis`);
  // Anexa filtros de contato para aplicação posterior no loop principal
  threads._filtrosContato = {
    tipo_contato: filtros.tipo_contato || null,
    tags: filtros.tags || null
  };
  return threads;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: selecionar melhor promoção para contato
// ─────────────────────────────────────────────────────────────────────────────

async function selecionarPromocao(base44, { contact, thread, stage, eligibilityStatus }) {
  const hojeIso = new Date().toISOString().split('T')[0];
  const lastPromoIds = Array.isArray(contact.last_promo_ids) ? contact.last_promo_ids : [];
  const tipoContato = contact.tipo_contato || 'novo';

  const promos = await base44.asServiceRole.entities.Promotion.filter(
    { ativo: true }, '-priority', 50
  ).catch(() => []);

  const elegiveis = promos.filter(p => {
    if (p.validade && p.validade < hojeIso) return false;
    if (lastPromoIds.includes(p.id)) return false;
    if (p.stage && stage && p.stage !== stage) return false;

    // Para eligible_with_template: precisa ter template_name
    if (eligibilityStatus === ELIGIBILITY.ELIGIBLE_WITH_TEMPLATE && !p.whatsapp_template_name) return false;

    const targetTypes = Array.isArray(p.target_contact_types) ? p.target_contact_types : ['lead', 'cliente'];
    if (!targetTypes.includes(tipoContato)) return false;

    // Limite de envios por contato
    const enviados = p.promocoes_recebidas?.[p.id] || contact.promocoes_recebidas?.[p.id] || 0;
    if (p.limite_envios_por_contato && enviados >= p.limite_envios_por_contato) return false;

    return true;
  });

  if (elegiveis.length === 0) return null;
  return elegiveis[0]; // já ordenado por priority
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: gravar PromotionDispatchLog
// ─────────────────────────────────────────────────────────────────────────────

async function gravarDispatchLog(base44, {
  trigger, promotion_id, promotion_titulo, contact_id, contact_nome,
  thread_id, integration_id, campaign_id, status, bloqueio_motivo,
  erro_mensagem, message_id, mensagem_enviada, tem_midia, initiated_by, metadata
}) {
  return base44.asServiceRole.entities.PromotionDispatchLog.create({
    trigger, promotion_id, promotion_titulo,
    contact_id, contact_nome,
    thread_id, integration_id, campaign_id,
    status, bloqueio_motivo, erro_mensagem,
    message_id, mensagem_enviada,
    tem_midia: !!tem_midia,
    initiated_by: initiated_by || 'skill_promocoes',
    metadata: metadata || {}
  }).catch(e => {
    console.warn('[SKILL-PROMO] ⚠️ Falha ao gravar DispatchLog:', e.message);
    return null;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMADA 3 — ENVIO (delega ao motor central enviarPromocao)
// ─────────────────────────────────────────────────────────────────────────────

async function processarEnvio(base44, { thread, contact, promo, trigger, campaign_id, cfg }) {
  try {
    const resposta = await base44.asServiceRole.functions.invoke('enviarPromocao', {
      contact_id: contact.id,
      thread_id: thread.id,
      promotion_id: promo.id,
      trigger,
      campaign_id,
      integration_id: thread.whatsapp_integration_id,
      dry_run: false
    });

    const data = resposta?.data || resposta;

    if (data?.success && data?.enviada) {
      return {
        ok: true,
        status: 'enviada',
        message_id: data.message_id || null,                          // ID interno do Message
        whatsapp_message_id: data.whatsapp_message_id || null,        // ID externo do provedor
        mensagem_enviada: data.mensagem_enviada || null
      };
    }

    if (data?.bloqueada) {
      return {
        ok: false,
        status: 'bloqueada',
        motivo: data.motivo || data.bloqueio_motivo || 'motor_bloqueou'
      };
    }

    return { ok: false, status: 'erro', motivo: data?.error || 'resposta_invalida' };

  } catch (e) {
    return { ok: false, status: 'erro', motivo: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const tsInicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const payload = await req.json();

    // ═══════════════════════════════════════════════════════════════════
    // CONTRATO ÚNICO (Fase 1 — Caminho B): sugerirOuEnviar
    // Porta de entrada única para o pré-atendimento e outros chamadores.
    // Delega ao motor enviarPromocao (mensagem separada — não anexa ao ACK).
    // Idempotente, não-bloqueante: se falhar, retorna { sent: false } sem
    // derrubar o chamador.
    // ═══════════════════════════════════════════════════════════════════
    if (payload.action === 'sugerir_ou_enviar') {
      const {
        origem = 'manual',          // 'pre_atendimento' | 'cron_inbound' | 'cron_batch' | 'manual'
        contexto = null,             // 'fora_horario' | 'primeiro_contato_dia' | 'reativacao' | null
        contact_id,
        thread_id = null,
        integration_id = null,
        intent = null,               // opcional, ajuda na seleção futura
        dry_run = false,
        initiated_by = null
      } = payload;

      if (!contact_id) {
        return Response.json({ success: false, error: 'contact_id obrigatório' }, { status: 400, headers });
      }

      // Mapear contexto → trigger do motor
      const triggerMap = {
        'fora_horario': 'inbound_6h',
        'primeiro_contato_dia': 'inbound_6h',
        'reativacao': 'batch_36h'
      };
      const trigger = triggerMap[contexto] || 'manual_individual';

      // Dry-run não envia: usa motor com flag para apenas validar
      if (dry_run) {
        return Response.json({
          success: true,
          dry_run: true,
          tipo: 'preview',
          origem,
          contexto,
          contact_id,
          thread_id
        }, { headers });
      }

      // Delega ao motor único — envio em mensagem separada
      try {
        const resp = await base44.asServiceRole.functions.invoke('enviarPromocao', {
          contact_id,
          thread_id,
          integration_id,
          trigger,
          initiated_by: initiated_by || `skillPromocoes:${origem}`,
          campaign_id: contexto ? `${origem}_${contexto}` : null
        });

        const data = resp?.data || {};

        return Response.json({
          success: !!data.success,
          sent: data.status === 'enviada',
          status: data.status || 'erro',
          motivo: data.reason || data.bloqueio_motivo || null,
          promotion_id: data.promotion_id || null,
          promotion_titulo: data.promotion_titulo || null,
          message_id: data.message_id || null,
          origem,
          contexto,
          trigger
        }, { headers });
      } catch (e) {
        console.warn('[SKILL-PROMO sugerir_ou_enviar] erro não-bloqueante:', e.message);
        return Response.json({
          success: false,
          sent: false,
          status: 'erro',
          error: e.message,
          origem,
          contexto
        }, { headers });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // FLUXO LEGADO — disparo em lote (listas urgentes/customizadas)
    // ═══════════════════════════════════════════════════════════════════
    const {
      lista_tipo = 'urgentes',   // 'urgentes' | id de PromotionList
      lista_config = null,        // config customizada se lista_tipo != 'urgentes'
      trigger = null,             // override de trigger (inbound_6h, batch_36h, massa_manual, etc.)
      campaign_id = null,         // agrupador de campanha
      dry_run = false,            // se true: só avalia, não envia
      initiated_by = null,        // email/id do usuário disparador
    } = payload;

    const triggerFinal = trigger || (lista_tipo === 'urgentes' ? 'batch_36h' : 'manual_individual');
    const campaignFinal = campaign_id || `skill_${lista_tipo}_${new Date().toISOString().split('T')[0]}`;

    console.log(`[SKILL-PROMO] 🚀 Início — lista: ${lista_tipo} | trigger: ${triggerFinal} | dry_run: ${dry_run}`);

    // ─── CAMADA 0 — VALIDAR JANELA COMERCIAL ───────────────────────────────
    const cfg = await carregarConfig(base44);
    const dentroHorario = dentroDaJanelaComercial(cfg);

    if (!dentroHorario && lista_tipo !== 'urgentes') {
      console.log('[SKILL-PROMO] ⏸️ Fora de horário comercial — lista não-urgente adiada');
      return Response.json({
        success: false,
        skipped: true,
        motivo: 'fora_horario_comercial',
        lista_tipo,
        tempo_ms: Date.now() - tsInicio
      }, { headers });
    }

    // ─── CAMADA 1 — SELECIONAR PÚBLICO ─────────────────────────────────────
    let threads = [];
    if (lista_tipo === 'urgentes') {
      threads = await selecionarPublicoUrgentes(base44, cfg);
    } else if (lista_config) {
      threads = await selecionarPublicoCustom(base44, lista_config, cfg);
    } else {
      return Response.json({ success: false, error: 'lista_config obrigatório para lista_tipo customizado' }, { status: 400, headers });
    }

    if (threads.length === 0) {
      return Response.json({
        success: true,
        lista_tipo,
        total_encontrados: 0,
        motivo: 'nenhum_contato_encontrado',
        tempo_ms: Date.now() - tsInicio
      }, { headers });
    }

    // Carregar integrações para avaliação de elegibilidade
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list('-updated_date', 50).catch(() => []);

    // ─── CAMADAS 2+3 — ELEGIBILIDADE → ENVIO por contato ──────────────────
    const resultado = {
      lista_tipo,
      trigger: triggerFinal,
      campaign_id: campaignFinal,
      dry_run,
      total_encontrados: threads.length,
      por_status: {},
      por_bucket: { ativo: 0, morno: 0, esfriando: 0, reativacao: 0, perdido: 0, unknown: 0 },
      enviados: 0,
      bloqueados: 0,
      erros: 0,
      detalhes: [],
      tempo_ms: 0
    };

    // Contadores de envios por bucket (controle de pacing por temperatura)
    const enviadosPorBucket = { ativo: 0, morno: 0, esfriando: 0, reativacao: 0, perdido: 0, unknown: 0 };

    for (const thread of threads) {
      const itemTs = Date.now();

      // Buscar contato
      const contact = thread.contact_id
        ? await base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null)
        : null;

      if (!contact) {
        resultado.erros++;
        resultado.detalhes.push({ thread_id: thread.id, status: 'erro', motivo: 'contact_not_found' });
        continue;
      }

      // Filtros de Contact aplicados em memória (para listas customizadas)
      const filtrosContato = threads._filtrosContato;
      if (filtrosContato) {
        if (filtrosContato.tipo_contato?.length > 0 && !filtrosContato.tipo_contato.includes(contact.tipo_contato)) {
          continue;
        }
        if (filtrosContato.tags?.length > 0) {
          const tagsContato = Array.isArray(contact.tags) ? contact.tags : [];
          const temTag = filtrosContato.tags.some(t => tagsContato.includes(t));
          if (!temTag) continue;
        }
      }

      // CAMADA 2: Dry-run de elegibilidade
      const eligibility = await avaliarElegibilidade(base44, { contact, thread, cfg, integracoes });

      // Acumular por status
      resultado.por_status[eligibility.status] = (resultado.por_status[eligibility.status] || 0) + 1;

      // Bloqueios permanentes/temporários: loga e segue
      if ([ELIGIBILITY.BLOCKED_PERMANENT, ELIGIBILITY.BLOCKED_TEMPORARY].includes(eligibility.status)) {
        resultado.bloqueados++;
        await gravarDispatchLog(base44, {
          trigger: triggerFinal,
          promotion_id: null,
          promotion_titulo: null,
          contact_id: contact.id,
          contact_nome: contact.nome,
          thread_id: thread.id,
          campaign_id: campaignFinal,
          status: 'bloqueada',
          bloqueio_motivo: eligibility.motivo,
          initiated_by: initiated_by || user?.email || 'skill_promocoes',
          metadata: { eligibility_status: eligibility.status, dry_run }
        });
        resultado.detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          status: eligibility.status,
          motivo: eligibility.motivo
        });
        continue;
      }

      // Revisão humana: skip silencioso
      if (eligibility.status === ELIGIBILITY.NEEDS_HUMAN_REVIEW) {
        resultado.bloqueados++;
        resultado.detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          status: ELIGIBILITY.NEEDS_HUMAN_REVIEW,
          motivo: eligibility.motivo
        });
        continue;
      }

      // Estado de relacionamento derivado do tempo de inatividade (rótulo + bucket stage)
      let diasInatividade = null;
      let relationshipState = 'unknown';
      let stageDerivado = null;
      if (thread?.last_inbound_at) {
        diasInatividade = Math.floor((Date.now() - new Date(thread.last_inbound_at).getTime()) / (24 * 60 * 60 * 1000));
        if (diasInatividade <= 7) { relationshipState = 'ativo'; stageDerivado = '6h'; }
        else if (diasInatividade <= 30) { relationshipState = 'morno'; stageDerivado = '36h'; }
        else if (diasInatividade <= 60) { relationshipState = 'esfriando'; stageDerivado = '60d'; }
        else if (diasInatividade <= 90) { relationshipState = 'reativacao'; stageDerivado = '90d'; }
        else { relationshipState = 'perdido'; stageDerivado = '120d'; }
      }
      resultado.por_bucket[relationshipState] = (resultado.por_bucket[relationshipState] || 0) + 1;

      // GUARD: limite por bucket de inatividade (pacing por temperatura — proteção Meta)
      const limiteBucket = cfg.limite_por_bucket?.[relationshipState] ?? cfg.limite_por_execucao;
      if (enviadosPorBucket[relationshipState] >= limiteBucket) {
        resultado.bloqueados++;
        resultado.detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          status: 'bloqueada',
          motivo: `bucket_limit_reached_${relationshipState}_${limiteBucket}`,
          bucket: relationshipState
        });
        continue;
      }

      // GUARD: buckets frios (esfriando/reativacao/perdido) DEVEM usar template (compliance Meta 24h)
      // Regra acordada: 60d+ sem inbound = exigir whatsapp_template_name.
      const bucketsQueExigemTemplate = ['esfriando', 'reativacao', 'perdido'];
      const exigeTemplate = bucketsQueExigemTemplate.includes(relationshipState)
        || eligibility.status === ELIGIBILITY.ELIGIBLE_WITH_TEMPLATE;

      // Classificação de qualification_type (derivado, custo zero — para análise)
      let qualificationType = 'unknown';
      if (contact.tipo_contato === 'lead') qualificationType = 'lead_qualificacao';
      else if (contact.tipo_contato === 'cliente') qualificationType = 'cliente_reativacao';
      else if (contact.tipo_contato === 'eventual') qualificationType = 'oportunidade_followup';

      // Selecionar promoção: stage explícito da listaConfig > stage derivado > fallback 36h
      let stage = lista_config?.stage || stageDerivado || (lista_tipo === 'urgentes' ? '36h' : null);
      // Se exige template, força o motor a só aceitar promoções com whatsapp_template_name
      const eligStatusParaSelecao = exigeTemplate ? ELIGIBILITY.ELIGIBLE_WITH_TEMPLATE : eligibility.status;
      let promo = await selecionarPromocao(base44, {
        contact, thread, stage,
        eligibilityStatus: eligStatusParaSelecao
      });

      // Fallback: se não encontrou promoção para o stage derivado, tenta '36h' (genérico)
      if (!promo && stage !== '36h' && lista_tipo === 'urgentes') {
        stage = '36h';
        promo = await selecionarPromocao(base44, {
          contact, thread, stage,
          eligibilityStatus: eligStatusParaSelecao
        });
      }

      if (!promo) {
        resultado.por_status[ELIGIBILITY.NO_ACTIVE_CAMPAIGN] = (resultado.por_status[ELIGIBILITY.NO_ACTIVE_CAMPAIGN] || 0) + 1;
        await gravarDispatchLog(base44, {
          trigger: triggerFinal,
          promotion_id: null,
          promotion_titulo: null,
          contact_id: contact.id,
          contact_nome: contact.nome,
          thread_id: thread.id,
          campaign_id: campaignFinal,
          status: 'bloqueada',
          bloqueio_motivo: 'no_active_campaign',
          initiated_by: initiated_by || user?.email || 'skill_promocoes',
          metadata: { eligibility_status: eligibility.status, stage, dry_run }
        });
        resultado.detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          status: ELIGIBILITY.NO_ACTIVE_CAMPAIGN,
          motivo: `sem_promocao_para_stage_${stage}`
        });
        continue;
      }

      // DRY-RUN: só classifica, não envia
      if (dry_run) {
        resultado.detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          status: eligibility.status,
          eligibility_motivo: eligibility.motivo,
          promo_selecionada: promo.titulo,
          dry_run: true
        });
        continue;
      }

      // CAMADA 3: Envio
      const envio = await processarEnvio(base44, {
        thread, contact, promo,
        trigger: triggerFinal,
        campaign_id: campaignFinal,
        cfg
      });

      // CAMADA 4: Auditoria — message_id (interno) vs whatsapp_message_id (externo, em metadata)
      await gravarDispatchLog(base44, {
        trigger: triggerFinal,
        promotion_id: promo.id,
        promotion_titulo: promo.titulo,
        contact_id: contact.id,
        contact_nome: contact.nome,
        thread_id: thread.id,
        integration_id: thread.whatsapp_integration_id,
        campaign_id: campaignFinal,
        status: envio.status,
        bloqueio_motivo: envio.motivo || null,
        erro_mensagem: envio.status === 'erro' ? envio.motivo : null,
        message_id: envio.message_id || null,
        mensagem_enviada: envio.mensagem_enviada || null,
        tem_midia: !!promo.imagem_url,
        initiated_by: initiated_by || user?.email || 'skill_promocoes',
        metadata: {
          eligibility_status: eligibility.status,
          eligibility_motivo: eligibility.motivo,
          legitimacy_tier: eligibility.legitimacy_tier || 'unknown',
          relationship_state: relationshipState,
          dias_inatividade: diasInatividade,
          stage_solicitado: stage,
          promo_stage: promo.stage,
          // Camada conversacional (3 rótulos derivados, custo zero)
          strategy_type: 'reactivation',
          qualification_type: qualificationType,
          bucket_inactive: relationshipState,
          forced_template: exigeTemplate,
          whatsapp_message_id: envio.whatsapp_message_id || null,
          tempo_item_ms: Date.now() - itemTs
        }
      });

      if (envio.ok) {
        resultado.enviados++;
        enviadosPorBucket[relationshipState] = (enviadosPorBucket[relationshipState] || 0) + 1;
        resultado.detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          status: 'enviada',
          promo: promo.titulo,
          bucket: relationshipState,
          qualification_type: qualificationType,
          message_id: envio.message_id
        });
      } else {
        if (envio.status === 'bloqueada') resultado.bloqueados++;
        else resultado.erros++;
        resultado.detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          status: envio.status,
          motivo: envio.motivo
        });
      }

      // Delay entre envios para evitar rate-limit
      if (cfg.delay_entre_envios_ms > 0) {
        await new Promise(r => setTimeout(r, cfg.delay_entre_envios_ms));
      }
    }

    resultado.tempo_ms = Date.now() - tsInicio;

    console.log(`[SKILL-PROMO] ✅ Finalizado — enviados: ${resultado.enviados} | bloqueados: ${resultado.bloqueados} | erros: ${resultado.erros} | tempo: ${resultado.tempo_ms}ms`);

    return Response.json({ success: true, ...resultado }, { headers });

  } catch (error) {
    console.error('[SKILL-PROMO] ❌ Erro fatal:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});