// skillPreAtendimentos.js — motor único do pré-atendimento em camadas.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES — TODAS as configurações vêm do banco via BroadcastConfig + ConfiguracaoSistema
// FONTE DE VERDADE: edite tudo no Painel de Configuração de Broadcast (NUNCA hardcoded)
// ─────────────────────────────────────────────────────────────────────────────

// Cache em memória do worker (5min) para evitar 1 query/webhook
let _cacheConfig = null;
let _cacheConfigAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

let _cacheMensagens = null;
let _cacheMensagensAt = 0;

// Carrega TUDO de BroadcastConfig: horários + feriados + cooldowns
async function carregarHorarioConfig(base44) {
  const agora = Date.now();
  if (_cacheConfig && (agora - _cacheConfigAt) < CACHE_TTL_MS) {
    return _cacheConfig;
  }
  const lista = await base44.asServiceRole.entities.BroadcastConfig
    .filter({ nome_config: 'default', ativo: true });
  const c = lista?.[0];
  if (!c) {
    throw new Error('BroadcastConfig (nome_config=default, ativo=true) não encontrado no banco');
  }
  _cacheConfig = {
    manha_inicio: c.horario_comercial_manha_inicio ?? c.horario_inicio,
    almoco_inicio: c.horario_almoco_inicio,
    almoco_fim: c.horario_almoco_fim,
    tarde_fim: c.horario_comercial_tarde_fim ?? c.horario_fim,
    feriados_extras: Array.isArray(c.feriados_extras) ? c.feriados_extras : [],
    feriados_nacionais_fixos: Array.isArray(c.feriados_nacionais_fixos) ? c.feriados_nacionais_fixos : [],
    enviar_fim_semana: c.enviar_fim_semana === true,
    cooldown_ack_ms: (c.cooldown_ack_minutos ?? 5) * 60 * 1000,
    dedup_window_ms: (c.dedup_window_segundos ?? 30) * 1000,
    gap_promo_fora_horario_ms: (c.gap_promo_fora_horario_horas ?? 12) * 60 * 60 * 1000,
    // ACK/vídeo fora-horário tem cooldown curto; promoção mantém cooldown próprio de 12h.
    gap_ack_fora_horario_ms: (c.gap_ack_fora_horario_minutos ?? 30) * 60 * 1000
  };
  _cacheConfigAt = agora;
  return _cacheConfig;
}

// Carrega TODAS as configs de pre_atendimento (ack_msg_*, micro_*, boas_vindas_*, outside_hours_*, promo_*)
async function carregarMensagensAck(base44) {
  const agora = Date.now();
  if (_cacheMensagens && (agora - _cacheMensagensAt) < CACHE_TTL_MS) {
    return _cacheMensagens;
  }
  const lista = await base44.asServiceRole.entities.ConfiguracaoSistema
    .filter({ categoria: 'pre_atendimento', ativa: true }).catch(() => []);
  const map = {};
  for (const item of (lista || [])) {
    if (!item.chave) continue;
    map[item.chave] = item.valor?.value ?? '';
  }
  _cacheMensagens = map;
  _cacheMensagensAt = agora;
  return _cacheMensagens;
}

const PATTERNS = [
  { regex: /pc\s*gam|gam(er|ing)|notebook|computador|placa\s*de\s*v|rtx|processador|ram|ssd|cpu|impressora|monitor|teclado|mouse|headset|fonte|gabinete|cooler|hardware|orcamento|cotacao|preco|quanto\s*custa|comprar|produto|estoque|disponib/i, setor: 'vendas', intencao: 'compra_produto', confidence: 0.95 },
  { regex: /boleto|fatura|nota\s*fiscal|2[aa]\s*via|pagamento|vencimento|cobranca|debito|credito|parcelar|financ/i, setor: 'financeiro', intencao: 'consulta_financeira', confidence: 0.95 },
  { regex: /defeito|quebrou|nao\s*liga|nao\s*funciona|conserto|reparo|assistencia|garantia|suporte\s*tec|problema|travando|lento|reiniciando|cabo\s*de\s*internet|wifi|conexao|internet\s*caiu|nao\s*conecta|rede|modem|roteador/i, setor: 'assistencia', intencao: 'suporte_tecnico', confidence: 0.95 },
  { regex: /fornec|distribu|atacado|revend|parceria|comercial|representante|catalogo|lista\s*de\s*preco/i, setor: 'fornecedor', intencao: 'parceria_comercial', confidence: 0.90 },
  // Saudações genéricas — evita LLM para "oi", "olá", "bom dia" etc (reduz latência ~10s → ~500ms)
  { regex: /^(oi|ola|olá|bom\s*dia|boa\s*tarde|boa\s*noite|hello|tudo\s*bem|alo|alô)[\s!?.]*$/i, setor: 'vendas', intencao: 'saudacao_generica', confidence: 0.80 },
];

const SETOR_DEFAULT = 'vendas';

// Horário comercial — 100% dinâmico via BroadcastConfig
// Fora disso (incl. almoço, fim de semana, feriado, noite) = "fora_horario"
function avaliarHorarioComercial(date = new Date(), cfg) {
  if (!cfg) throw new Error('avaliarHorarioComercial requer cfg do BroadcastConfig');
  if (ehFeriadoNacional(date, cfg.feriados_extras, cfg.feriados_nacionais_fixos)) {
    return { dentro: false, motivo: 'feriado' };
  }
  const brt = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dow = brt.getDay(); // 0=dom, 6=sab
  if (!cfg.enviar_fim_semana && (dow === 0 || dow === 6)) return { dentro: false, motivo: 'fim_de_semana' };
  const minutosAgora = brt.getHours() * 60 + brt.getMinutes();
  const m = (h) => Math.round(h * 60); // hora decimal -> minutos
  const manha = minutosAgora >= m(cfg.manha_inicio) && minutosAgora < m(cfg.almoco_inicio);
  const tarde = minutosAgora >= m(cfg.almoco_fim) && minutosAgora < m(cfg.tarde_fim);
  if (manha || tarde) return { dentro: true, motivo: 'horario_comercial' };
  if (minutosAgora >= m(cfg.almoco_inicio) && minutosAgora < m(cfg.almoco_fim)) return { dentro: false, motivo: 'almoco' };
  return { dentro: false, motivo: 'noite' };
}

// Feriados nacionais — 100% dinâmicos via BroadcastConfig (NADA hardcoded)
// feriados_nacionais_fixos: array de "MM-DD" (repetem todo ano)
// feriados_extras: array de "YYYY-MM-DD" (datas específicas, ex: carnaval, corpus christi)
function ehFeriadoNacional(date, feriadosExtras = [], feriadosFixos = []) {
  const brt = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const mm = String(brt.getMonth() + 1).padStart(2, '0');
  const dd = String(brt.getDate()).padStart(2, '0');
  const yyyy = brt.getFullYear();
  const isoCompleto = `${yyyy}-${mm}-${dd}`;
  const mmdd = `${mm}-${dd}`;
  if (Array.isArray(feriadosFixos) && feriadosFixos.includes(mmdd)) return true;
  if (Array.isArray(feriadosExtras) && (feriadosExtras.includes(isoCompleto) || feriadosExtras.includes(mmdd))) return true;
  return false;
}

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

function temIntencaoUtilParaBrain(texto) {
  const t = (texto || '').trim();
  if (t.length < 8) return false;
  if (detectarMicroIntent(t, false)) return false;
  return /(quando|responder|resposta|retorno|cotacao|cotação|orcamento|orçamento|preco|preço|prazo|disponivel|disponível|produto|comprar|pedido|problema|suporte|nota|boleto|pagamento|urgente|preciso|consegue|pode|como faço|como faco)/i.test(t);
}

