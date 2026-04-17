// ============================================================================
// primeiroAtendimentoUnificado.js — v1.0
// ============================================================================
// UMA ÚNICA FUNÇÃO que substitui em camadas:
//   preAtendimentoHandler + skillACKImediato + skillIntentRouter
//   + roteamentoInteligente + skillPrimeiroContatoAutonomo
//
// CAMADAS (sequenciais dentro do mesmo processo — sem HTTP entre elas):
//   0 — Dedup / idempotency guard  (bloqueia webhooks duplicados em paralelo)
//   1 — ACK imediato               (fire & forget — falha NÃO para o pipeline)
//   2 — Intent detection           (pattern match → LLM fallback)
//   3 — Roteamento                 (fidelizado → menor carga → fila)
//   4 — Atribuição + boas-vindas   (update thread + envia mensagem + loga)
//
// FILOSOFIA:
//   - Nenhuma camada faz fetch HTTP para outra função Base44
//   - Cada camada tem try/catch próprio — falha isolada, não cascata
//   - Dedup atômico elimina race conditions de webhooks duplicados
//   - Resultado de cada camada gravado em AutomationLog para observabilidade
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const COOLDOWN_MS = 300_000;   // 5 min entre ACKs
const DEDUP_WINDOW_MS = 30_000; // 30s janela de dedup de webhooks

const PATTERNS = [
  { regex: /pc\s*gam|gam(er|ing)|notebook|computador|placa\s*de\s*v|rtx|processador|ram|ssd|cpu|impressora|monitor|teclado|mouse|headset|fonte|gabinete|cooler|hardware|orcamento|cotacao|preco|quanto\s*custa|comprar|produto|estoque|disponib/i, setor: 'vendas', intencao: 'compra_produto', confidence: 0.95 },
  { regex: /boleto|fatura|nota\s*fiscal|2[aa]\s*via|pagamento|vencimento|cobranca|debito|credito|parcelar|financ/i, setor: 'financeiro', intencao: 'consulta_financeira', confidence: 0.95 },
  { regex: /defeito|quebrou|nao\s*liga|nao\s*funciona|conserto|reparo|assistencia|garantia|suporte\s*tec|problema|travando|lento|reiniciando|cabo\s*de\s*internet|wifi|conexao|internet\s*caiu|nao\s*conecta|rede|modem|roteador/i, setor: 'assistencia', intencao: 'suporte_tecnico', confidence: 0.95 },
  { regex: /fornec|distribu|atacado|revend|parceria|comercial|representante|catalogo|lista\s*de\s*preco/i, setor: 'fornecedor', intencao: 'parceria_comercial', confidence: 0.90 },
  // Saudações genéricas — evita LLM para "oi", "olá", "bom dia" etc (reduz latência ~10s → ~500ms)
  { regex: /^(oi|ola|olá|bom\s*dia|boa\s*tarde|boa\s*noite|hello|tudo\s*bem|alo|alô)[\s!?.]*$/i, setor: 'vendas', intencao: 'saudacao_generica', confidence: 0.80 },
];

const SETOR_DEFAULT = 'vendas';
const HORA_INICIO = 8;
const HORA_FIM = 18;

// ─────────────────────────────────────────────────────────────────────────────
// CAMADA 0 — MICRO-INTENTS (saudação pura / agradecimento / mídia / spam)
// Detecta padrões simples que NÃO precisam de ACK genérico + Intent + Routing
// Responde contextualmente no estilo do atendente dono da thread (se houver)
// ─────────────────────────────────────────────────────────────────────────────

const MICRO_INTENT_PATTERNS = {
  saudacao_pura: /^(oi+|ol[aá]+|e?a[ei]+|hello|hi|tudo\s*bem\??|bom\s*di[aã]+|boa\s*tard[eé]+|boa\s*noit[eé]+|al[ôo]+)[\s!?.😊🙂👋]*$/i,
  agradecimento: /^(obrigad[oa]+|obg|vlw|valeu+|ok+|blz|beleza|certo|perfeito|entendi|show|top|\u00f3timo|otimo|combinado|fechado|t[aá]\s*bom|tudo\s*bem)[\s!?.😊🙏👍👌]*$/i,
  confirmacao_curta: /^(sim|isso|exato|pode\s*ser|correto|confirmo|afirmativo|positivo)[\s!?.]*$/i,
  spam_prospec: /(vi\s+seu\s+cadastro|proposta\s+para\s+ti|reduzir\s+custos|oportunidade\s+\u00fanica|sua\s+empresa\s+foi\s+selecionad|1\s*min(uto)?\s+para\s+apresentar|teria\s+1\s*min|captamos\s+seu\s+contato)/i,
};