async function acionarBrainCopiloto(base44, { thread_id, contact_id, message_id, message_content, integration_id, provider, reason }) {
  if (!temIntencaoUtilParaBrain(message_content)) return false;
  base44.asServiceRole.functions.invoke('nexusAgentBrain', {
    thread_id,
    contact_id,
    message_id,
    message_content,
    integration_id,
    provider,
    trigger: 'inbound',
    mode: 'copilot',
    reason
  }).catch(e => console.warn('[SKILL-PRE-ATEND] Brain copilot erro:', e.message));
  return true;
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

function gerarRespostaMicroIntent(tipo, profile, contactNome, hora, foraHorario, cfg = null, mensagens = {}) {
  const primeiroNome = (contactNome || '').split(' ')[0] || '';
  const assinatura = profile?.assinatura ? `\n\n${profile.assinatura}` : '';
  const chamaPeloNome = profile?.style_features?.chama_pelo_nome && primeiroNome;
  const nomeComVirgula = chamaPeloNome ? ', ' + primeiroNome : '';

  if (tipo === 'saudacao_pura') {
    const periodo = getPeriodoDia(hora);
    let saudacaoEstilo = profile?.frases_saudacao_por_hora?.[periodo] || '';
    saudacaoEstilo = saudacaoEstilo
      .replace(/,?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+/g, '')
      .replace(/,?\s*tudo\s*bem\??/i, '')
      .replace(/[!?.,\s]+$/, '')
      .trim();
    const base = saudacaoEstilo || (periodo === 'manha' ? 'Bom dia' : periodo === 'tarde' ? 'Boa tarde' : 'Boa noite');

    if (foraHorario) {
      const inicio = cfg?.manha_inicio ?? 8;
      const fim = cfg?.tarde_fim ?? 18;
      const tpl = mensagens.micro_saudacao_fora_horario
        || '{{saudacao}}{{nome_com_virgula}}! Recebi sua mensagem 😊\nNosso atendimento é seg-sex {{hora_inicio}}h-{{hora_fim}}h. Te retorno em breve!';
      const msg = tpl
        .replace(/\{\{\s*saudacao\s*\}\}/g, base)
        .replace(/\{\{\s*nome_com_virgula\s*\}\}/g, nomeComVirgula)
        .replace(/\{\{\s*hora_inicio\s*\}\}/g, inicio)
        .replace(/\{\{\s*hora_fim\s*\}\}/g, fim);
      return `${msg}${assinatura}`;
    }

    const tpl = mensagens.micro_saudacao_dentro_horario
      || '{{saudacao}}{{nome_com_virgula}}! Tudo bem?';
    const msg = tpl
      .replace(/\{\{\s*saudacao\s*\}\}/g, base)
      .replace(/\{\{\s*nome_com_virgula\s*\}\}/g, nomeComVirgula);
    return `${msg}${assinatura}`;
  }

  if (tipo === 'agradecimento') {
    const encerramento = profile?.frases_agradecimento?.[0] || profile?.frases_encerramento?.[0];
    if (encerramento) return `${encerramento}${assinatura}`;
    const tpl = mensagens.micro_agradecimento
      || 'Por nada{{nome_com_virgula}}! Qualquer coisa é só chamar 👋';
    const msg = tpl.replace(/\{\{\s*nome_com_virgula\s*\}\}/g, nomeComVirgula);
    return `${msg}${assinatura}`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: montar mensagem ACK por contexto (templates 100% via ConfiguracaoSistema)
// ─────────────────────────────────────────────────────────────────────────────

function aplicarPlaceholders(template, ctx) {
  if (!template) return '';
  const primeiroNome = (ctx.nome || '').split(' ')[0] || '';
  return template
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, primeiroNome)
    .replace(/\{\{\s*nome\s*\}\}/g, ctx.nome || '')
    .replace(/\{\{\s*nome_com_virgula\s*\}\}/g, primeiroNome ? ', ' + primeiroNome : '');
}

function buildAckMsg(tipo, nome, isVIP, horarioInfo, mensagens) {
  const ctx = { nome };
  if (!horarioInfo.dentro) {
    let chave = 'ack_msg_fora_horario';
    if (horarioInfo.motivo === 'feriado') chave = 'ack_msg_feriado';
    else if (horarioInfo.motivo === 'almoco') chave = 'ack_msg_almoco';
    else if (horarioInfo.motivo === 'fim_de_semana') chave = 'ack_msg_fim_de_semana';
    return { tipo: 'fora_horario', msg: aplicarPlaceholders(mensagens[chave], ctx) };
  }
  if (isVIP) return { tipo: 'vip', msg: aplicarPlaceholders(mensagens.ack_msg_vip, ctx) };
  if (tipo === 'cliente') return { tipo: 'cliente', msg: aplicarPlaceholders(mensagens.ack_msg_cliente, ctx) };
  if (tipo === 'ex_cliente') return { tipo: 'ex_cliente', msg: aplicarPlaceholders(mensagens.ack_msg_ex_cliente, ctx) };
  if (tipo === 'fornecedor') return { tipo: 'fornecedor', msg: aplicarPlaceholders(mensagens.ack_msg_fornecedor, ctx) };
  return { tipo: 'novo', msg: aplicarPlaceholders(mensagens.ack_msg_novo, ctx) };
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
    const resp = await r.json().catch(() => ({}));
    const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
    const ok = r.ok && !!msgId && !resp.error;
    if (!ok) console.warn('[SKILL-PRE-ATEND] W-API falhou:', JSON.stringify(resp).substring(0, 300));
    return { ok, msgId, raw: resp };
  } else {
    const url = (integ.base_url_provider || 'https://api.z-api.io')
      + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-text`;
    const headers = { 'Content-Type': 'application/json' };
    if (integ.security_client_token_header) {
      headers['Client-Token'] = integ.security_client_token_header;
    }
    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, message: mensagem })
    });
    const resp = await r.json().catch(() => ({}));
    const msgId = resp.messageId || resp.key?.id || resp.id || null;
    const ok = r.ok && !!msgId && !resp.error;
    if (!ok) console.warn('[SKILL-PRE-ATEND] Z-API falhou:', JSON.stringify(resp).substring(0, 300));
    return { ok, msgId, raw: resp };
  }
}

// Envia mídia (vídeo/imagem) com caption — usado no ACK fora-horário
async function enviarWhatsAppMidia(integ, telefone, mediaUrl, caption, tipo = 'video') {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;

  if (integ.api_provider === 'w_api') {
    const endpoint = tipo === 'video' ? 'send-video' : 'send-image';
    const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
      + `/message/${endpoint}?instanceId=${integ.instance_id_provider}`;
    const bodyKey = tipo === 'video' ? 'video' : 'image';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
      body: JSON.stringify({ phone, [bodyKey]: mediaUrl, caption, delayMessage: 1 })
    });
    const resp = await r.json().catch(() => ({}));
    const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
    const ok = r.ok && !!msgId && !resp.error;
    if (!ok) console.warn('[SKILL-PRE-ATEND] W-API mídia falhou:', JSON.stringify(resp).substring(0, 300));
    return { ok, msgId, raw: resp };
  } else {
    const endpoint = tipo === 'video' ? 'send-video' : 'send-image';
    const url = (integ.base_url_provider || 'https://api.z-api.io')
      + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (integ.security_client_token_header) headers['Client-Token'] = integ.security_client_token_header;
    const bodyKey = tipo === 'video' ? 'video' : 'image';
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ phone, [bodyKey]: mediaUrl, caption })
    });
    const resp = await r.json().catch(() => ({}));
    const msgId = resp.messageId || resp.key?.id || resp.id || null;
    const ok = r.ok && !!msgId && !resp.error;
    if (!ok) console.warn('[SKILL-PRE-ATEND] Z-API mídia falhou:', JSON.stringify(resp).substring(0, 300));
    return { ok, msgId, raw: resp };
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
      console.log(`[SKILL-PRE-ATEND] 🎯 Atendente mencionado na mensagem: ${atendente.full_name}`);
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
          console.log(`[SKILL-PRE-ATEND] 👤 Último atendente (histórico): ${atendente.full_name}`);
          return atendente;
        }
      }
      // Fallback: assigned_user_id da thread mais recente
      if (t.assigned_user_id) {
        const atendente = atendentes.find(u => u.id === t.assigned_user_id);
        if (atendente) {
          console.log(`[SKILL-PRE-ATEND] 👤 Último atendente (assigned): ${atendente.full_name}`);
          return atendente;
        }
      }
    }
  } catch (e) {
    console.warn('[SKILL-PRE-ATEND] Erro ao buscar último atendente:', e.message);
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
  console.log(`[SKILL-PRE-ATEND] 📊 Atendente por carga: ${melhor.full_name} (${cargaPor[melhor.id] || 0} abertas)`);
  return melhor;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: gravar AutomationLog final
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_FINAIS_VALIDOS = [
  'concluido', 'enfileirado', 'ack_enviado', 'ack_fora_horario_thread_atribuida',
  'ack_skipped_cooldown', 'brain_copilot_acionado', 'playbook_executado',
  'roteamento_concluido', 'humano_ativo_sem_acao', 'saudacao_micro_intent',
  'ja_atribuida', 'pipeline_recente', 'midia_pura_silent', 'spam_detectado',
  'micro_intent_cooldown', 'micro_intent_responded', 'bloqueado_por_regra'
];

async function gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, status) {
  try {
    // Sprint 1 — sumário plano por camada em metadata para queries rápidas.
    // Ex: AutomationLog.filter({ 'metadata.camada_4_status': 'ok' })
    const sum = {};
    const tele = resultado.telemetria || {};
    const flatKeys = ['status', 'duration_ms', 'reason', 'error', 'branch', 'to', 'atendente_id', 'motivo', 'micro_intent_tipo', 'setor', 'tipo', 'regra', 'acao'];
    for (const k of Object.keys(tele)) {
      const c = tele[k] || {};
      for (const f of flatKeys) {
        if (c[f] !== undefined && c[f] !== null) sum[`${k}_${f}`] = typeof c[f] === 'string' ? c[f].substring(0, 200) : c[f];
      }
    }
    await base44.asServiceRole.entities.AutomationLog.create({
      thread_id, contato_id: contact_id, acao: 'outro',
      resultado: STATUS_FINAIS_VALIDOS.includes(status) ? 'sucesso' : 'erro',
      origem: 'sistema', timestamp: new Date().toISOString(),
      detalhes: {
        tempo_execucao_ms: Date.now() - tsInicio,
        mensagem: `Pipeline finalizado: ${status}`,
        dados_contexto: { event_type: 'pipeline_primeiro_atendimento', camadas: resultado.camadas, telemetria: tele, status_final: status }
      },
      metadata: { event_type: 'pipeline_primeiro_atendimento', camadas: resultado.camadas, telemetria: tele, status_final: status, tempo_execucao_ms: Date.now() - tsInicio, ...sum }
    });
  } catch (e) {
    console.error('[SKILL-PRE-ATEND] 🔴 Falha ao gravar log final:', e.message);
  }
}

// Patch 3 helper — log fire-and-forget compacto p/ fallthroughs Camada 4
// d.acao e d.resultado são opcionais; se ausentes usa defaults seguros.
// d.camada também é opcional (default '4-micro' por compatibilidade retroativa).
const logC4 = (b, t, c, e, d) => b.asServiceRole.entities.AutomationLog.create({ thread_id: t, contato_id: c, acao: d.acao || 'outro', resultado: d.resultado || (d.erro ? 'erro' : 'ignorado'), origem: 'sistema', timestamp: new Date().toISOString(), detalhes: { mensagem: d.mensagem || e, dados_contexto: { ...d, camada: d.camada || '4-micro' } }, metadata: { event_type: e, ...d, camada: d.camada || '4-micro' } }).catch(() => {});

async function registrarEventoPreAtendimento(base44, thread_id, contact_id, event_type, details = {}) {
  try {
    await base44.asServiceRole.entities.AutomationLog.create({
      thread_id,
      contato_id: contact_id,
      acao: details.acao || 'outro',
      resultado: details.resultado || 'sucesso',
      origem: 'sistema',
      timestamp: new Date().toISOString(),
      detalhes: {
        mensagem: details.mensagem || event_type,
        dados_contexto: {
          event_type,
          ...details
        }
      },
      metadata: {
        event_type,
        ...details
      }
    });
  } catch (e) {
    console.warn(`[SKILL-PRE-ATEND] ⚠️ Log ${event_type} falhou:`, e.message);
  }
}

const ROUTING_STAGES_FINAIS = ['COMPLETED'];
const ROUTING_STAGES_PRESERVAR = ['ROUTED'];

async function liberarEstadoThread(base44, thread, motivo) {
  if (!base44 || !thread?.id) return;

  const patch = {};
  const estagioAtual = thread.routing_stage;

  if (thread.pre_atendimento_ativo === true) {
    patch.pre_atendimento_ativo = false;
  }

  if (
    thread.assigned_user_id &&
    estagioAtual !== 'ASSIGNED' &&
    !ROUTING_STAGES_FINAIS.includes(estagioAtual) &&
    !ROUTING_STAGES_PRESERVAR.includes(estagioAtual)
  ) {
    patch.routing_stage = 'ASSIGNED';
  }

  if (Object.keys(patch).length > 0) {
    await base44.asServiceRole.entities.MessageThread.update(thread.id, patch).catch(err => {
      console.error(`[liberarEstadoThread] falha ao atualizar thread ${thread.id}:`, err.message);
    });
  }

  await registrarEventoPreAtendimento(base44, thread.id, thread.contact_id, 'thread_state_normalized', {
    acao: 'outro',
    mensagem: `Estado da thread verificado/liberado: ${motivo}`,
    motivo,
    routing_stage_antes: estagioAtual || null,
    routing_stage_depois: patch.routing_stage || estagioAtual || null,
    pre_atendimento_ativo_liberado: patch.pre_atendimento_ativo === false,
    patch_aplicado: Object.keys(patch).length > 0 ? patch : null,
    skill_name: 'skillPreAtendimentos'
  });
}

async function materializarConversationState(base44, { thread_id, contact_id, thread, contact, context, message_content, horarioInfo, horarioCfg }) {
  const texto = (message_content || '').toLowerCase().trim();
  const cobranca = /(consegue\s+me\s+responder|me\s+responde|responder\??|retorno|aguardo|sem\s+resposta|pode\s+me\s+retornar)/i.test(texto);
  const gapPromo = horarioCfg?.gap_promo_fora_horario_ms || 43200000;
  const lastPromo = thread?.last_any_promo_sent_at || thread?.last_promo_inbound_at || contact?.last_any_promo_sent_at || contact?.last_promo_inbound_at;
  const promocaoRecente = !!lastPromo && (Date.now() - new Date(lastPromo).getTime() < gapPromo);
  const threadAtribuida = !!(thread?.assigned_user_id || context?.thread_assigned);
  const estado = cobranca ? 'cobranca_retorno' : promocaoRecente ? 'pos_promocao' : threadAtribuida ? 'thread_contextualizada' : 'pre_atendimento_padrao';
  const prioridade = cobranca || contact?.is_vip ? 'alta' : 'normal';
  const conversationState = {
    version: 'v2', calculated_at: new Date().toISOString(), estado_principal: estado,
    intents: cobranca ? ['cobranca_retorno'] : (promocaoRecente ? ['promocao_recente_contexto'] : ['mensagem_contextual']),
    humano_ativo: context?.human_active === true, thread_atribuida: threadAtribuida,
    fora_horario: horarioInfo?.dentro === false, horario_motivo: horarioInfo?.motivo || null,
    promocao_recente: promocaoRecente, prioridade_operacional: prioridade,
    outputs_permitidos: { ack: !(cobranca && promocaoRecente), promocao: !(cobranca || promocaoRecente), ura: !threadAtribuida && !cobranca, playbook: !threadAtribuida && !cobranca, brain_copilot: cobranca || threadAtribuida || context?.human_active === true, notificacao: cobranca || threadAtribuida || context?.human_active === true, tarefa: cobranca },
    notificacao_alvo: { tipo: thread?.assigned_user_id ? 'atendente_atribuido' : (thread?.sector_id || context?.sector_id ? 'setor_responsavel' : 'fila_pre_atendimento'), user_id: thread?.assigned_user_id || null, sector_id: thread?.sector_id || context?.sector_id || null, urgencia: prioridade, motivo: cobranca ? 'cliente_cobrando_retorno' : estado },
    acoes_descartadas: cobranca ? ['ack_generico', 'promocao_repetida', 'ura_reaberta'] : []
  };
  await base44.asServiceRole.entities.MessageThread.update(thread_id, { campos_personalizados: { ...(thread?.campos_personalizados || {}), pre_atendimento_state_v2: conversationState } }).catch(e => console.warn('[SKILL-PRE-ATEND] conversation_state persistência falhou:', e.message));
  await registrarEventoPreAtendimento(base44, thread_id, contact_id, 'conversation_state_calculated', { acao: 'conversation_state_calculated', contact_id, estado_principal: estado, prioridade_operacional: prioridade, outputs_permitidos: conversationState.outputs_permitidos, notificacao_alvo: conversationState.notificacao_alvo, acoes_descartadas: conversationState.acoes_descartadas, conversation_state: conversationState });
  return conversationState;
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
    },
    telemetria: {
      // Preenchido por marcarInicioCamada/marcarFimCamada — uma chave por camada (1..9)
      // Formato: { camada_N: { ts_start, duration_ms, status, reason?, extras? } }
    }
  };

  // Cache local do request.
  let _horarioCfgPipeline = null;
  let _horarioInfoPipeline = null;
  const getHorarioCfgPipeline = async (base44) => {
    if (!_horarioCfgPipeline) _horarioCfgPipeline = await carregarHorarioConfig(base44);
    return _horarioCfgPipeline;
  };
  const getHorarioInfoPipeline = async (base44) => {
    if (!_horarioInfoPipeline) {
      const cfg = await getHorarioCfgPipeline(base44);
      _horarioInfoPipeline = avaliarHorarioComercial(new Date(), cfg);
    }
    return _horarioInfoPipeline;
  };

  // Telemetria unificada das camadas.
  const marcarInicioCamada = (n) => {
    resultado.telemetria[`camada_${n}`] = {
      ts_start: Date.now(),
      duration_ms: null,
      status: 'not_executed'
    };
  };
  const marcarFimCamada = (n, status, extras = {}) => {
    const entry = resultado.telemetria[`camada_${n}`];
    if (!entry) {
      resultado.telemetria[`camada_${n}`] = {
        ts_start: Date.now(),
        duration_ms: 0,
        status,
        ...extras
      };
      return;
    }
    entry.duration_ms = Date.now() - entry.ts_start;
    entry.status = status;
    Object.assign(entry, extras);
  };

  // T5: hoisted para cleanup defensivo no catch fatal
  let _payloadForCleanup = null;
  let _base44ForCleanup = null;

  try {
    const base44 = createClientFromRequest(req);
    _base44ForCleanup = base44;
    const payload = await req.json();
    _payloadForCleanup = payload;
    const { thread_id, contact_id, integration_id, message_id, message_content } = payload;
    const context = payload.context || {}; // {thread_assigned, human_active, novo_ciclo, sector_id} (vindo do gate v12+)

    if (!thread_id || !contact_id) {
      return Response.json({ success: false, error: 'Campos obrigatorios: thread_id, contact_id' }, { status: 400, headers });
    }

    console.log(`[SKILL-PRE-ATEND] 🚀 Início pipeline — thread: ${thread_id} | context: ${JSON.stringify(context)}`);

    let threadInicial = null;
    let contactInicial = null;
    try {
      [threadInicial, contactInicial] = await Promise.all([
        base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null),
        base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null)
      ]);
    } catch (_) { /* segue mesmo se falhar — Camada 0 vai re-buscar */ }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 1 — ACESSOS RÁPIDOS: CLIQUE EM CATEGORIA → SUBMENU
    // FONTE ÚNICA para W-API e Z-API. O webhook entrega a escolha como:
    //   • Z-API: buttonId = "acesso_menu:setores"
    //   • W-API: selectedDisplayText = "🏢 Setores da Empresa"
    // Detecta a escolha ANTES de qualquer ACK/roteamento e dispara o submenu
    // de botões da categoria via enviarCartaoAcesso(acao:'submenu'), encerrando
    // o pipeline (não envia ACK, não roteia, não chama LLM).
    // OBS: roda DEPOIS do carregamento de threadInicial (a leitura do nível do
    // menu exige a thread já carregada — antes disso dava ReferenceError).
    // ═══════════════════════════════════════════════════════════════════
    const _txtMenu = String(message_content || '').trim();
    const _ehCliqueMenu = /^acesso_menu:/i.test(_txtMenu)
      || /(setores|promo|web\s*site|redes\s*sociais)/i.test(_txtMenu.toLowerCase());
    if (_ehCliqueMenu && _txtMenu.length <= 60) {
      const _menuNivel = threadInicial?.campos_personalizados?.acesso_menu_nivel;
      if (_menuNivel) {
        console.log(`[SKILL-PRE-ATEND] 🎯 Camada 0 — clique de menu detectado ("${_txtMenu}") → submenu`);
        const _respSub = await base44.asServiceRole.functions.invoke('enviarCartaoAcesso', {
          acao: 'submenu',
          thread_id,
          resposta: _txtMenu,
          integration_id: integration_id || threadInicial?.whatsapp_integration_id
        }).catch(e => { console.warn('[SKILL-PRE-ATEND] submenu falhou:', e.message); return null; });
        const _subData = _respSub?.data || _respSub;
        // Só encerra o pipeline se o submenu foi de fato enviado (ou pulado por
        // duplicata/expiração). Se a escolha não foi reconhecida, segue o fluxo
        // normal para não engolir uma mensagem real que casou o regex por acaso.
        if (_subData?.success && !_subData?.skipped?.toString().includes('escolha_nao_reconhecida')) {
          await liberarEstadoThread(base44, threadInicial, 'early_return_camada0_submenu_acessos');
          return Response.json({ success: true, action: 'submenu_acessos', resultado: _subData }, { headers });
        }
        console.log(`[SKILL-PRE-ATEND] ↩️ Camada 0 — submenu não enviado (${_subData?.skipped || 'sem_resposta'}), seguindo pipeline`);
      }
    }

    // CAMADA 2 — roteamentos diretos (Agenda / Fiscal).

    // 1) AGENDA IA por modo/número (assistant_mode='agenda' OU número especial)
    marcarInicioCamada(1);
    try {
      const integNome = integration_id
        ? (await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id).catch(() => null))?.nome_instancia
        : null;
      const ehAgendaMode = threadInicial?.assistant_mode === 'agenda'
        || integNome === 'NEXUS_AGENDA_INTEGRATION'
        || contactInicial?.telefone === '+5548999142800';

      if (ehAgendaMode) {
        console.log(`[SKILL-PRE-ATEND] 📅 Camada 1A → routeToAgendaIA (agenda mode)`);
        await base44.asServiceRole.functions.invoke('routeToAgendaIA', {
          thread_id, message_id, content: message_content,
          from_type: 'external_contact', from_id: contact_id
        }).catch(e => console.warn('[SKILL-PRE-ATEND] routeToAgendaIA falhou:', e.message));
        await liberarEstadoThread(base44, threadInicial, 'early_return_camada1a_agenda_ia');
        marcarFimCamada(1, 'routed_out', { to: 'agenda_ia_mode', branch: '1A' });
        return Response.json({ success: true, routed: true, to: 'agenda_ia_mode', camadas: resultado.camadas, telemetria: resultado.telemetria }, { headers });
      }
    } catch (e) {
      console.warn('[SKILL-PRE-ATEND] Camada 1A erro (não crítico):', e.message);
      marcarFimCamada(1, 'error', { branch: '1A', error: e.message });
    }

    // 2) CLAUDE AGENDA por regex de intenção
    try {
      if ((message_content || '').length > 2 && integration_id) {
        const textoAgenda = (message_content || '').toLowerCase();
        const ehAgendaRegex = /(agendar|agendamento|marcar|desmarcar|reagendar|remarcar|cancelar|horário|horario|disponível|disponivel|consulta|visita|reunião|reuniao)/.test(textoAgenda);
        if (ehAgendaRegex) {
          console.log(`[SKILL-PRE-ATEND] 📅 Camada 1B → claudeAgendaAgent (regex match)`);
          await base44.asServiceRole.functions.invoke('claudeAgendaAgent', {
            thread_id, contact_id,
            message_content,
            integration_id,
            provider: payload.provider
          }).catch(e => console.warn('[SKILL-PRE-ATEND] claudeAgendaAgent falhou:', e.message));
          await liberarEstadoThread(base44, threadInicial, 'early_return_camada1b_claude_agenda');
          marcarFimCamada(1, 'routed_out', { to: 'claude_agenda', branch: '1B' });
          return Response.json({ success: true, routed: true, to: 'claude_agenda', camadas: resultado.camadas, telemetria: resultado.telemetria }, { headers });
        }
      }
    } catch (e) {
      console.warn('[SKILL-PRE-ATEND] Camada 1B erro (não crítico):', e.message);
      marcarFimCamada(1, 'error', { branch: '1B', error: e.message });
    }

    // 3) DOC FISCAL por detecção semântica
    try {
      if ((message_content || '').length > 2 && contact_id) {
        const deteccaoFiscal = await base44.asServiceRole.functions.invoke('detectarSolicitacaoDocFiscal', {
          mensagem: message_content,
          contact_id,
          thread_id
        }).catch(() => null);

        const data = deteccaoFiscal?.data || deteccaoFiscal;
        if (data?.eh_solicitacao_fiscal && Array.isArray(data.notas) && data.notas.length > 0) {
          const notaComPDF = data.notas.find(n => n.pdf_url);
          if (notaComPDF) {
            console.log(`[SKILL-PRE-ATEND] 📄 Camada 1C → dispararNotaFiscalWhatsApp (NF ${notaComPDF.numero_nf})`);
            await base44.asServiceRole.functions.invoke('dispararNotaFiscalWhatsApp', {
              nota_fiscal_id: notaComPDF.id,
              contact_id, thread_id,
              integration_id: integration_id || threadInicial?.whatsapp_integration_id
            }).catch(e => console.warn('[SKILL-PRE-ATEND] dispararNotaFiscalWhatsApp falhou:', e.message));
            await liberarEstadoThread(base44, threadInicial, 'early_return_camada1c_doc_fiscal_auto');
            marcarFimCamada(1, 'routed_out', { to: 'doc_fiscal_auto', branch: '1C', nota_fiscal_id: notaComPDF.id });
            return Response.json({ success: true, routed: true, to: 'doc_fiscal_auto', camadas: resultado.camadas, telemetria: resultado.telemetria }, { headers });
          }
        }
      }
    } catch (e) {
      console.warn('[SKILL-PRE-ATEND] Camada 1C erro (não crítico):', e.message);
      marcarFimCamada(1, 'error', { branch: '1C', error: e.message });
    }
    // Camada 1 passou sem rotear — registra como skipped (nenhum dos 3 sub-branches disparou)
    if (resultado.telemetria.camada_1 && resultado.telemetria.camada_1.status === 'not_executed') {
      marcarFimCamada(1, 'skipped', { reason: 'nenhum_branch_disparou' });
    }

    // CAMADA 3 — decisão de contexto.

    marcarInicioCamada(2);

    // GUARD HUMANO REAL: context.human_active depende de thread.last_human_message_at,
    // que pode não ter sido persistido no envio do atendente (caso Patrícia 03/07:
    // Tiago respondeu 09:37, campo ficou null, ACK saiu 09:40). Fonte de verdade
    // alternativa: mensagens reais da thread. Se um atendente humano (sender_id =
    // ObjectId de User, sem is_ack/is_ai_response/micro_intent) respondeu nos
    // últimos 60min, trata como humano ativo e faz backfill do campo.
    if (context.human_active !== true) {
      try {
        const _1hAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const _msgsRecentes = await base44.asServiceRole.entities.Message.filter({
          thread_id, sender_type: 'user', created_date: { $gte: _1hAtras }
        }, '-created_date', 10).catch(() => []);
        const _msgHumana = (_msgsRecentes || []).find(m =>
          /^[a-f0-9]{24}$/i.test(String(m.sender_id || ''))
          && m.metadata?.is_ack !== true
          && m.metadata?.is_ai_response !== true
          && m.metadata?.micro_intent !== true
        );
        if (_msgHumana) {
          context.human_active = true;
          const _tsHumana = _msgHumana.sent_at || _msgHumana.created_date;
          if (!threadInicial?.last_human_message_at || new Date(threadInicial.last_human_message_at) < new Date(_tsHumana)) {
            await base44.asServiceRole.entities.MessageThread.update(thread_id, { last_human_message_at: _tsHumana }).catch(() => {});
          }
          console.log(`[SKILL-PRE-ATEND] 👤 Guard humano real: mensagem humana recente na thread (${_msgHumana.sender_id}) — human_active=true`);
        }
      } catch (e) {
        console.warn('[SKILL-PRE-ATEND] Guard humano real falhou (não crítico):', e.message);
      }
    }

    // Camada 2 só bloqueia pipeline em horário comercial.
    const _horarioCfgC2 = await getHorarioCfgPipeline(base44);
    const _horarioInfoC2 = await getHorarioInfoPipeline(base44);
    resultado.conversation_state = await materializarConversationState(base44, {
      thread_id, contact_id, thread: threadInicial, contact: contactInicial, context,
      message_content, horarioInfo: _horarioInfoC2, horarioCfg: _horarioCfgC2
    }).catch(() => null);

    if (context.human_active === true) {
      if (_horarioInfoC2.dentro) {
        await acionarBrainCopiloto(base44, {
          thread_id, contact_id, message_id, message_content,
          integration_id, provider: payload.provider,
          reason: 'human_active_useful_intent'
        });
        // Horário comercial: humano realmente está ativo → notify only, return
        console.log(`[SKILL-PRE-ATEND] 👤 Camada 2: humano ativo + horário comercial — notify only`);
        if (threadInicial?.assigned_user_id) {
          try {
            await base44.asServiceRole.entities.NotificationEvent.create({
              tipo: 'mensagem_nao_lida',
              titulo: `Nova mensagem de ${contactInicial?.nome || 'contato'}`,
              mensagem: `Mensagem recebida com atendente humano ativo.`,
              prioridade: 'normal',
              usuario_id: threadInicial.assigned_user_id,
              entidade_relacionada: 'MessageThread',
              entidade_id: thread_id,
              origem: 'skill_camada_2_humano_ativo',
              metadata: {
                thread_id, contact_id, message_id,
                sector_id: threadInicial?.sector_id,
                origem: 'skill_camada_2'
              }
            }).catch(() => {});
          } catch (_) { /* silencioso */ }
        }

        await liberarEstadoThread(base44, threadInicial, 'early_return_camada2_humano_ativo');
        marcarFimCamada(2, 'skipped', { reason: 'human_active_observed' });
        return Response.json({ success: true, skipped: true, reason: 'human_active_observed', camadas: resultado.camadas, telemetria: resultado.telemetria }, { headers });
      }
      // Fora-horário: humano "ativo" provavelmente saiu → seguir até Camada 5
      console.log(`[SKILL-PRE-ATEND] 👤 Camada 2: humano ativo + fora-horário (${_horarioInfoC2.motivo}) — seguir para ACK informativo`);
    }

    // Thread atribuída + setor + não-novo-ciclo + texto longo (não micro)
    // Mesmo princípio do bloco anterior: só bloqueia em horário comercial.
    const textoMicroCheckCtx = (message_content || '').trim();
    const ehMicroIntentCtx = textoMicroCheckCtx.length > 0 && textoMicroCheckCtx.length <= 80;
    if (
      context.thread_assigned === true
      && context.sector_id
      && context.novo_ciclo === false
      && !ehMicroIntentCtx
    ) {
      if (_horarioInfoC2.dentro) {
        await acionarBrainCopiloto(base44, {
          thread_id, contact_id, message_id, message_content,
          integration_id, provider: payload.provider,
          reason: 'assigned_thread_useful_intent'
        });
        console.log(`[SKILL-PRE-ATEND] 🔔 Camada 2: thread contextualizada sem micro-intent + horário comercial — notify only`);
        if (threadInicial?.assigned_user_id) {
          try {
            await base44.asServiceRole.entities.NotificationEvent.create({
              tipo: 'mensagem_nao_lida',
              titulo: `Nova mensagem de ${contactInicial?.nome || 'contato'}`,
              mensagem: `Mensagem recebida em thread já atribuída.`,
              prioridade: 'normal',
              usuario_id: threadInicial.assigned_user_id,
              entidade_relacionada: 'MessageThread',
              entidade_id: thread_id,
              origem: 'skill_camada_2_contextualizada',
              metadata: {
                thread_id, contact_id, message_id,
                sector_id: context.sector_id,
                origem: 'skill_camada_2'
              }
            }).catch(() => {});
          } catch (_) { /* silencioso */ }
        }

        await liberarEstadoThread(base44, threadInicial, 'early_return_camada2_thread_contextualizada');
        marcarFimCamada(2, 'skipped', { reason: 'context_notify_only' });
        return Response.json({ success: true, skipped: true, reason: 'context_notify_only', camadas: resultado.camadas, telemetria: resultado.telemetria }, { headers });
      }
      console.log(`[SKILL-PRE-ATEND] 🔔 Camada 2: thread contextualizada + fora-horário (${_horarioInfoC2.motivo}) — seguir para ACK informativo`);
    }
    // Camada 2 passou sem early-return (ou em fora-horário, seguindo para Camada 5)
    marcarFimCamada(2, 'ok', { reason: 'pode_seguir_pipeline' });

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 4 — DEDUP / IDEMPOTENCY GUARD
    // ═══════════════════════════════════════════════════════════════════

    let thread = null;
    let contact = null;
    let integ = null;

    marcarInicioCamada(3);
    try {
      thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);

      // Guard 1: já atribuída?
      // EXCEÇÃO: em fora-horário/feriado, NÃO pular — precisamos enviar ACK informativo
      const _horarioCfgGuard = await getHorarioCfgPipeline(base44);
      const _horarioInfoGuard = await getHorarioInfoPipeline(base44);
      const foraHorarioOuFeriado = !_horarioInfoGuard.dentro;
      const ACK_FORA_HORARIO_GAP_MS = _horarioCfgGuard.gap_ack_fora_horario_ms;
      const DEDUP_WINDOW_MS = _horarioCfgGuard.dedup_window_ms;

      if (thread.assigned_user_id && thread.routing_stage === 'ASSIGNED' && !foraHorarioOuFeriado) {
        resultado.camadas.dedup = { skipped: true, reason: 'ja_atribuida' };
        console.log('[SKILL-PRE-ATEND] ⏭️ Thread já atribuída — skip (em horário comercial)');
        await liberarEstadoThread(base44, thread, 'early_return_camada3_ja_atribuida');
        await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'ja_atribuida');
        marcarFimCamada(3, 'skipped', { reason: 'ja_atribuida' });
        return Response.json({ ...resultado, success: true, skipped: true, reason: 'ja_atribuida', telemetria: resultado.telemetria }, { headers });
      }

      if (thread.assigned_user_id && thread.routing_stage === 'ASSIGNED' && foraHorarioOuFeriado) {
        // Cooldown universal: só bloqueia ACK fora-horário no mesmo dia BRT.
        // Virou o dia em São Paulo, inicia novo ciclo mesmo dentro de 12h.
        const brtDayKey = (value) => value
          ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
          : null;
        const ultAckDate = thread.last_outbound_at ? new Date(thread.last_outbound_at) : null;
        const inboundRefDate = thread.last_inbound_at ? new Date(thread.last_inbound_at) : new Date();
        const ackMesmoDia = ultAckDate && brtDayKey(ultAckDate) === brtDayKey(inboundRefDate);
        const ackRecente = ultAckDate && ackMesmoDia && (Date.now() - ultAckDate.getTime() < ACK_FORA_HORARIO_GAP_MS);
        if (ackRecente) {
          resultado.camadas.dedup = { ok: true, ack_recente: true, reason: 'fora_horario_ack_recente_30min_mesmo_dia' };
          console.log('[SKILL-PRE-ATEND] 🌙 Thread atribuída + fora-horário + ACK recente → segue sem skip total para detectar intenção');
        }
        console.log('[SKILL-PRE-ATEND] 🌙 Thread atribuída + fora-horário/feriado → seguir para ACK/intent controlado pela skill');
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
        console.log('[SKILL-PRE-ATEND] ⏭️ Pipeline recente detectado — dedup ativo');
        await liberarEstadoThread(base44, thread, 'early_return_camada3_pipeline_recente');
        await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'pipeline_recente');
        marcarFimCamada(3, 'skipped', { reason: 'pipeline_recente_30s' });
        return Response.json({ ...resultado, success: true, skipped: true, reason: 'pipeline_recente', telemetria: resultado.telemetria }, { headers });
      }

      // Gravar lock de execução
      await base44.asServiceRole.entities.AutomationLog.create({
        thread_id,
        contato_id: contact_id,
        acao: 'pipeline_atendimento_iniciado',
        resultado: 'em_progresso',
        origem: 'sistema',
        timestamp: new Date().toISOString(),
        detalhes: {
          mensagem: 'Lock dedup 30s ativado',
          dados_contexto: { message_id, camada: 'dedup_lock' }
        },
        metadata: { message_id, camada: 'dedup_lock' }
      }).catch(e => console.error('[SKILL-PRE-ATEND] 🔴 Falha ao gravar dedup lock:', e.message));

      resultado.camadas.dedup = { ok: true };
      console.log('[SKILL-PRE-ATEND] ✅ Camada 3 OK — dedup passou');
      marcarFimCamada(3, 'ok');

    } catch (e) {
      console.error('[SKILL-PRE-ATEND] Camada 3 erro:', e.message);
      resultado.camadas.dedup = { error: e.message };
      marcarFimCamada(3, 'error', { error: e.message });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 5 — MICRO-INTENTS (saudação/agradecimento/spam/mídia)
    // Early-return se detecta intent simples com atendente já atribuído
    // ═══════════════════════════════════════════════════════════════════

    marcarInicioCamada(4);
    try {
      const textoMicro = (message_content || thread?.last_message_content || '').trim();
      const mediaType = payload.media_type || null;
      const temMidia = mediaType && mediaType !== 'none' && mediaType !== 'text';
      const microIntent = detectarMicroIntent(textoMicro, temMidia);

      if (microIntent) {
        console.log(`[CAMADA-0-MICRO] 🎯 Detectado: ${microIntent.tipo} ("${microIntent.texto.substring(0, 40)}")`);

        // O cartão de Acessos Rápidos é disparado UMA ÚNICA VEZ, na Camada 5
        // (após o ACK). O disparo aqui na Camada 4 era redundante e causava
        // envio duplicado do menu (saudação dispara os dois, ambos com
        // source='skill_saudacao' que ignora o cooldown). Removido.

        // Mídia pura sem texto → silêncio (não responde, só loga)
        if (microIntent.tipo === 'midia_pura') {
          await logC4(base44, thread_id, contact_id, 'micro_intent_midia_pura', { mensagem: `Mídia ${mediaType} sem texto — silêncio`, media_type: mediaType, action: 'silent' });
          resultado.camadas.dedup.micro_intent = { tipo: 'midia_pura', action: 'silent' };
          console.log('[CAMADA-0-MICRO] 🔇 Mídia pura — silêncio');
          await liberarEstadoThread(base44, thread, 'early_return_camada4_midia_pura');
          await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'midia_pura_silent');
          marcarFimCamada(4, 'skipped', { reason: 'midia_pura_silent', micro_intent_tipo: 'midia_pura' });
          return Response.json({ ...resultado, success: true, skipped: true, reason: 'midia_pura_silent', micro_intent: microIntent, telemetria: resultado.telemetria }, { headers });
        }

        // Spam/prospecção → silêncio + log low-severity
        if (microIntent.tipo === 'spam_prospec') {
          await logC4(base44, thread_id, contact_id, 'micro_intent_spam_detectado', { mensagem: `Spam detectado: "${microIntent.texto.substring(0, 80)}"`, texto: microIntent.texto, action: 'silent' });
          resultado.camadas.dedup.micro_intent = { tipo: 'spam_prospec', action: 'silent' };
          console.log('[CAMADA-0-MICRO] 🚫 Spam detectado — silêncio');
          await liberarEstadoThread(base44, thread, 'early_return_camada4_spam_detectado');
          await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'spam_detectado');
          marcarFimCamada(4, 'skipped', { reason: 'spam_detectado', micro_intent_tipo: 'spam_prospec' });
          return Response.json({ ...resultado, success: true, skipped: true, reason: 'spam_detectado', micro_intent: microIntent, telemetria: resultado.telemetria }, { headers });
        }

        // Confirmação curta sem atendente → log informativo (cai no fluxo antigo)
        if (microIntent.tipo === 'confirmacao_curta' && !thread?.assigned_user_id) {
          await logC4(base44, thread_id, contact_id, 'micro_intent_confirmacao_sem_atendente', { mensagem: `Confirmação curta sem atendente: "${microIntent.texto}" — segue fluxo antigo`, texto: microIntent.texto, action: 'fallthrough_fluxo_antigo' });
          console.log('[CAMADA-0-MICRO] ⏭️ Confirmação sem atendente — segue fluxo normal');
        }

        // Patch 3: log saudação/agradecimento SEM atendente (fallthrough antes oculto)
        if ((microIntent.tipo === 'saudacao_pura' || microIntent.tipo === 'agradecimento') && !thread?.assigned_user_id) {
          await logC4(base44, thread_id, contact_id, 'micro_intent_saudacao_sem_atendente', { tipo: microIntent.tipo, action: 'fallthrough_sem_atendente', texto: microIntent.texto.substring(0, 80) });
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
            const _cfgMicro = await getHorarioCfgPipeline(base44);
            const _msgsMicro = await carregarMensagensAck(base44);
            // Hora em BRT (America/Sao_Paulo), não UTC — senão "Boa tarde" às 15h
            // virava "Boa noite" (18h UTC). Mesmo padrão usado na Camada 6.
            const hora = parseInt(new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false
            }).format(new Date()), 10);
            // Fonte única: avaliarHorarioComercial (via pipeline) já cobre
            // fim de semana + feriado + almoço + noite. O cálculo inline
            // anterior (só hora) tratava sábado/domingo diurno como "dentro"
            // e mandava o menu normal (com Setores) em vez do menu_fora_horario.
            const _horarioInfoMicro = await getHorarioInfoPipeline(base44);
            const foraHorario = !_horarioInfoMicro.dentro;
            const msg = gerarRespostaMicroIntent(microIntent.tipo, styleProfile, contactData.nome, hora, foraHorario, _cfgMicro, _msgsMicro);

            if (msg) {
              // Cooldown 2min: se já respondeu micro-intent recentemente, pula
              const doisMinAtras = new Date(Date.now() - 120_000).toISOString();
              const respRecente = await base44.asServiceRole.entities.Message.filter({
                thread_id, sender_type: 'user',
                'metadata.micro_intent': true,
                created_date: { $gte: doisMinAtras }
              }, '-created_date', 1).catch(() => []);

              if (respRecente.length > 0) {
                await logC4(base44, thread_id, contact_id, 'micro_intent_cooldown_skip', { acao: 'micro_intent_cooldown_skip', resultado: 'ignorado', camada: '4-micro', mensagem: `Cooldown 2min ativo — ${microIntent.tipo} ignorado`, tipo: microIntent.tipo, action: 'cooldown_skip_2min', ultima_resp_id: respRecente[0].id });
                console.log('[CAMADA-0-MICRO] ⏭️ Cooldown 2min ativo — skip');
                resultado.camadas.dedup.micro_intent = { tipo: microIntent.tipo, action: 'cooldown_skip' };
                await liberarEstadoThread(base44, thread, 'early_return_camada4_micro_intent_cooldown');
                await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'micro_intent_cooldown');
                marcarFimCamada(4, 'skipped', { reason: 'micro_intent_cooldown_2min', micro_intent_tipo: microIntent.tipo });
                return Response.json({ ...resultado, success: true, skipped: true, reason: 'micro_intent_cooldown', telemetria: resultado.telemetria }, { headers });
              }

              const { ok, msgId } = await enviarWhatsApp(integData, contactData.telefone, msg);
              if (!ok) await logC4(base44, thread_id, contact_id, 'micro_intent_envio_falhou', { tipo: microIntent.tipo, integration_id: integData.id, action: 'send_failed', erro: true });
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

                const ctxMicroResp = {
                  tipo: microIntent.tipo,
                  style_profile_usado: !!styleProfile,
                  style_profile_id: styleProfile?.id || null,
                  style_profile_display_name: styleProfile?.display_name || null,
                  atendente_id: thread.assigned_user_id,
                  camada: '0-micro',
                  fora_horario: foraHorario,
                  texto_recebido: microIntent.texto.substring(0, 100),
                  texto_enviado: msg.substring(0, 200),
                  whatsapp_msg_id: msgId,
                  tempo_execucao_ms: Date.now() - tsInicio
                };
                await base44.asServiceRole.entities.AutomationLog.create({
                  thread_id, contato_id: contact_id,
                  acao: `micro_intent_${microIntent.tipo}`,
                  resultado: 'sucesso',
                  origem: 'sistema',
                  timestamp: new Date().toISOString(),
                  detalhes: {
                    tempo_execucao_ms: Date.now() - tsInicio,
                    mensagem: `${microIntent.tipo} respondido ${styleProfile ? 'no estilo ' + styleProfile.display_name : '(genérico)'} | recebido: "${microIntent.texto.substring(0, 60)}" | enviado: "${msg.substring(0, 80)}"`,
                    dados_contexto: ctxMicroResp
                  },
                  metadata: ctxMicroResp
                }).catch(e => console.error(`[CAMADA-0-MICRO] log ${microIntent.tipo} falhou:`, e.message));

                resultado.camadas.dedup.micro_intent = { tipo: microIntent.tipo, action: 'responded', style_profile_used: !!styleProfile };
                console.log(`[CAMADA-0-MICRO] ✅ Respondido ${microIntent.tipo} ${styleProfile ? 'no estilo ' + styleProfile.display_name : '(genérico)'}`);

                // CARTÃO DE ACESSOS RÁPIDOS junto da saudação (thread já atribuída):
                // dispara o menu UMA VEZ aqui pois este branch faz early-return e
                // NÃO chega à Camada 5. Sem este disparo, saudação em thread
                // atribuída não traria o menu. Fire-and-forget.
                const _integCartaoC4 = integration_id || thread?.whatsapp_integration_id || null;
                if (microIntent.tipo === 'saudacao_pura' && _integCartaoC4) {
                  // Mesma decisão de fase da Camada 5: fora do expediente manda
                  // os LINKS DIRETOS (menu_fora_horario, sem Setores), pois não há
                  // atendente nos setores fora-horário. Em horário comercial,
                  // mantém o menu de 3 categorias (skill_saudacao).
                  const _payloadCartaoC4 = foraHorario
                    ? { acao: 'menu_fora_horario', thread_id, contact_id, integration_id: _integCartaoC4 }
                    : { thread_id, contact_id, integration_id: _integCartaoC4, source: 'skill_saudacao' };
                  base44.asServiceRole.functions.invoke('enviarCartaoAcesso', _payloadCartaoC4)
                    .catch(e => console.warn('[CAMADA-0-MICRO] cartão acesso (saudação) falhou:', e.message));
                }

                await liberarEstadoThread(base44, thread, 'early_return_camada4_micro_intent_responded');
                await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'micro_intent_responded');
                marcarFimCamada(4, 'ok', { reason: 'micro_intent_responded', micro_intent_tipo: microIntent.tipo, style_profile_used: !!styleProfile });
                return Response.json({ ...resultado, success: true, action: 'micro_intent_responded', micro_intent: microIntent, tempo_ms: Date.now() - tsInicio, telemetria: resultado.telemetria }, { headers });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[CAMADA-0-MICRO] ⚠️ Erro (não crítico, segue fluxo):', e.message);
      // Log do erro para observabilidade — se ele próprio falhar, só pega no console
      try {
        await base44.asServiceRole.entities.AutomationLog.create({
          thread_id, contato_id: contact_id,
          acao: 'micro_intent_erro',
          resultado: 'erro',
          origem: 'sistema',
          timestamp: new Date().toISOString(),
          detalhes: {
            mensagem: `Erro CAMADA 0-MICRO: ${e.message}`,
            erro_mensagem: e.message,
            dados_contexto: { erro: e.message, stack: (e.stack || '').substring(0, 500), camada: '0-micro' }
          },
          metadata: { erro: e.message, stack: (e.stack || '').substring(0, 500), camada: '0-micro' }
        });
      } catch (logErr) {
        console.error('[CAMADA-0-MICRO] 🔴 LOG DE ERRO TAMBÉM FALHOU:', logErr.message);
      }
      marcarFimCamada(4, 'error', { error: e.message });
    }
    // Camada 4 sem micro-intent — segue fluxo (Patch 3: texto_len p/ queries)
    if (resultado.telemetria.camada_4 && resultado.telemetria.camada_4.status === 'not_executed') {
      marcarFimCamada(4, 'skipped', { reason: 'nenhum_micro_intent', texto_len: (message_content || thread?.last_message_content || '').trim().length, fallthrough: true });
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
      console.error('[SKILL-PRE-ATEND] Pré-carga falhou:', e.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 6 — ACK ADAPTATIVO (fire & forget — falha NÃO para pipeline)
    // ═══════════════════════════════════════════════════════════════════

    marcarInicioCamada(5);
    try {
      if (!integ) throw new Error('sem_integracao');
      if (!integ.instance_id_provider || !integ.api_key_provider) throw new Error('credenciais_invalidas');
      if (integ.api_provider === 'z_api' && !integ.security_client_token_header) throw new Error('zapi_sem_client_token');

      const horarioCfg = await getHorarioCfgPipeline(base44);
      const mensagensAck = await carregarMensagensAck(base44);
      const horarioInfo = await getHorarioInfoPipeline(base44);
      const isVIP = contact?.is_vip || false;

      // Cooldown adaptativo: fora-horário usa gap_ack, horário comercial usa cooldown_ack
      const cooldownAplicado = horarioInfo.dentro ? horarioCfg.cooldown_ack_ms : horarioCfg.gap_ack_fora_horario_ms;
      const cooldownLabel = horarioInfo.dentro
        ? `${(horarioCfg.cooldown_ack_ms / 60000).toFixed(0)}min`
        : `${(horarioCfg.gap_ack_fora_horario_ms / 60000).toFixed(0)}min`;
      const PROMO_FORA_HORARIO_GAP_MS = horarioCfg.gap_promo_fora_horario_ms;

      if (thread?.last_outbound_at) {
        const brtDayKeyAck = (value) => value
          ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
          : null;
        const lastOutboundDate = new Date(thread.last_outbound_at);
        const inboundRefDate = thread.last_inbound_at ? new Date(thread.last_inbound_at) : new Date();
        const mesmoDiaBrt = brtDayKeyAck(lastOutboundDate) === brtDayKeyAck(inboundRefDate);
        const deveAplicarCooldown = horarioInfo.dentro || mesmoDiaBrt;
        const diffMs = Date.now() - lastOutboundDate.getTime();
        if (deveAplicarCooldown && diffMs < cooldownAplicado) {
          resultado.camadas.ack = { skipped: true, reason: `cooldown_${cooldownLabel}` };
          await registrarEventoPreAtendimento(base44, thread_id, contact_id, 'ack_skipped_cooldown', {
            mensagem: `ACK pulado por cooldown ativo (${cooldownLabel})`,
            cooldown_label: cooldownLabel,
            horario_motivo: horarioInfo.motivo,
            source: 'last_outbound_at',
            resultado: 'ignorado'
          });
          console.log(`[SKILL-PRE-ATEND] ⏭️ ACK cooldown ativo (${cooldownLabel})`);
          throw new Error('__skip_ack');
        }
      }

      // Dedup: ACK já existe? (busca por metadata.is_ack=true — mais robusto que sender_id)
      const cooldownAtras = new Date(Date.now() - cooldownAplicado).toISOString();
      const ackRecente = await base44.asServiceRole.entities.Message.filter({
        thread_id,
        'metadata.is_ack': true,
        created_date: { $gte: cooldownAtras }
      }, '-created_date', 1).catch(() => []);

      if (ackRecente.length > 0) {
        resultado.camadas.ack = { skipped: true, reason: `ack_recente_db_${cooldownLabel}` };
        await registrarEventoPreAtendimento(base44, thread_id, contact_id, 'ack_skipped_cooldown', {
          mensagem: `ACK pulado por registro recente no banco (${cooldownLabel})`,
          cooldown_label: cooldownLabel,
          horario_motivo: horarioInfo.motivo,
          source: 'metadata.is_ack',
          ultima_msg_id: ackRecente[0]?.id,
          resultado: 'ignorado'
        });
        console.log(`[SKILL-PRE-ATEND] ⏭️ ACK recente no DB (${cooldownLabel}) — skip`);
        throw new Error('__skip_ack');
      }

      const ack = buildAckMsg(contact?.tipo_contato, contact?.nome, isVIP, horarioInfo, mensagensAck);

      // ─── Caminho B (Sprint 1.3): ACK puro. Promoção SEMPRE em mensagem
      // separada via skillPromocoes (fire-and-forget). Pré-atendimento não
      // formata, não anexa, não persiste estado promocional.
      let msgFinal = ack.msg;
      let primeiroContatoDoDia = false;

      if (ack.tipo === 'fora_horario') {
        const ultPromoInbound = thread?.last_promo_inbound_at;
        const promoRecente = ultPromoInbound &&
          (Date.now() - new Date(ultPromoInbound).getTime() < PROMO_FORA_HORARIO_GAP_MS);

        // Caminho B: promoção sai em MENSAGEM SEPARADA via skillPromocoes,
        // fire-and-forget. Pré-atendimento não decide nem formata promoção.
        // Disparado APÓS o envio do ACK, abaixo. Aqui só sinalizamos a intenção.
        if (!promoRecente && integ?.id) {
          base44.asServiceRole.functions.invoke('skillPromocoes', {
            action: 'sugerir_ou_enviar',
            origem: 'pre_atendimento',
            contexto: 'fora_horario',
            contact_id,
            thread_id,
            integration_id: integ.id,
            initiated_by: 'skillPreAtendimentos:ack_fora_horario'
          }).catch(e => console.warn('[SKILL-PRE-ATEND] sugerir_ou_enviar falhou (não-crítico):', e.message));
        }

        if (promoRecente) {
          await registrarEventoPreAtendimento(base44, thread_id, contact_id, 'promo_skipped_cooldown', {
            mensagem: 'Promoção pulada por cooldown fora-horário ativo',
            cooldown_label: `${(PROMO_FORA_HORARIO_GAP_MS / 3600000).toFixed(0)}h`,
            last_promo_inbound_at: ultPromoInbound,
            resultado: 'ignorado'
          });
          // Já mandou vídeo+promo nas últimas 12h. NÃO é silêncio total —
          // mensagem #2+ do mesmo período fora-horário deve detectar intent e
          // responder de forma útil (sem repetir vídeo nem promo).
          // Princípio "árbitro único": a skill arbitra que mensagem #2 recebe
          // resposta contextual em vez de silêncio.
          const textoIntent = (message_content || '').toLowerCase().trim();
          let intentForaHorario = null;
          for (const p of PATTERNS) {
            if (p.regex.test(textoIntent)) { intentForaHorario = p; break; }
          }

          if (intentForaHorario && textoIntent.length > 0) {
            // Resposta contextual fora-horário por setor (template via ConfiguracaoSistema)
            const chaveResposta = `resposta_fora_horario_intent_${intentForaHorario.setor}`;
            const respostaIntent = mensagensAck[chaveResposta]
              || mensagensAck.resposta_fora_horario_intent_geral
              || 'Recebi sua mensagem! Retornamos no próximo expediente.'; // fallback hardcoded mínimo

            const { ok: okI, msgId: msgIdI } = await enviarWhatsApp(integ, contact.telefone, respostaIntent);
            if (okI) {
              await base44.asServiceRole.entities.Message.create({
                thread_id, sender_id: 'skill_ack', sender_type: 'user',
                recipient_id: contact_id, recipient_type: 'contact',
                content: respostaIntent, channel: 'whatsapp', status: 'enviada',
                sent_at: new Date().toISOString(), visibility: 'public_to_customer',
                metadata: { is_ack: true, ack_tipo: 'fora_horario_intent', intent_setor: intentForaHorario.setor, whatsapp_msg_id: msgIdI }
              }).catch(() => {});
              await base44.asServiceRole.entities.MessageThread.update(thread_id, {
                last_outbound_at: new Date().toISOString(),
                last_message_at: new Date().toISOString(),
                last_message_sender: 'user',
                last_message_content: respostaIntent.substring(0, 100)
              }).catch(() => {});
              resultado.camadas.ack = { ok: true, tipo: 'fora_horario_intent', setor: intentForaHorario.setor, msgId: msgIdI };
              console.log(`[SKILL-PRE-ATEND] ✅ Fora-horário msg #2+: resposta intent (${intentForaHorario.setor})`);
            } else {
              resultado.camadas.ack = { skipped: true, reason: 'fora_horario_intent_send_failed' };
            }
            throw new Error('__skip_ack'); // pula resto da Camada 1 (já respondeu)
          }

          // Sem intent detectado em mensagem #2+ → silêncio (mantém comportamento atual)
          resultado.camadas.ack = { skipped: true, reason: 'fora_horario_ack_promo_recente_sem_intent' };
          console.log('[SKILL-PRE-ATEND] ⏭️ Fora-horário msg #2+: ACK/promo recentes e sem intent detectado — silêncio');
          throw new Error('__skip_ack');
        }

        // Caminho B (Sprint 1.3): ACK fora-horário vai PURO. A promo já foi
        // disparada acima via skillPromocoes (mensagem separada). Pré-atendimento
        // não decide, não formata, não persiste estado promocional.
        console.log('[SKILL-PRE-ATEND] 🌙 Fora-horário: ACK puro (promo via skillPromocoes em msg separada)');
      } else if (horarioInfo.dentro) {
        // Detectar primeiro contato do dia (BRT). NÃO usar thread.last_inbound_at:
        // o webhook ATUALIZA last_inbound_at antes desta skill rodar, então ele
        // sempre reflete a mensagem atual e o cálculo daria falso negativo.
        // Solução: consultar Message desde 00:00 BRT excluindo o message_id atual.
        //
        // 00:00 BRT = 03:00:00Z UTC (BRT é UTC-3, sem horário de verão).
        const agoraUtc = new Date();
        const brtDateParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(agoraUtc); // ex: "2026-05-28"
        const inicioHojeBrtIso = `${brtDateParts}T03:00:00.000Z`;
        const horaBrt = parseInt(new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false
        }).format(agoraUtc), 10);
        const agoraBrt = { getHours: () => horaBrt }; // shim para getHours() abaixo

        try {
          const inboundsHoje = await base44.asServiceRole.entities.Message.filter({
            thread_id,
            sender_type: 'contact',
            created_date: { $gte: inicioHojeBrtIso }
          }, '-created_date', 5).catch(() => []);
          const outrosInbounds = (inboundsHoje || []).filter(m => m.id !== message_id);
          primeiroContatoDoDia = outrosInbounds.length === 0;
        } catch (e) {
          // Falha de query → fallback conservador para o critério antigo (não envia se incerto)
          console.warn('[SKILL-PRE-ATEND] primeiro_contato_dia: query falhou, fallback conservador:', e.message);
          primeiroContatoDoDia = false;
        }

        // Cooldown universal 12h (mesmo critério das outras promos)
        const ultAnyPromo = contact?.last_any_promo_sent_at || thread?.last_any_promo_sent_at;
        const promoCooldownAtivo = ultAnyPromo &&
          (Date.now() - new Date(ultAnyPromo).getTime() < PROMO_FORA_HORARIO_GAP_MS);

        if (primeiroContatoDoDia && !promoCooldownAtivo) {
          // Saudação personalizada com nome + período do dia (template via banco)
          const primeiroNome = (contact?.nome || '').split(' ')[0] || '';
          const saudacao = horaBrt < 12 ? 'Bom dia' : (horaBrt < 18 ? 'Boa tarde' : 'Boa noite');
          const tplSaudacao = mensagensAck.saudacao_primeiro_contato_dia_template
            || (primeiroNome ? '☀️ {{saudacao}}, {{primeiro_nome}}! ' : '☀️ {{saudacao}}! ');
          const saudacaoComNome = tplSaudacao
            .replace(/\{\{\s*saudacao\s*\}\}/g, saudacao)
            .replace(/\{\{\s*primeiro_nome\s*\}\}/g, primeiroNome)
            .replace(/\{\{\s*nome_com_virgula\s*\}\}/g, primeiroNome ? ', ' + primeiroNome : '');

          // Caminho B: ACK personalizado vai PURO. Promo sai em mensagem
          // separada chamando enviarPromocao DIRETO (skillPromocoes era apenas
          // adaptador que adicionava um hop server-to-server passível de 403).
          // Evita redundância: remove saudação duplicada do início do ACK
          // (ex: "👋 Olá Fulano!" / "Olá!" / "Oi Fulano,") já que a saudação
          // do dia ("Bom dia, Fulano!") será o prefixo da mensagem.
          const nomeEsc = primeiroNome ? primeiroNome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
          const regexSaudacaoAck = new RegExp(
            `^[\\s👋☀️🌙😊]*((ol[áa]|oi|bom\\s*dia|boa\\s*tarde|boa\\s*noite)[,!\\s]*(${nomeEsc}|${(contact?.nome || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})?[,!.\\s]*)+`,
            'i'
          );
          const ackSemSaudacao = ack.msg.replace(regexSaudacaoAck, '').trim();
          const corpoAck = ackSemSaudacao.length >= 10 ? ackSemSaudacao : ack.msg;
          msgFinal = corpoAck === ack.msg ? saudacaoComNome + ack.msg : `${saudacaoComNome.trim()} ${corpoAck.charAt(0).toUpperCase()}${corpoAck.slice(1)}`;
          console.log('[SKILL-PRE-ATEND] 🌅 1º contato do dia: ACK personalizado (promo via enviarPromocao em msg separada)');

          if (integ?.id) {
            base44.asServiceRole.functions.invoke('enviarPromocao', {
              contact_id,
              thread_id,
              integration_id: integ.id,
              trigger: 'inbound_6h',
              campaign_id: 'pre_atendimento_primeiro_contato_dia',
              initiated_by: 'skillPreAtendimentos:primeiro_contato_dia'
            }).catch(e => console.warn('[SKILL-PRE-ATEND] enviarPromocao primeiro_contato_dia falhou (não-crítico):', e.message));
          }
        }
      }

      // Se fora-horário e há vídeo de pré-atendimento ativo: envia vídeo + caption (ACK+promo)
      let videoConfig = null;
      if (ack.tipo === 'fora_horario') {
        try {
          const configs = await base44.asServiceRole.entities.ConfiguracaoMidiaSistema.filter({
            id_chave: 'pre_atendimento_logo_animado', ativa: true
          }, '-updated_date', 1);
          if (configs?.[0]?.url && (configs[0].tipo === 'video' || configs[0].tipo === 'gif')) {
            videoConfig = configs[0];
          }
        } catch (e) {
          console.warn('[SKILL-PRE-ATEND] Falha ao buscar vídeo:', e.message);
        }
      }

      const { ok, msgId, raw } = videoConfig
        ? await enviarWhatsAppMidia(integ, contact.telefone, videoConfig.url, msgFinal, 'video')
        : await enviarWhatsApp(integ, contact.telefone, msgFinal);

      if (!ok) {
        console.warn('[SKILL-PRE-ATEND] ⚠️ ACK envio falhou (NÃO CRÍTICO):', JSON.stringify(raw));
        resultado.camadas.ack = { error: 'send_failed', raw };
        // NÃO THROW — pipeline continua
      } else {
        await base44.asServiceRole.entities.Message.create({
          thread_id, sender_id: 'skill_ack', sender_type: 'user',
          recipient_id: contact_id, recipient_type: 'contact',
          content: msgFinal, channel: 'whatsapp', status: 'enviada',
          sent_at: new Date().toISOString(), visibility: 'public_to_customer',
          media_url: videoConfig?.url || null,
          media_type: videoConfig ? 'video' : 'none',
          media_caption: videoConfig ? msgFinal : null,
          metadata: {
            is_ack: true, ack_tipo: ack.tipo, whatsapp_msg_id: msgId,
            horario_motivo: horarioInfo.motivo,
            video_anexado: !!videoConfig
          }
        }).catch(() => {});

        // Caminho B (Sprint 1.4): pré-atendimento atualiza APENAS estado de
        // mensagem. Estado promocional (last_promo_*, last_any_promo_sent_at,
        // last_promo_ids) é responsabilidade EXCLUSIVA do motor enviarPromocao.
        await base44.asServiceRole.entities.MessageThread.update(thread_id, {
          last_outbound_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          last_message_sender: 'user',
          last_message_content: msgFinal.substring(0, 100)
        }).catch(() => {});

        resultado.camadas.ack = {
          ok: true, tipo: ack.tipo, msgId,
          horario_motivo: horarioInfo.motivo,
          video_anexado: !!videoConfig
        };
        await registrarEventoPreAtendimento(base44, thread_id, contact_id, 'ack_sent', {
          mensagem: `ACK enviado (${ack.tipo}/${horarioInfo.motivo})`,
          ack_tipo: ack.tipo,
          horario_motivo: horarioInfo.motivo,
          video_anexado: !!videoConfig,
          whatsapp_msg_id: msgId
        });
        console.log(`[SKILL-PRE-ATEND] ✅ Camada 6 OK — ACK enviado (${ack.tipo}/${horarioInfo.motivo}${videoConfig ? ' + video' : ''})`);

        // ── SAUDAÇÃO+CARTÃO DETERMINÍSTICO ──
        // A skill é a dona única. Após o ACK, dispara o cartão de Acessos Rápidos
        // EM SEQUÊNCIA (fire-and-forget). Só na 1ª saudação do ciclo e se ainda
        // não foi enviado nesta thread. Substitui a automação paralela (desligada)
        // que competia com este ACK via GUARD OUTBOUND 30s.
        const textoSaud = (message_content || '').toLowerCase().trim();
        const ehSaudacaoCartao = /(^|\b)(oi+|ol[aá]+|opa|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*a[ií]|eai)(\b|$|[\s!.,?])/.test(textoSaud);

        // FORA DE HORÁRIO: após o vídeo/ACK, manda os ACESSOS RÁPIDOS de links
        // (Promoções/Web Site + Redes) automaticamente — sem menu de categorias
        // e sem Setores, pois não há atendente nos setores fora do expediente.
        // O cliente navega no autoatendimento. Guard 1x/dia BRT na própria função.
        if (ack.tipo === 'fora_horario' && integ?.id) {
          base44.asServiceRole.functions.invoke('enviarCartaoAcesso', {
            acao: 'menu_fora_horario',
            thread_id, contact_id, integration_id: integ.id
          }).catch(e => console.warn('[SKILL-PRE-ATEND] menu fora-horário falhou (não-crítico):', e.message));
        } else if (ehSaudacaoCartao && integ?.id) {
          base44.asServiceRole.functions.invoke('enviarCartaoAcesso', {
            thread_id, contact_id, integration_id: integ.id, source: 'skill_saudacao'
          }).catch(e => console.warn('[SKILL-PRE-ATEND] cartão acesso falhou (não-crítico):', e.message));
        }
      }
    } catch (e) {
      if (e.message !== '__skip_ack') {
        console.warn('[SKILL-PRE-ATEND] Camada 1 erro (não crítico):', e.message);
        resultado.camadas.ack = resultado.camadas.ack || { error: e.message };
      }
      // NÃO THROW — pipeline sempre continua
    }
    // Marca fim da Camada 5 conforme o resultado final (ok/skipped/error)
    {
      const ackEntry = resultado.camadas.ack || {};
      if (ackEntry.ok) marcarFimCamada(5, 'ok', { tipo: ackEntry.tipo, motivo: ackEntry.horario_motivo });
      else if (ackEntry.skipped) marcarFimCamada(5, 'skipped', { reason: ackEntry.reason });
      else if (ackEntry.error) marcarFimCamada(5, 'error', { error: ackEntry.error || ackEntry.reason });
      else marcarFimCamada(5, 'skipped', { reason: 'nao_executado' });
    }

    // ─── Se thread já atribuída + fora-horário: parou aqui (só ACK informativo) ───
    // Não executa Intent/Routing/Atribuição porque atendente já existe
    if (thread.assigned_user_id && thread.routing_stage === 'ASSIGNED') {
      console.log('[SKILL-PRE-ATEND] 🌙 Pipeline encerrado após ACK fora-horário (thread já atribuída)');
      resultado.success = true;
      await liberarEstadoThread(base44, thread, 'early_return_camada5_ack_fora_horario_thread_atribuida');
      await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'ack_fora_horario_thread_atribuida');
      return Response.json({
        ...resultado,
        action: 'ack_fora_horario_atribuida',
        atendente_existente: thread.assigned_user_id,
        tempo_ms: Date.now() - tsInicio,
        telemetria: resultado.telemetria
      }, { headers });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 7 — INTENT DETECTION (pattern match → LLM fallback)
    // ═══════════════════════════════════════════════════════════════════

    let setor = SETOR_DEFAULT;
    let intencao = 'contato_geral';
    let confidence = 0.5;
    let metodo = 'fallback';
    // CONTEXTO CONVERSACIONAL: classificar usando as últimas mensagens do cliente,
    // não só a atual — "026.280.379-80" isolado virava "financeiro" mesmo com
    // pedido de monitor 2 mensagens antes (caso Patrícia 03/07).
    let textoAnalise = (message_content || thread?.last_message_content || '').substring(0, 500);
    try {
      const _inbounds = await base44.asServiceRole.entities.Message.filter({
        thread_id, sender_type: 'contact'
      }, '-created_date', 5).catch(() => []);
      if (Array.isArray(_inbounds) && _inbounds.length > 1) {
        const _contexto = _inbounds.reverse().map(m => (m.content || '').trim()).filter(Boolean).join('\n');
        if (_contexto.length > (message_content || '').trim().length) {
          textoAnalise = _contexto.substring(0, 500);
        }
      }
    } catch (_) { /* mantém textoAnalise da mensagem atual */ }

    marcarInicioCamada(6);
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
          console.warn('[SKILL-PRE-ATEND] LLM falhou, usando setor anterior ou default:', e.message);
          setor = setorAnterior || SETOR_DEFAULT;
        }
      }

      // Atendente fidelizado para o setor
      const campoFid = `atendente_fidelizado_${setor}`;
      const atendenteFidelizadoId = contact?.[campoFid] && /^[a-f0-9]{24}$/i.test(String(contact[campoFid]))
        ? String(contact[campoFid])
        : null;

      resultado.camadas.intent = { ok: true, setor, intencao, confidence, metodo, atendenteFidelizadoId };
      console.log(`[SKILL-PRE-ATEND] ✅ Camada 6 OK — setor: ${setor} (${metodo}, conf: ${(confidence * 100).toFixed(0)}%)`);

      await registrarEventoPreAtendimento(base44, thread_id, contact_id, 'intent_detected_after_ack', {
        mensagem: `Intenção detectada: ${intencao} / ${setor}`,
        setor,
        intencao,
        confidence,
        metodo,
        ack_context: resultado.camadas.ack || null,
        ack_recente: resultado.camadas.dedup?.ack_recente === true
      });

      // Atualizar thread
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        sector_id: setor,
        routing_stage: 'INTENT_DETECTED'
      }).catch(e => console.warn('[SKILL-PRE-ATEND] Falha ao setar sector_id:', e.message));

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
      console.error('[SKILL-PRE-ATEND] Camada 6 erro:', e.message);
      resultado.camadas.intent = { error: e.message, setor_fallback: setor };
      marcarFimCamada(6, 'error', { error: e.message, setor_fallback: setor });
    }
    if (resultado.telemetria.camada_6 && resultado.telemetria.camada_6.status === 'not_executed') {
      marcarFimCamada(6, 'ok', { setor, metodo, confidence });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 8 — QUALIFICAÇÃO via PreAtendimentoRule
    // Avalia regras configuradas no banco e aplica efeitos (bloqueio, rota
    // forçada, mensagem custom). Falha desta camada NÃO interrompe pipeline.
    // ═══════════════════════════════════════════════════════════════════

    let regraAplicada = null;
    let forcarFidelizado = false;

    marcarInicioCamada(7);
    try {
      const respRegras = await base44.asServiceRole.functions.invoke('aplicarPreAtendimentoRules', {
        thread_id, contact_id,
        setor_detectado: setor,
        intencao,
        confidence,
        message_content: textoAnalise
      });

      const dataRegras = respRegras?.data || respRegras;
      if (dataRegras?.matched && dataRegras?.rule) {
        regraAplicada = dataRegras.rule;
        const acao = regraAplicada.tipo_acao;
        const cfg = regraAplicada.acao_configuracao || {};

        console.log(`[SKILL-PRE-ATEND] 🎯 Camada 7 — regra "${regraAplicada.nome}" (${acao})`);

        // BLOQUEAR: encerra pipeline silenciosamente
        if (acao === 'bloquear') {
          if (cfg.mensagem_resposta && integ && contact?.telefone) {
            await enviarWhatsApp(integ, contact.telefone, cfg.mensagem_resposta).catch(() => {});
          }
          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            routing_stage: 'COMPLETED',
            pre_atendimento_state: 'CANCELLED',
            pre_atendimento_ativo: false
          }).catch(() => {});
          resultado.camadas.qualificacao = { ok: true, regra: regraAplicada.nome, acao: 'bloqueado' };
          resultado.success = true;
          marcarFimCamada(7, 'routed_out', { regra: regraAplicada.nome, acao: 'bloqueado' });
          await liberarEstadoThread(base44, { ...thread, id: thread_id, contact_id, routing_stage: 'COMPLETED', pre_atendimento_ativo: false }, 'early_return_camada7_bloqueado_por_regra');
          await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'bloqueado_por_regra');
          return Response.json({ ...resultado, action: 'bloqueado_por_regra', regra: regraAplicada.nome, telemetria: resultado.telemetria }, { headers });
        }

        // ENVIAR_MENSAGEM: envia texto custom e segue para enfileiramento padrão
        if (acao === 'enviar_mensagem' && cfg.mensagem_resposta && integ && contact?.telefone) {
          const { ok, msgId } = await enviarWhatsApp(integ, contact.telefone, cfg.mensagem_resposta);
          if (ok) {
            await base44.asServiceRole.entities.Message.create({
              thread_id, sender_id: 'pre_atendimento_rule', sender_type: 'user',
              recipient_id: contact_id, recipient_type: 'contact',
              content: cfg.mensagem_resposta, channel: 'whatsapp', status: 'enviada',
              sent_at: new Date().toISOString(), visibility: 'public_to_customer',
              metadata: { is_ai_response: true, regra_id: regraAplicada.id, regra_nome: regraAplicada.nome, whatsapp_msg_id: msgId }
            }).catch(() => {});
            await base44.asServiceRole.entities.MessageThread.update(thread_id, {
              last_outbound_at: new Date().toISOString(),
              last_message_at: new Date().toISOString(),
              last_message_sender: 'user',
              last_message_content: cfg.mensagem_resposta.substring(0, 100)
            }).catch(() => {});
          }
        }

        // ROTEAR_DIRETO: força setor de destino e/ou atendente fidelizado
        if (acao === 'rotear_direto') {
          if (cfg.setor_destino) setor = cfg.setor_destino;
          if (cfg.buscar_atendente_fidelizado) forcarFidelizado = true;
        }
      }

      resultado.camadas.qualificacao = {
        ok: true,
        regra: regraAplicada?.nome || null,
        acao: regraAplicada?.tipo_acao || 'seguir_fluxo_padrao'
      };
      marcarFimCamada(7, 'ok', {
        regra: regraAplicada?.nome || null,
        acao: regraAplicada?.tipo_acao || 'seguir_fluxo_padrao'
      });
    } catch (e) {
      console.warn('[SKILL-PRE-ATEND] Camada 7 erro (não crítico):', e.message);
      resultado.camadas.qualificacao = { error: e.message };
      marcarFimCamada(7, 'error', { error: e.message });
    }

    // CAMADA 9 — roteamento por prioridade.

    let atendente = null;
    let motivoAtribuicao = null;
    const atendenteFidelizadoId = resultado.camadas.intent?.atendenteFidelizadoId || null;

    marcarInicioCamada(8);
    try {
      // P0: Regra PreAtendimentoRule forçou buscar fidelizado → tem prioridade máxima
      if (forcarFidelizado && atendenteFidelizadoId) {
        const fidelizado = atendentes.find(u => u.id === atendenteFidelizadoId);
        if (fidelizado) {
          atendente = fidelizado;
          motivoAtribuicao = 'regra_pre_atendimento_fidelizado';
          console.log(`[SKILL-PRE-ATEND] 🎯 Regra forçou fidelizado: ${atendente.full_name}`);
        }
      }

      // P1: Nome mencionado na mensagem (tem prioridade máxima — intenção explícita do cliente)
      if (!atendente) {
        atendente = await detectarAtendenteMencionado(base44, textoAnalise, atendentes);
        if (atendente) motivoAtribuicao = 'mencionado_na_mensagem';
      }

      // P2: Fidelizado
      if (!atendente && atendenteFidelizadoId) {
        const fidelizado = atendentes.find(u => u.id === atendenteFidelizadoId);
        if (fidelizado) {
          atendente = fidelizado;
          motivoAtribuicao = 'fidelizado';
          console.log(`[SKILL-PRE-ATEND] 🎯 Fidelizado: ${atendente.full_name}`);
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

      // P5.1: NENHUM contato fica preso — se o setor detectado não tem
      // atendente, cai SEMPRE em vendas (área comercial distribui depois).
      if (!atendente && setor !== 'vendas') {
        atendente = await buscarAtendentePorSetor(base44, 'vendas', atendentes);
        if (atendente) { setor = 'vendas'; motivoAtribuicao = 'fallback_comercial'; }
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
        console.log(`[SKILL-PRE-ATEND] 📋 Camada 8 — sem atendente em ${setor}, enfileirado`);
        marcarFimCamada(8, 'routed_out', { action: 'enfileirado', setor, motivo: 'sem_atendente_disponivel' });

        await liberarEstadoThread(base44, { ...thread, id: thread_id, contact_id, routing_stage: 'ROUTED', pre_atendimento_ativo: false }, 'early_return_camada8_enfileirado');
        await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'enfileirado');
        return Response.json({ ...resultado, action: 'enfileirado', setor, telemetria: resultado.telemetria }, { headers });
      }

      resultado.camadas.routing = { ok: true, atendente: atendente.full_name, setor, motivo: motivoAtribuicao };
      console.log(`[SKILL-PRE-ATEND] ✅ Camada 8 OK — atendente: ${atendente.full_name} (motivo: ${motivoAtribuicao})`);
      marcarFimCamada(8, 'ok', { atendente_id: atendente.id, setor, motivo: motivoAtribuicao });

    } catch (e) {
      console.error('[SKILL-PRE-ATEND] Camada 8 erro:', e.message);
      resultado.camadas.routing = { error: e.message };
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id, thread_id,
        tipo: 'manual', reason: 'routing_falhou', severity: 'high', status: 'open',
        notes: `Erro no roteamento: ${e.message}`
      }).catch(() => {});
      resultado.success = false;
      marcarFimCamada(8, 'error', { error: e.message });
      await liberarEstadoThread(base44, thread || { id: thread_id, contact_id }, 'early_return_camada8_erro_routing');
      await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'erro_routing');
      return Response.json({ ...resultado, error: 'routing_falhou', telemetria: resultado.telemetria }, { status: 500, headers });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMADA 10 — ATRIBUIÇÃO + BOAS-VINDAS
    // ═══════════════════════════════════════════════════════════════════

    marcarInicioCamada(9);
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

      console.log(`[SKILL-PRE-ATEND] ✅ Atribuído para ${atendente.full_name} em ${setor} (motivo: ${motivoAtribuicao})`);

      // ACK + LLM nunca saem juntos.
      const horarioCfgC4 = await getHorarioCfgPipeline(base44);
      const horarioCamada4 = await getHorarioInfoPipeline(base44);
      const ackJaEnviou = resultado.camadas.ack?.ok === true;
      const suprimirLLM = !horarioCamada4.dentro || ackJaEnviou;

      if (suprimirLLM) {
        const motivoSupressao = !horarioCamada4.dentro ? 'fora_horario' : 'ack_camada5_ja_enviou';
        console.log(`[SKILL-PRE-ATEND] ⏭️ Camada 9: boas-vindas LLM SUPRIMIDA (motivo: ${motivoSupressao})`);
        resultado.camadas.atribuicao = {
          ok: true,
          atendente: atendente.full_name,
          atendente_id: atendente.id,
          motivo: motivoAtribuicao,
          mensagem_enviada: false,
          llm_suprimida_motivo: motivoSupressao
        };
        resultado.success = true;
        marcarFimCamada(9, 'ok', {
          atendente_id: atendente.id,
          motivo: motivoAtribuicao,
          mensagem_enviada: false,
          llm_suprimida_motivo: motivoSupressao
        });
        await liberarEstadoThread(base44, { ...thread, id: thread_id, contact_id, assigned_user_id: atendente.id, routing_stage: 'ASSIGNED', pre_atendimento_ativo: false }, 'early_return_camada9_atribuicao_sem_llm');
        await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, 'concluido');
        return Response.json({
          ...resultado,
          action: 'atribuicao_concluida_sem_llm',
          setor,
          atendente: atendente?.full_name,
          motivo: motivoAtribuicao,
          llm_suprimida_motivo: motivoSupressao,
          tempo_ms: Date.now() - tsInicio,
          telemetria: resultado.telemetria
        }, { headers });
      }

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
        console.warn('[SKILL-PRE-ATEND] LLM boas-vindas falhou, usando fallback');
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
            metadata: { is_ai_response: true, ai_agent: 'skillPreAtendimentos', assigned_to: atendente.id, whatsapp_msg_id: envMsgId }
          }).catch(() => {});

          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            last_message_at: new Date().toISOString(),
            last_outbound_at: new Date().toISOString(),
            last_message_sender: 'user',
            last_message_content: mensagemBoasVindas.substring(0, 100),
            unread_count: 0
          }).catch(() => {});

          console.log('[SKILL-PRE-ATEND] 💬 Boas-vindas enviadas');
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
      marcarFimCamada(9, 'ok', {
        atendente_id: atendente.id,
        motivo: motivoAtribuicao,
        mensagem_enviada: !!mensagemBoasVindas
      });

    } catch (e) {
      console.error('[SKILL-PRE-ATEND] Camada 9 erro:', e.message);
      resultado.camadas.atribuicao = { error: e.message };
      resultado.success = !!resultado.camadas.routing?.ok;
      marcarFimCamada(9, 'error', { error: e.message });
    }

    await liberarEstadoThread(base44, thread || { id: thread_id, contact_id }, 'conclusao_normal_skill');
    await gravarLogFinal(base44, thread_id, contact_id, resultado, tsInicio, resultado.success ? 'concluido' : 'parcial');

    return Response.json({
      ...resultado,
      action: 'atribuicao_concluida',
      setor,
      atendente: atendente?.full_name,
      motivo: motivoAtribuicao,
      tempo_ms: Date.now() - tsInicio,
      telemetria: resultado.telemetria
    }, { headers });

  } catch (error) {
    console.error('[SKILL-PRE-ATEND] ❌ Erro fatal:', error.message);
    // T5: Cleanup defensivo — se erro fatal ocorreu DEPOIS da Camada 3 setar
    // pre_atendimento_ativo: true via dedup lock, a thread fica presa nesse
    // estado para sempre. Histórico do projeto mostra backlog de "stuck
    // threads" decorrente exatamente desse caso (threads com
    // pre_atendimento_ativo: true sem assigned_user_id).
    if (_payloadForCleanup?.thread_id && _base44ForCleanup?.asServiceRole?.entities?.MessageThread) {
      try {
        const threadCleanup = await _base44ForCleanup.asServiceRole.entities.MessageThread.get(_payloadForCleanup.thread_id).catch(() => ({ id: _payloadForCleanup.thread_id, contact_id: _payloadForCleanup.contact_id }));
        await liberarEstadoThread(_base44ForCleanup, threadCleanup, 'catch_fatal_skill');
        console.log(`[SKILL-PRE-ATEND] 🧹 Cleanup pós-erro-fatal executado (thread ${_payloadForCleanup.thread_id})`);

        // RECUPERAÇÃO: se a thread caiu no erro fatal SEM atendente atribuído,
        // o contato ficaria órfão em "Não Atribuídas" sem retry. Enfileira um
        // WorkQueueItem para o watchdog reprocessar (idempotente: só 1 aberto).
        if (!threadCleanup?.assigned_user_id) {
          const jaTemItem = await _base44ForCleanup.asServiceRole.entities.WorkQueueItem.filter({
            thread_id: _payloadForCleanup.thread_id,
            status: { $in: ['open', 'in_progress'] }
          }, '-created_date', 1).catch(() => []);
          if (!jaTemItem.length) {
            await _base44ForCleanup.asServiceRole.entities.WorkQueueItem.create({
              contact_id: _payloadForCleanup.contact_id,
              thread_id: _payloadForCleanup.thread_id,
              tipo: 'sem_atendente',
              reason: 'skill_fatal_error',
              severity: 'high',
              status: 'open',
              notes: `Pré-atendimento abortou por erro fatal: ${error.message?.substring(0, 200)}`
            }).catch(() => {});
            console.log(`[SKILL-PRE-ATEND] 📋 WorkQueueItem criado para reprocessamento (thread órfã)`);
          }
        }
      } catch (cleanupErr) {
        console.error('[SKILL-PRE-ATEND] 🔴 Cleanup também falhou:', cleanupErr.message);
      }
    }
    return Response.json({ success: false, error: error.message, camadas: resultado.camadas }, { status: 500, headers });
  }
});