function detectarMicroIntent(texto, temMidia) {
  const t = (texto || '').trim();
  
  // Mídia sem texto relevante
  if (temMidia && t.length < 3) return { tipo: 'midia_pura', texto: t };
  
  if (!t) return null;
  if (t.length > 80) return null; // micro-intents são sempre curtos
  
  if (MICRO_INTENT_PATTERNS.agradecimento.test(t)) return { tipo: 'agradecimento', texto: t };
  if (MICRO_INTENT_PATTERNS.saudacao_pura.test(t)) return { tipo: 'saudacao_pura', texto: t };
  if (MICRO_INTENT_PATTERNS.confirmacao_curta.test(t)) return { tipo: 'confirmacao_curta', texto: t };
  if (MICRO_INTENT_PATTERNS.spam_prospec.test(t)) return { tipo: 'spam_prospec', texto: t };
  
  return null;
}

function getPeriodoDia(hora) {
  if (hora < 12) return 'manha';
  if (hora < 18) return 'tarde';
  return 'noite';
}

async function buscarStyleProfile(base44, user_id) {
  if (!user_id) return null;
  try {
    const profiles = await base44.asServiceRole.entities.AtendenteStyleProfile.filter(
      { user_id, ativo: true }, '-updated_date', 1
    );
    return profiles[0] || null;
  } catch (e) {
    console.warn('[CAMADA-0] erro ao buscar style profile:', e.message);
    return null;
  }
}

function gerarRespostaMicroIntent(tipo, profile, contactNome, hora, foraHorario) {
  const primeiroNome = (contactNome || '').split(' ')[0] || '';
  const assinatura = profile?.assinatura ? `\n\n${profile.assinatura}` : '';
  const chamaPeloNome = profile?.style_features?.chama_pelo_nome && primeiroNome;
  
  if (tipo === 'saudacao_pura') {
    const periodo = getPeriodoDia(hora);
    let saudacaoEstilo = profile?.frases_saudacao_por_hora?.[periodo] || '';
    // Limpar saudação do profile: remover nomes próprios embutidos (qualquer token capitalizado),
    // perguntas tipo "tudo bem?" e pontuação terminal — mantém só o verbete puro ("Oie bom diaa")
    saudacaoEstilo = saudacaoEstilo
      .replace(/,?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+/g, '') // remove nomes próprios
      .replace(/,?\s*tudo\s*bem\??/i, '')
      .replace(/[!?.,\s]+$/, '')
      .trim();
    const base = saudacaoEstilo || (periodo === 'manha' ? 'Bom dia' : periodo === 'tarde' ? 'Boa tarde' : 'Boa noite');
    if (foraHorario) {
      return `${base}${chamaPeloNome ? ', ' + primeiroNome : ''}! Recebi sua mensagem 😊\nNosso atendimento é seg-sex ${HORA_INICIO}h-${HORA_FIM}h. Te retorno em breve!${assinatura}`;
    }
    return `${base}${chamaPeloNome ? ', ' + primeiroNome : ''}! Tudo bem?${assinatura}`;
  }
  
  if (tipo === 'agradecimento') {
    const encerramento = profile?.frases_agradecimento?.[0] || profile?.frases_encerramento?.[0];
    if (encerramento) return `${encerramento}${assinatura}`;
    return `Por nada${chamaPeloNome ? ', ' + primeiroNome : ''}! Qualquer coisa é só chamar 👋${assinatura}`;
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: montar mensagem ACK por contexto
// ─────────────────────────────────────────────────────────────────────────────

function buildAckMsg(tipo, nome, isVIP, hora) {
  const primeiroNome = (nome || '').split(' ')[0] || '';
  if (hora < HORA_INICIO || hora > HORA_FIM) {
    return { tipo: 'fora_horario', msg: `Olá! 😊\nNosso atendimento é Seg-Sex ${HORA_INICIO}h-${HORA_FIM}h.\nRetornaremos em breve!` };
  }
  if (isVIP) return { tipo: 'vip', msg: `✨ Olá ${primeiroNome}! Já recebi sua mensagem. Um momento!` };
  if (tipo === 'cliente') return { tipo: 'cliente', msg: `👋 Olá ${primeiroNome}! Recebi sua mensagem. Vou ajudar em instantes!` };
  if (tipo === 'ex_cliente') return { tipo: 'ex_cliente', msg: `Que bom ter você de volta${primeiroNome ? ', ' + primeiroNome : ''}! 😊 Vou verificar o que você precisa.` };
  if (tipo === 'fornecedor') return { tipo: 'fornecedor', msg: `🤝 Olá ${primeiroNome}! Recebi seu contato. Vou direcionar para nossa equipe de compras.` };
  return { tipo: 'novo', msg: `👋 Olá ${primeiroNome}! Recebi sua mensagem. Vou analisar e já te retorno!` };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: enviar WhatsApp (Z-API e W-API)
// ─────────────────────────────────────────────────────────────────────────────

async function enviarWhatsApp(integ, telefone, mensagem) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;

  if (integ.api_provider === 'w_api') {
    const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
      + `/message/send-text?instanceId=${integ.instance_id_provider}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integ.api_key_provider}`
      },
      body: JSON.stringify({ phone, message: mensagem, delayMessage: 1 })
    });
    const resp = await r.json();
    return { ok: !!(resp.messageId || resp.insertedId), msgId: resp.messageId || resp.insertedId || null, raw: resp };
  } else {
    const url = (integ.base_url_provider || 'https://api.z-api.io')
      + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-text`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: mensagem })
    });
    const resp = await r.json();
    return { ok: resp.success === true, msgId: resp.messageId || resp.key?.id || null, raw: resp };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: detectar nome de atendente mencionado na mensagem
// Retorna User atendente se mensagem contém "falar com João", "quero o Pedro", etc.
// ─────────────────────────────────────────────────────────────────────────────

async function detectarAtendenteMencionado(base44, texto, atendentes) {
  if (!texto || !atendentes || atendentes.length === 0) return null;

  const textoNorm = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Verbos/expressões que indicam desejo de falar com alguém específico
  const indicadoresIntencao = /\b(falar|quero|preciso|chamar|atendido|atender|procuro|procurando|com\s+o|com\s+a|o\s+|a\s+)\b/i;
  if (!indicadoresIntencao.test(textoNorm)) return null;

  // Buscar por primeiro nome de cada atendente no texto
  for (const atendente of atendentes) {
    const nomeCompleto = (atendente.display_name || atendente.full_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!nomeCompleto) continue;

    const primeiroNome = nomeCompleto.split(' ')[0];
    if (primeiroNome.length < 3) continue; // ignorar nomes muito curtos (ambiguidade)

    // Regex com word boundary para evitar falsos positivos
    const regex = new RegExp(`\\b${primeiroNome}\\b`, 'i');
    if (regex.test(textoNorm)) {
      console.log(`[UNIFICADO] 🎯 Atendente mencionado na mensagem: ${atendente.full_name}`);
      return atendente;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: último atendente que interagiu com o contato
// ─────────────────────────────────────────────────────────────────────────────

async function buscarUltimoAtendente(base44, contact_id, atendentes) {
  try {
    // Buscar últimas mensagens outbound do contato (quem respondeu por último)
    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      contact_id,
      status: { $in: ['aberta', 'fechada'] }
    }, '-last_message_at', 10).catch(() => []);

    for (const t of threads) {
      // Verificar atendentes_historico (mais confiável)
      if (Array.isArray(t.atendentes_historico) && t.atendentes_historico.length > 0) {
        const ultimoId = t.atendentes_historico[t.atendentes_historico.length - 1];
        const atendente = atendentes.find(u => u.id === ultimoId);
        if (atendente) {
          console.log(`[UNIFICADO] 👤 Último atendente (histórico): ${atendente.full_name}`);
          return atendente;
        }
      }
      // Fallback: assigned_user_id da thread mais recente
      if (t.assigned_user_id) {
        const atendente = atendentes.find(u => u.id === t.assigned_user_id);
        if (atendente) {
          console.log(`[UNIFICADO] 👤 Último atendente (assigned): ${atendente.full_name}`);
          return atendente;
        }
      }
    }
  } catch (e) {
    console.warn('[UNIFICADO] Erro ao buscar último atendente:', e.message);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: buscar atendente por setor (menor carga)
// ─────────────────────────────────────────────────────────────────────────────

async function buscarAtendentePorSetor(base44, setor, atendentes) {
  const candidatos = atendentes.filter(u => {
    if (!u.id || (!u.full_name && !u.email)) return false;
    if (setor === 'geral') return true;
    return u.attendant_sector === setor;
  });

  if (candidatos.length === 0) {
    // Fallback: buscar no setor 'geral'
    const geral = atendentes.filter(u => u.attendant_sector === 'geral' && (u.full_name || u.email));
    if (geral.length === 0) return null;
    return await rankearPorCarga(base44, geral);
  }

  return await rankearPorCarga(base44, candidatos);
}

async function rankearPorCarga(base44, candidatos) {
  if (candidatos.length === 1) return candidatos[0];

  const threadsAbertas = await base44.asServiceRole.entities.MessageThread.filter({
    status: 'aberta',
    assigned_user_id: { $in: candidatos.map(u => u.id) }
  }, '-created_date', 500).catch(() => []);

  const cargaPor = {};
  for (const t of threadsAbertas) {
    if (t.assigned_user_id) cargaPor[t.assigned_user_id] = (cargaPor[t.assigned_user_id] || 0) + 1;
  }

  const ordenados = [...candidatos].sort((a, b) => (cargaPor[a.id] || 0) - (cargaPor[b.id] || 0));
  const melhor = ordenados[0];
  console.log(`[UNIFICADO] 📊 Atendente por carga: ${melhor.full_name} (${cargaPor[melhor.id] || 0} abertas)`);
  return melhor;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: gravar AutomationLog final
// ─────────────────────────────────────────────────────────────────────────────

async function gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, status) {
  try {
    await base44.asServiceRole.entities.AutomationLog.create({
      thread_id,
      contato_id: contact_id,
      acao: 'pipeline_primeiro_atendimento',
      resultado: ['concluido', 'enfileirado'].includes(status) ? 'sucesso' : 'erro',
      origem: 'sistema',
      timestamp: new Date().toISOString(),
      detalhes: {
        tempo_execucao_ms: Date.now() - tsInicio,
        camadas: resultado.camadas,
        status_final: status
      }
    });
  } catch (e) {
    console.warn('[UNIFICADO] Falha ao gravar log final:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const tsInicio = Date.now();
  const resultado = {
    success: false,
    camadas: {
      dedup: null,
      ack: null,
      intent: null,
      routing: null,
      atribuicao: null,
    }
  };

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { thread_id, contact_id, integration_id, message_id, message_content } = payload;

    if (!thread_id || !contact_id) {
      return Response.json({ success: false, error: 'Campos obrigatorios: thread_id, contact_id' }, { status: 400, headers });
    }

    console.log(`[UNIFICADO] 🚀 Início pipeline — thread: ${thread_id}`);

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 0 — DEDUP / IDEMPOTENCY GUARD
    // ═══════════════════════════════════════════════════════════════════

    let thread = null;
    let contact = null;
    let integ = null;

    try {
      thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);

      // Guard 1: já atribuída?
      if (thread.assigned_user_id && thread.routing_stage === 'ASSIGNED') {
        resultado.camadas.dedup = { skipped: true, reason: 'ja_atribuida' };
        console.log('[UNIFICADO] ⏭️ Thread já atribuída — skip');
        return Response.json({ ...resultado, success: true, skipped: true, reason: 'ja_atribuida' }, { headers });
      }

      // Guard 2: pipeline recente? (dedup de 30s)
      const dedupWindow = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
      const execRecente = await base44.asServiceRole.entities.AutomationLog.filter({
        thread_id,
        acao: 'pipeline_atendimento_iniciado',
        timestamp: { $gte: dedupWindow }
      }, '-timestamp', 1).catch(() => []);

      if (execRecente.length > 0) {
        resultado.camadas.dedup = { skipped: true, reason: 'pipeline_recente_30s' };
        console.log('[UNIFICADO] ⏭️ Pipeline recente detectado — dedup ativo');
        return Response.json({ ...resultado, success: true, skipped: true, reason: 'pipeline_recente' }, { headers });
      }

      // Gravar lock de execução
      await base44.asServiceRole.entities.AutomationLog.create({
        thread_id,
        contato_id: contact_id,
        acao: 'pipeline_atendimento_iniciado',
        resultado: 'em_progresso',
        origem: 'sistema',
        timestamp: new Date().toISOString(),
        detalhes: { message_id, camada: 'dedup_lock' }
      }).catch(() => {});

      resultado.camadas.dedup = { ok: true };
      console.log('[UNIFICADO] ✅ Camada 0 OK — dedup passou');

    } catch (e) {
      console.error('[UNIFICADO] Camada 0 erro:', e.message);
      resultado.camadas.dedup = { error: e.message };
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 0-MICRO — MICRO-INTENTS (saudação/agradecimento/spam/mídia)
    // Early-return se detecta intent simples com atendente já atribuído
    // ═══════════════════════════════════════════════════════════════════

    try {
      const textoMicro = (message_content || thread?.last_message_content || '').trim();
      const mediaType = payload.media_type || null;
      const temMidia = mediaType && mediaType !== 'none' && mediaType !== 'text';
      const microIntent = detectarMicroIntent(textoMicro, temMidia);

      if (microIntent) {
        console.log(`[CAMADA-0-MICRO] 🎯 Detectado: ${microIntent.tipo} ("${microIntent.texto.substring(0, 40)}")`);

        // Mídia pura sem texto → silêncio (não responde, só loga)
        if (microIntent.tipo === 'midia_pura') {
          await base44.asServiceRole.entities.AutomationLog.create({
            thread_id, contato_id: contact_id,
            acao: 'micro_intent_midia_pura',
            resultado: 'ignorado',
            origem: 'sistema',
            timestamp: new Date().toISOString(),
            detalhes: { media_type: mediaType, camada: '0-micro' }
          }).catch(() => {});
          resultado.camadas.dedup.micro_intent = { tipo: 'midia_pura', action: 'silent' };
          console.log('[CAMADA-0-MICRO] 🔇 Mídia pura — silêncio');
          return Response.json({ ...resultado, success: true, skipped: true, reason: 'midia_pura_silent', micro_intent: microIntent }, { headers });
        }

        // Spam/prospecção → silêncio + log low-severity
        if (microIntent.tipo === 'spam_prospec') {
          await base44.asServiceRole.entities.AutomationLog.create({
            thread_id, contato_id: contact_id,
            acao: 'micro_intent_spam_detectado',
            resultado: 'ignorado',
            origem: 'sistema',
            timestamp: new Date().toISOString(),
            detalhes: { texto: microIntent.texto, camada: '0-micro' }
          }).catch(() => {});
          resultado.camadas.dedup.micro_intent = { tipo: 'spam_prospec', action: 'silent' };
          console.log('[CAMADA-0-MICRO] 🚫 Spam detectado — silêncio');
          return Response.json({ ...resultado, success: true, skipped: true, reason: 'spam_detectado', micro_intent: microIntent }, { headers });
        }

        // Confirmação curta sem atendente → NÃO responde, deixa fluxo seguir (escala)
        if (microIntent.tipo === 'confirmacao_curta' && !thread?.assigned_user_id) {
          console.log('[CAMADA-0-MICRO] ⏭️ Confirmação sem atendente — segue fluxo normal');
          // Não faz early-return; cai no pipeline antigo
        }

        // Saudação/agradecimento COM atendente atribuído → responde no estilo
        if ((microIntent.tipo === 'saudacao_pura' || microIntent.tipo === 'agradecimento') && thread?.assigned_user_id) {
          const [contactData, integData, styleProfile] = await Promise.all([
            base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null),
            integration_id
              ? base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id).catch(() => null)
              : (thread?.whatsapp_integration_id
                ? base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id).catch(() => null)
                : Promise.resolve(null)),
            buscarStyleProfile(base44, thread.assigned_user_id)
          ]);

          if (integData && contactData?.telefone) {
            const hora = new Date().getHours();
            const foraHorario = hora < HORA_INICIO || hora > HORA_FIM;
            const msg = gerarRespostaMicroIntent(microIntent.tipo, styleProfile, contactData.nome, hora, foraHorario);

            if (msg) {
              // Cooldown 2min: se já respondeu micro-intent recentemente, pula
              const doisMinAtras = new Date(Date.now() - 120_000).toISOString();
              const respRecente = await base44.asServiceRole.entities.Message.filter({
                thread_id, sender_type: 'user',
                'metadata.micro_intent': true,
                created_date: { $gte: doisMinAtras }
              }, '-created_date', 1).catch(() => []);

              if (respRecente.length > 0) {
                console.log('[CAMADA-0-MICRO] ⏭️ Cooldown 2min ativo — skip');
                resultado.camadas.dedup.micro_intent = { tipo: microIntent.tipo, action: 'cooldown_skip' };
                return Response.json({ ...resultado, success: true, skipped: true, reason: 'micro_intent_cooldown' }, { headers });
              }

              const { ok, msgId } = await enviarWhatsApp(integData, contactData.telefone, msg);
              if (ok) {
                await base44.asServiceRole.entities.Message.create({
                  thread_id, sender_id: thread.assigned_user_id, sender_type: 'user',
                  recipient_id: contact_id, recipient_type: 'contact',
                  content: msg, channel: 'whatsapp', status: 'enviada',
                  sent_at: new Date().toISOString(), visibility: 'public_to_customer',
                  metadata: {
                    is_ai_response: true, micro_intent: true,
                    micro_intent_tipo: microIntent.tipo,
                    ai_agent: 'camada_0_micro',
                    style_profile_id: styleProfile?.id || null,
                    whatsapp_msg_id: msgId
                  }
                }).catch(() => {});

                await base44.asServiceRole.entities.MessageThread.update(thread_id, {
                  last_outbound_at: new Date().toISOString(),
                  last_message_at: new Date().toISOString(),
                  last_message_sender: 'user',
                  last_message_content: msg.substring(0, 100)
                }).catch(() => {});

                await base44.asServiceRole.entities.AutomationLog.create({
                  thread_id, contato_id: contact_id,
                  acao: `micro_intent_${microIntent.tipo}`,
                  resultado: 'sucesso',
                  origem: 'sistema',
                  timestamp: new Date().toISOString(),
                  detalhes: {
                    tipo: microIntent.tipo,
                    style_profile_usado: !!styleProfile,
                    atendente_id: thread.assigned_user_id,
                    camada: '0-micro',
                    fora_horario: foraHorario
                  }
                }).catch(() => {});

                resultado.camadas.dedup.micro_intent = { tipo: microIntent.tipo, action: 'responded', style_profile_used: !!styleProfile };
                console.log(`[CAMADA-0-MICRO] ✅ Respondido ${microIntent.tipo} ${styleProfile ? 'no estilo ' + styleProfile.display_name : '(genérico)'}`);
                return Response.json({ ...resultado, success: true, action: 'micro_intent_responded', micro_intent: microIntent, tempo_ms: Date.now() - tsInicio }, { headers });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[CAMADA-0-MICRO] ⚠️ Erro (não crítico, segue fluxo):', e.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PRÉ-CARGA: contact, integração e atendentes (uma vez só)
    // ═══════════════════════════════════════════════════════════════════

    let atendentes = [];
    try {
      const [cont, integOrNull, users] = await Promise.all([
        base44.asServiceRole.entities.Contact.get(contact_id),
        integration_id
          ? base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id).catch(() => null)
          : (thread?.whatsapp_integration_id
            ? base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id).catch(() => null)
            : Promise.resolve(null)),
        base44.asServiceRole.entities.User.list('-created_date', 200)
      ]);
      contact = cont;
      integ = integOrNull;
      atendentes = users.filter(u => u.is_whatsapp_attendant !== false && (u.full_name || u.email));
    } catch (e) {
      console.error('[UNIFICADO] Pré-carga falhou:', e.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 1 — ACK IMEDIATO (fire & forget — falha NÃO para pipeline)
    // ═══════════════════════════════════════════════════════════════════

    try {
      if (!integ) throw new Error('sem_integracao');
      if (!integ.instance_id_provider || !integ.api_key_provider) throw new Error('credenciais_invalidas');
      if (integ.api_provider === 'w_api' && !integ.security_client_token_header) throw new Error('wapi_sem_client_token');

      const hora = new Date().getHours();
      const isVIP = contact?.is_vip || false;

      // Cooldown 5min
      if (thread?.last_outbound_at) {
        const diffMs = Date.now() - new Date(thread.last_outbound_at).getTime();
        if (diffMs < COOLDOWN_MS) {
          resultado.camadas.ack = { skipped: true, reason: 'cooldown_5min' };
          console.log('[UNIFICADO] ⏭️ ACK cooldown ativo');
          throw new Error('__skip_ack');
        }
      }

      // Dedup: ACK já existe?
      const cincoMinAtras = new Date(Date.now() - COOLDOWN_MS).toISOString();
      const ackRecente = await base44.asServiceRole.entities.Message.filter({
        thread_id, sender_id: 'skill_ack',
        created_date: { $gte: cincoMinAtras }
      }, '-created_date', 1).catch(() => []);

      if (ackRecente.length > 0) {
        resultado.camadas.ack = { skipped: true, reason: 'ack_recente_db' };
        throw new Error('__skip_ack');
      }

      const ack = buildAckMsg(contact?.tipo_contato, contact?.nome, isVIP, hora);
      const { ok, msgId, raw } = await enviarWhatsApp(integ, contact.telefone, ack.msg);

      if (!ok) {
        console.warn('[UNIFICADO] ⚠️ ACK envio falhou (NÃO CRÍTICO):', JSON.stringify(raw));
        resultado.camadas.ack = { error: 'send_failed', raw };
        // NÃO THROW — pipeline continua
      } else {
        await base44.asServiceRole.entities.Message.create({
          thread_id, sender_id: 'skill_ack', sender_type: 'user',
          recipient_id: contact_id, recipient_type: 'contact',
          content: ack.msg, channel: 'whatsapp', status: 'enviada',
          sent_at: new Date().toISOString(), visibility: 'public_to_customer',
          metadata: { is_ack: true, ack_tipo: ack.tipo, whatsapp_msg_id: msgId }
        }).catch(() => {});

        await base44.asServiceRole.entities.MessageThread.update(thread_id, {
          last_outbound_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          last_message_sender: 'user',
          last_message_content: ack.msg.substring(0, 100)
        }).catch(() => {});

        resultado.camadas.ack = { ok: true, tipo: ack.tipo, msgId };
        console.log(`[UNIFICADO] ✅ Camada 1 OK — ACK enviado (${ack.tipo})`);
      }
    } catch (e) {
      if (e.message !== '__skip_ack') {
        console.warn('[UNIFICADO] Camada 1 erro (não crítico):', e.message);
        resultado.camadas.ack = resultado.camadas.ack || { error: e.message };
      }
      // NÃO THROW — pipeline sempre continua
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 2 — INTENT DETECTION (pattern match → LLM fallback)
    // ═══════════════════════════════════════════════════════════════════

    let setor = SETOR_DEFAULT;
    let intencao = 'contato_geral';
    let confidence = 0.5;
    let metodo = 'fallback';
    const textoAnalise = (message_content || thread?.last_message_content || '').substring(0, 500);

    try {
      const setorAnterior = thread?.sector_id || null;

      // Pattern match (0ms)
      let matched = null;
      for (const p of PATTERNS) {
        if (p.regex.test(textoAnalise.toLowerCase())) {
          matched = p;
          break;
        }
      }

      if (matched && matched.confidence >= 0.75) {
        setor = matched.setor;
        intencao = matched.intencao;
        confidence = matched.confidence;
        metodo = 'pattern_match';
      } else if (textoAnalise.length > 0) {
        // LLM apenas se pattern não teve sucesso
        const stickyHint = setorAnterior
          ? `\nContexto: cliente atendido anteriormente em '${setorAnterior}'. Prefira esse setor se compatível.`
          : '';

        try {
          const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
            model: 'gemini_3_flash',
            prompt: `Classifique a intenção em JSON:\nTEXTO: "${textoAnalise.substring(0, 200)}"${stickyHint}\nRetorne: {"intencao":"string","setor":"vendas|assistencia|financeiro|fornecedor","confidence":0.0-1.0}`,
            response_json_schema: {
              type: 'object',
              properties: {
                intencao: { type: 'string' },
                setor: { type: 'string' },
                confidence: { type: 'number' }
              }
            }
          });
          if (llmResult?.setor) {
            setor = llmResult.setor;
            intencao = llmResult.intencao || 'llm_detected';
            confidence = llmResult.confidence || 0.7;
            metodo = 'llm';
          }
        } catch (e) {
          console.warn('[UNIFICADO] LLM falhou, usando setor anterior ou default:', e.message);
          setor = setorAnterior || SETOR_DEFAULT;
        }
      }

      // Atendente fidelizado para o setor
      const campoFid = `atendente_fidelizado_${setor}`;
      const atendenteFidelizadoId = contact?.[campoFid] && /^[a-f0-9]{24}$/i.test(String(contact[campoFid]))
        ? String(contact[campoFid])
        : null;

      resultado.camadas.intent = { ok: true, setor, intencao, confidence, metodo, atendenteFidelizadoId };
      console.log(`[UNIFICADO] ✅ Camada 2 OK — setor: ${setor} (${metodo}, conf: ${(confidence * 100).toFixed(0)}%)`);

      // Atualizar thread
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        sector_id: setor,
        routing_stage: 'INTENT_DETECTED'
      }).catch(e => console.warn('[UNIFICADO] Falha ao setar sector_id:', e.message));

      // Registrar IntentDetection
      await base44.asServiceRole.entities.IntentDetection.create({
        thread_id, contact_id,
        mensagem_analisada: textoAnalise,
        intencao_detectada: intencao,
        setor_detectado: setor,
        tipo_contato_detectado: contact?.tipo_contato || 'novo',
        confidence, modelo_usado: metodo === 'llm' ? 'gemini_3_flash' : 'pattern_match',
        metodo_deteccao: metodo,
        threshold_aplicado: 0.65,
        resultado_roteamento: confidence >= 0.65 ? 'auto_roteado' : 'menu_fallback',
        tempo_processamento_ms: Date.now() - tsInicio,
        setor_anterior_hint: setorAnterior
      }).catch(() => {});

    } catch (e) {
      console.error('[UNIFICADO] Camada 2 erro:', e.message);
      resultado.camadas.intent = { error: e.message, setor_fallback: setor };
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 3 — ROTEAMENTO (prioridades em cascata)
    //   P1: Atendente mencionado por NOME na mensagem
    //   P2: Atendente FIDELIZADO para o setor (se online)
    //   P3: ÚLTIMO atendente que respondeu ao contato
    //   P4: Atendente do setor com MENOR CARGA
    //   P5: Fallback setor geral
    //   P6: Fila
    // ═══════════════════════════════════════════════════════════════════

    let atendente = null;
    let motivoAtribuicao = null;
    const atendenteFidelizadoId = resultado.camadas.intent?.atendenteFidelizadoId || null;

    try {
      // P1: Nome mencionado na mensagem (tem prioridade máxima — intenção explícita do cliente)
      atendente = await detectarAtendenteMencionado(base44, textoAnalise, atendentes);
      if (atendente) motivoAtribuicao = 'mencionado_na_mensagem';

      // P2: Fidelizado
      if (!atendente && atendenteFidelizadoId) {
        const fidelizado = atendentes.find(u => u.id === atendenteFidelizadoId);
        if (fidelizado) {
          atendente = fidelizado;
          motivoAtribuicao = 'fidelizado';
          console.log(`[UNIFICADO] 🎯 Fidelizado: ${atendente.full_name}`);
        }
      }

      // P3: Último atendente
      if (!atendente) {
        const ultimo = await buscarUltimoAtendente(base44, contact_id, atendentes);
        if (ultimo) {
          atendente = ultimo;
          motivoAtribuicao = 'ultimo_atendente';
        }
      }

      // P4 + P5: Setor + fallback geral
      if (!atendente) {
        atendente = await buscarAtendentePorSetor(base44, setor, atendentes);
        if (atendente) motivoAtribuicao = 'menor_carga_setor';
      }

      // P6: Sem atendente → fila
      if (!atendente) {
        await base44.asServiceRole.entities.WorkQueueItem.create({
          contact_id, thread_id,
          tipo: 'sem_atendente',
          reason: 'sem_atendente_disponivel',
          severity: contact?.is_vip ? 'critical' : 'high',
          status: 'open',
          owner_sector_id: setor,
          notes: `Sem atendente disponível em "${setor}". Mensagem: "${textoAnalise.substring(0, 100)}"`
        }).catch(() => {});

        await base44.asServiceRole.entities.MessageThread.update(thread_id, {
          routing_stage: 'ROUTED',
          pre_atendimento_state: 'WAITING_ATTENDANT_CHOICE',
          pre_atendimento_ativo: false,
          sector_id: setor,
          entrou_na_fila_em: new Date().toISOString()
        }).catch(() => {});

        resultado.camadas.routing = { ok: true, action: 'enfileirado', setor };
        resultado.success = true;
        console.log(`[UNIFICADO] 📋 Camada 3 — sem atendente em ${setor}, enfileirado`);

        await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'enfileirado');
        return Response.json({ ...resultado, action: 'enfileirado', setor }, { headers });
      }

      resultado.camadas.routing = { ok: true, atendente: atendente.full_name, setor, motivo: motivoAtribuicao };
      console.log(`[UNIFICADO] ✅ Camada 3 OK — atendente: ${atendente.full_name} (motivo: ${motivoAtribuicao})`);

    } catch (e) {
      console.error('[UNIFICADO] Camada 3 erro:', e.message);
      resultado.camadas.routing = { error: e.message };
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id, thread_id,
        tipo: 'manual', reason: 'routing_falhou', severity: 'high', status: 'open',
        notes: `Erro no roteamento: ${e.message}`
      }).catch(() => {});
      resultado.success = false;
      await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'erro_routing');
      return Response.json({ ...resultado, error: 'routing_falhou' }, { status: 500, headers });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 4 — ATRIBUIÇÃO + BOAS-VINDAS
    // ═══════════════════════════════════════════════════════════════════

    try {
      // Atribuir thread
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        assigned_user_id: atendente.id,
        sector_id: setor,
        routing_stage: 'ASSIGNED',
        pre_atendimento_state: 'COMPLETED',
        pre_atendimento_ativo: false,
        pre_atendimento_completed_at: new Date().toISOString(),
        atendentes_historico: [
          ...(Array.isArray(thread?.atendentes_historico) ? thread.atendentes_historico : []),
          atendente.id
        ].filter((v, i, a) => a.indexOf(v) === i)
      });

      console.log(`[UNIFICADO] ✅ Atribuído para ${atendente.full_name} em ${setor} (motivo: ${motivoAtribuicao})`);

      // Gerar boas-vindas via LLM
      let mensagemBoasVindas = null;
      const primeiroNome = contact?.nome?.split(' ')[0] || '';
      const tipoContato = contact?.tipo_contato || 'novo';

      try {
        const respLLM = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: 'gemini_3_flash',
          prompt: `Você é a equipe de ${setor} de uma empresa de tecnologia.
TIPO: ${tipoContato} | Cliente: ${primeiroNome}
Mensagem do cliente: "${textoAnalise.substring(0, 200)}"

Gere boas-vindas CURTA (máx 2 linhas, máx 1 emoji), primeira pessoa do plural.
NUNCA mencione nomes de atendentes. Tom profissional e humano.`
        });
        mensagemBoasVindas = typeof respLLM === 'string' ? respLLM : respLLM?.text || null;
      } catch (e) {
        console.warn('[UNIFICADO] LLM boas-vindas falhou, usando fallback');
        const fallbacks = {
          cliente: `Olá${primeiroNome ? ' ' + primeiroNome : ''}! Que bom ter você. Estamos verificando o que você precisa. 😊`,
          fornecedor: `Olá! Obrigado pelo contato. Nossa equipe de compras vai te atender.`,
          ex_cliente: `Que bom ter você de volta${primeiroNome ? ', ' + primeiroNome : ''}! 😊`,
          default: `Olá${primeiroNome ? ' ' + primeiroNome : ''}! Seja bem-vindo(a). Nossa equipe vai te ajudar! 😊`
        };
        mensagemBoasVindas = fallbacks[tipoContato] || fallbacks.default;
      }

      // Enviar boas-vindas
      if (mensagemBoasVindas && integ && contact?.telefone) {
        const { ok: envOk, msgId: envMsgId } = await enviarWhatsApp(integ, contact.telefone, mensagemBoasVindas);

        if (envOk) {
          await base44.asServiceRole.entities.Message.create({
            thread_id, sender_id: 'nexus_agent', sender_type: 'user',
            content: mensagemBoasVindas, channel: 'whatsapp', status: 'enviada',
            sent_at: new Date().toISOString(), visibility: 'public_to_customer',
            metadata: { is_ai_response: true, ai_agent: 'primeiroAtendimentoUnificado', assigned_to: atendente.id, whatsapp_msg_id: envMsgId }
          }).catch(() => {});

          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            last_message_at: new Date().toISOString(),
            last_outbound_at: new Date().toISOString(),
            last_message_sender: 'user',
            last_message_content: mensagemBoasVindas.substring(0, 100),
            unread_count: 0
          }).catch(() => {});

          console.log('[UNIFICADO] 💬 Boas-vindas enviadas');
        }
      }

      resultado.camadas.atribuicao = {
        ok: true,
        atendente: atendente.full_name,
        atendente_id: atendente.id,
        motivo: motivoAtribuicao,
        mensagem_enviada: !!mensagemBoasVindas
      };
      resultado.success = true;

    } catch (e) {
      console.error('[UNIFICADO] Camada 4 erro:', e.message);
      resultado.camadas.atribuicao = { error: e.message };
      resultado.success = !!resultado.camadas.routing?.ok;
    }

    await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, resultado.success ? 'concluido' : 'parcial');

    return Response.json({
      ...resultado,
      action: 'atribuicao_concluida',
      setor,
      atendente: atendente?.full_name,
      motivo: motivoAtribuicao,
      tempo_ms: Date.now() - tsInicio
    }, { headers });

  } catch (error) {
    console.error('[UNIFICADO] ❌ Erro fatal:', error.message);
    return Response.json({ success: false, error: error.message, camadas: resultado.camadas }, { status: 500, headers });
  }
});