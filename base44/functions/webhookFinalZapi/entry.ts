// redeploy: 2026-04-23T00:00-SDK-0.8.25
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Fonte: functions/lib/phoneNormalizer.js (inlined — Deno não suporta imports locais)
// phoneNormalizer v2.0 — canônica sincronizada em todos os arquivos
// Cobre: celular BR (13 dígitos), celular sem 9 (12), fixo (12), números curtos (8+)
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  const raw = String(telefone).trim();
  // Se for @lid, preserva como identificador estável (Z-API/WhatsApp privacy)
  if (raw.toLowerCase().endsWith('@lid')) {
    const idPart = raw.split('@')[0].replace(/\D/g, '');
    return idPart.length >= 8 ? `${idPart}@lid` : null;
  }
  let n = raw.split('@')[0].replace(/\D/g, '');
  if (!n || n.length < 8) return null;
  n = n.replace(/^0+/, '');
  // Adiciona código Brasil se necessário
  if (!n.startsWith('55')) {
    if (n.length >= 8 && n.length <= 11) n = '55' + n;
  }
  // Insere nono dígito APENAS para celular (não para fixo)
  // Celular: 55 + DDD(2) + 9XXXXXXXX = 13 dígitos totais
  // Fixo:    55 + DDD(2) + XXXXXXXX  = 12 dígitos, 5º dígito é 2,3,4,5
  if (n.startsWith('55') && n.length === 12) {
    const quintoDigito = n[4]; // primeiro dígito após DDD
    if (['6','7','8','9'].includes(quintoDigito)) {
      n = n.substring(0, 4) + '9' + n.substring(4);
    }
    // Fixo (começa com 2,3,4,5): mantém 12 dígitos sem inserir 9
  }
  return '+' + n;
}
function isSamePhone(a, b) {
  const n1 = normalizarTelefone(a);
  const n2 = normalizarTelefone(b);
  return !!(n1 && n2 && n1 === n2);
}

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v11.0.0 INGESTÃO PURA + CÉREBRO ISOLADO
// ============================================================================
const VERSION = 'v11.8.0-ATOMIC-LOCK-ANTIRACE';
const BUILD_DATE = '2026-04-23';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonOk(body, init = {}) {
  return Response.json(body, { status: 200, headers: corsHeaders, ...init });
}
function jsonBadRequest(body) {
  return Response.json(body, { status: 400, headers: corsHeaders });
}
function jsonServerError(body) {
  return Response.json(body, { status: 500, headers: corsHeaders });
}

// ============================================================================
// CACHE DE CHIPS INTERNOS — reduz queries paralelas em bursts Z-API
// Válido por 60s dentro da mesma instância Deno (suficiente para bursts curtos)
// ============================================================================
let _cacheChips = null;
let _cacheChipsTs = 0;
const CACHE_CHIPS_TTL_MS = 60_000;

// ============================================================================
// CACHE DE MESSAGE IDs PROCESSADOS — proteção anti-duplicata imune a 429
// Evita que retries da Z-API (>5s timeout) criem mensagens duplicadas
// ============================================================================
const _messageIdsProcessados = new Map(); // messageId → timestamp
const MESSAGE_ID_CACHE_TTL_MS = 5 * 60_000; // 5 minutos — cobre retries lentos e bursts

function jaProcessado(messageId) {
  if (!messageId) return false;
  const ts = _messageIdsProcessados.get(messageId);
  if (!ts) return false;
  if (Date.now() - ts > MESSAGE_ID_CACHE_TTL_MS) {
    _messageIdsProcessados.delete(messageId);
    return false;
  }
  return true;
}

function marcarComoProcessado(messageId) {
  if (!messageId) return;
  _messageIdsProcessados.set(messageId, Date.now());
  // Housekeeping: limpar entradas expiradas se cache crescer demais
  if (_messageIdsProcessados.size > 500) {
    const cutoff = Date.now() - MESSAGE_ID_CACHE_TTL_MS;
    for (const [k, v] of _messageIdsProcessados) {
      if (v < cutoff) _messageIdsProcessados.delete(k);
    }
  }
}

async function getChipsInternos(base44) {
  const agora = Date.now();
  if (_cacheChips && (agora - _cacheChipsTs) < CACHE_CHIPS_TTL_MS) {
    return _cacheChips;
  }
  try {
    const integracoes = await retryOn429(() => base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { status: 'conectado' }, '-created_date', 100
    ));
    _cacheChips = integracoes
      .map(i => (i.numero_telefone || '').replace(/\D/g, '').replace(/^0+/, ''))
      .filter(n => n && n.length > 8);
    _cacheChipsTs = agora;
    console.log(`[CHIPS-CACHE] ✅ Cache atualizado: ${_cacheChips.length} chips internos`);
    return _cacheChips;
  } catch (e) {
    console.warn(`[CHIPS-CACHE] ⚠️ Erro ao carregar chips (usando cache antigo):`, e.message);
    return _cacheChips || [];
  }
}

// ============================================================================
// RETRY COM BACKOFF EXPONENCIAL PARA 429
// ============================================================================
async function retryOn429(fn, maxTentativas = 3, delayBase = 1000) {
  for (let i = 0; i < maxTentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      const is429 = e?.message?.includes('429') || e?.message?.includes('Rate limit') || e?.message?.includes('Limite de taxa');
      if (is429 && i < maxTentativas - 1) {
        const delay = delayBase * Math.pow(2, i);
        console.warn(`[RETRY] 429 detectado, aguardando ${delay}ms (tentativa ${i + 1}/${maxTentativas})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
}

// --------------------------------------------------------------------------------------
// FILTRO ULTRA-RÁPIDO
// --------------------------------------------------------------------------------------
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type ?? payload.event ?? '').toLowerCase();
  const phone = String(payload.phone ?? payload.from ?? '').toLowerCase();
  const isGroup = payload.isGroup === true || String(payload.chatId ?? '').includes('@g.us');

  // fromMe+fromApi = mensagem automática do sistema (URA, ACK)
  if (payload.fromMe === true && payload.fromApi === true) {
    return 'fromMe_fromApi_auto';
  }

  if (
    phone.includes('status@') ||
    phone.includes('@broadcast') ||
    phone.includes('@g.us') ||
    isGroup
  ) {
    return 'jid_sistema';
  }

  if (tipo.includes('qrcode') || tipo.includes('connection') || tipo.includes('disconnect')) {
    return null;
  }

  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  const temMessageId = payload.messageId || payload.id;
  if (!temMessageId && eventosLixo.some((e) => tipo.includes(e))) {
    return 'evento_sistema';
  }

  if (tipo.includes('messagestatuscallback') || tipo.includes('message-status')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) {
      return 'status_broadcast';
    }
    return null;
  }

  const hasMsgId = payload.messageId || payload.id;
  const hasPhone = payload.phone || payload.from;
  const hasContent = payload.text || payload.body || payload.message || payload.image || payload.video || payload.audio || payload.document;

  if (hasMsgId && hasPhone && (hasContent || payload.momment)) {
    return null;
  }

  if (tipo.includes('receivedcallback')) {
    if (!payload.phone && !payload.from) return 'sem_telefone';
    return null;
  }

  return 'evento_desconhecido';
}

// --------------------------------------------------------------------------------------
// NORMALIZAR PAYLOAD
// --------------------------------------------------------------------------------------
function coerceString(v, def = null) {
  if (v == null) return def;
  try {
    const s = String(v);
    return s.length ? s : def;
  } catch {
    return def;
  }
}

function normalizarPayload(payload) {
  const tipoRaw = coerceString(payload.type ?? payload.event, '').toLowerCase();
  const instanceId =
    payload.instanceId ??
    payload.instance ??
    payload.instance_id ??
    payload.instance_id_provider ??
    null;

  if (tipoRaw.includes('qrcode') || payload.qrcode || payload.qr) {
    return {
      type: 'qrcode',
      instanceId,
      qrCodeUrl: payload.qrcode ?? payload.qr ?? payload.qrCodeUrl ?? null,
    };
  }

  if (tipoRaw.includes('disconnect')) {
    return {
      type: 'disconnection',
      instanceId,
      status: 'desconectado',
      moment: payload.moment ?? payload.timestamp ?? null
    };
  }

  if (tipoRaw.includes('connection') || typeof payload.connected === 'boolean') {
    return {
      type: 'connection',
      instanceId,
      status: payload.connected ? 'conectado' : 'desconectado',
    };
  }

  const temConteudoMensagem = payload.text || payload.body || payload.message ||
                              payload.image || payload.video || payload.audio ||
                              payload.document || payload.sticker;
  const temIndicadoresMensagem = payload.senderName || payload.chatName || payload.pushName;
  const ehMensagemReal = payload.messageId &&
                         payload.phone &&
                         payload.fromMe === false &&
                         (temConteudoMensagem || temIndicadoresMensagem);

  if (!ehMensagemReal && (tipoRaw.includes('messagestatuscallback') || tipoRaw.includes('message-status') || (Array.isArray(payload.ids) && payload.ids.length > 0))) {
    const messageId =
      (Array.isArray(payload.ids) && payload.ids[0]) ||
      payload.messageId ||
      payload.id ||
      null;
    return {
      type: 'message_update',
      instanceId,
      messageId,
      status: payload.status,
    };
  }

  const telefoneOrig = payload.phone ?? payload.from ?? payload.chatId ?? '';
  const numeroLimpo = normalizarTelefone(telefoneOrig);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  const messageId =
    payload.messageId ||
    payload.id ||
    (Array.isArray(payload.ids) && payload.ids[0]) ||
    payload.key?.id ||
    null;

  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo =
    payload.text?.message ??
    payload.text ??
    payload.body ??
    payload.message ??
    payload.caption ??
    '';

  const mediaFields = ['image', 'video', 'audio', 'document', 'sticker', 'imageUrl', 'videoUrl', 'audioUrl', 'documentUrl', 'mediaUrl', 'forwardedFrom'];
  const presentMediaFields = mediaFields.filter(f => payload[f]);
  if (presentMediaFields.length > 0) {
    console.log(`[${VERSION}] 📎 Campos de mídia presentes:`, presentMediaFields);
  }

  if (payload.isForwarded || payload.forwardedFrom) {
    console.log(`[${VERSION}] 📨 MENSAGEM ENCAMINHADA detectada!`);
  }

  const forwardedImage = payload.forwardedFrom?.image || payload.isForwarded && payload.image;

  if (payload.image || forwardedImage) {
    mediaType = 'image';
    const imgData = payload.image || forwardedImage;
    if (typeof imgData === 'object') {
      mediaUrl = imgData.imageUrl ?? imgData.url ?? imgData.link ?? imgData.mediaUrl ?? null;
      conteudo = imgData.caption || '📷 [Imagem recebida]';
    } else if (typeof imgData === 'string' && imgData.startsWith('http')) {
      mediaUrl = imgData;
      conteudo = '📷 [Imagem recebida]';
    }
  } else if (payload.imageUrl) {
    mediaType = 'image';
    mediaUrl = payload.imageUrl;
    conteudo = payload.caption || '📷 [Imagem recebida]';
  } else if (payload.video) {
    mediaType = 'video';
    if (typeof payload.video === 'object') {
      mediaUrl = payload.video.videoUrl ?? payload.video.url ?? payload.video.link ?? payload.video.mediaUrl ?? null;
      conteudo = payload.video.caption || '🎥 [Vídeo recebido]';
    } else if (typeof payload.video === 'string' && payload.video.startsWith('http')) {
      mediaUrl = payload.video;
      conteudo = '🎥 [Vídeo recebido]';
    }
  } else if (payload.videoUrl) {
    mediaType = 'video';
    mediaUrl = payload.videoUrl;
    conteudo = payload.caption || '🎥 [Vídeo recebido]';
  } else if (payload.audio || payload['áudio']) {
    // ✅ FIX v11.7.0: Z-API às vezes envia a chave "áudio" com acento (encoding UTF-8 direto)
    // Aceitar ambas as formas para não perder áudios
    mediaType = 'audio';
    const audioData = payload.audio || payload['áudio'];
    if (typeof audioData === 'object') {
      mediaUrl = audioData.audioUrl ?? audioData.url ?? audioData.link ?? audioData.mediaUrl ?? null;
    } else if (typeof audioData === 'string' && audioData.startsWith('http')) {
      mediaUrl = audioData;
    }
    conteudo = '🎤 [Áudio recebido]';
  } else if (payload.audioUrl) {
    mediaType = 'audio';
    mediaUrl = payload.audioUrl;
    conteudo = '🎤 [Áudio recebido]';
  } else if (payload.document || payload.documentUrl) {
    mediaType = 'document';
    let documentUrl = null;
    let rawFileName = null;
    if (typeof payload.document === 'object') {
      documentUrl = payload.document.documentUrl ?? payload.document.url ?? payload.document.link ?? payload.document.mediaUrl ?? null;
      rawFileName = payload.document.fileName || null;
    } else if (typeof payload.document === 'string' && payload.document.startsWith('http')) {
      documentUrl = payload.document;
    } else if (payload.documentUrl) {
      documentUrl = payload.documentUrl;
    }
    mediaUrl = documentUrl;
    const ext = (mediaUrl?.split('.').pop()?.split('?')[0] || 'pdf').toLowerCase();
    const fileNameBase = rawFileName || payload.fileName || 'documento';
    const fileNameSeguro = fileNameBase.replace(/[\/:*?"<>|\\[\]]/g, '_').slice(0, 100).replace(/^\.+/, '');
    let fileNameFinal;
    if (!fileNameSeguro.toLowerCase().endsWith(`.${ext}`)) {
      const lastDot = fileNameSeguro.lastIndexOf('.');
      if (lastDot > 0 && lastDot < fileNameSeguro.length - 5) {
        fileNameFinal = `${fileNameSeguro.substring(0, lastDot)}.${ext}`;
      } else {
        fileNameFinal = `${fileNameSeguro}.${ext}`;
      }
    } else {
      fileNameFinal = fileNameSeguro;
    }
    conteudo = fileNameFinal;
    if (!payload.caption && !payload.document?.caption) {
      payload.caption = fileNameFinal;
    }
  } else if (payload.sticker) {
    mediaType = 'sticker';
    if (typeof payload.sticker === 'object') {
      mediaUrl = payload.sticker.stickerUrl ?? payload.sticker.url ?? null;
    } else if (typeof payload.sticker === 'string' && payload.sticker.startsWith('http')) {
      mediaUrl = payload.sticker;
    }
    conteudo = '[Sticker]';
  } else if (payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    conteudo = '📇 [Contato compartilhado]';
  } else if (payload.location) {
    mediaType = 'location';
    conteudo = '📍 [Localização]';
  }

  if (mediaType === 'none' && payload.mediaUrl) {
    mediaUrl = payload.mediaUrl;
    const ext = (payload.mediaUrl.split('.').pop() || '').toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      mediaType = 'image';
      if (!conteudo) conteudo = '📷 [Imagem recebida]';
    } else if (['mp4', 'mov', 'avi', '3gp'].includes(ext)) {
      mediaType = 'video';
      if (!conteudo) conteudo = '🎥 [Vídeo recebido]';
    } else if (['mp3', 'ogg', 'opus', 'wav', 'm4a'].includes(ext)) {
      mediaType = 'audio';
      if (!conteudo) conteudo = '🎤 [Áudio recebido]';
    } else {
      mediaType = 'document';
      if (!conteudo) conteudo = '📄 [Documento]';
    }
  }

  if (mediaType !== 'none') {
    console.log(`[${VERSION}] 📎 Mídia detectada: ${mediaType} | URL: ${mediaUrl ? mediaUrl.substring(0, 80) + '...' : 'null'}`);
  }

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message',
    instanceId,
    messageId,
    from: numeroLimpo,
    content: String(conteudo ?? '').trim(),
    mediaType,
    mediaUrl,
    mediaCaption: payload.image?.caption ?? payload.video?.caption ?? payload.document?.caption ?? payload.caption ?? null,
    fromMe: payload.fromMe === true,
    pushName: payload.senderName ?? payload.pushName ?? null,
    vcard: payload.contactMessage ?? payload.vcard ?? null,
    location: payload.location ?? null,
    quotedMessage: payload.quotedMsg ?? payload.quotedMessage ?? null,
  };
}

// --------------------------------------------------------------------------------------
// HANDLER PRINCIPAL
// --------------------------------------------------------------------------------------
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return jsonOk({ version: VERSION, build: BUILD_DATE, status: 'ok' });
    }

    if (req.method !== 'POST') {
      return jsonBadRequest({ success: false, error: 'metodo_nao_suportado' });
    }

    let payload;
    try {
      const body = await req.text();
      if (!body) return jsonOk({ success: true, ignored: true, reason: 'sem_corpo' });
      payload = JSON.parse(body);
    } catch (e) {
      return jsonBadRequest({ success: false, error: 'json_invalido' });
    }

    console.log(`[${VERSION}] 📥 Payload recebido (1/2):`, JSON.stringify(payload).substring(0, 1000));
    console.log(`[${VERSION}] 📥 Carga recebida (2/2):`, JSON.stringify(payload).substring(1000, 2000));

    // ✅ FIX v11.7.0: Retorno antecipado para eventos de sistema Z-API
    // Evita criar client Base44 (que gera erro 403 no log do SDK) para eventos que não precisam de DB
    const tipoEvento = String(payload.type ?? payload.event ?? '').toLowerCase();
    if (
      tipoEvento === 'deliverycallback' ||
      tipoEvento === 'presencechatcallback' ||
      (tipoEvento === 'messagestatuscallback' && !payload.text && !payload.body)
    ) {
      console.log(`[${VERSION}] ⏭️ Evento de sistema: ${tipoEvento} — retorno antecipado (sem DB)`);
      return jsonOk({ success: true, ignored: true, reason: `system_event_early_return:${tipoEvento}` });
    }

    const motivoIgnorar = deveIgnorar(payload);
    if (motivoIgnorar) {
      console.log(`[${VERSION}] ⏭️ Ignorado: ${motivoIgnorar}`);
      return jsonOk({ success: true, ignored: true, reason: motivoIgnorar });
    }

    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (e) {
      // Se falhar autenticação, é provável que seja webhook sem token válido — ignorar silenciosamente
      if (e?.message?.includes('private') || e?.message?.includes('auth') || e?.message?.includes('403')) {
        console.log(`[${VERSION}] ⏭️ Webhook sem autenticação válida (normal para Z-API), ignorado`);
        return jsonOk({ success: true, ignored: true, reason: 'webhook_no_auth' });
      }
      console.error(`[${VERSION}] SDK init error:`, e?.message || e);
      return jsonServerError({ success: false, error: 'sdk_init_error' });
    }

    const dados = normalizarPayload(payload);
    if (dados.type === 'unknown') {
      console.log(`[${VERSION}] ⏭️ Unknown: ${dados.error}`);
      return jsonOk({ success: true, ignored: true, reason: dados.error });
    }

    if (dados.type === 'message' && dados.fromMe === true) {
      console.log(`[${VERSION}] ⏭️ fromMe: mensagem própria do chip, ignorado`);
      return jsonOk({ success: true, ignored: true, reason: 'fromMe_outbound' });
    }

    switch (dados.type) {
      case 'qrcode':        return await handleQRCode(dados, base44);
      case 'connection':    return await handleConnection(dados, base44);
      case 'disconnection': return await handleDisconnection(dados, base44);
      case 'message_update':return await handleMessageUpdate(dados, base44);
      case 'message':       return await handleMessage(dados, payload, base44);
      default:              return jsonOk({ success: true, ignored: true, reason: 'tipo_desconhecido' });
    }
  } catch (error) {
    console.error(`[${VERSION}] ❌ ERRO não tratado:`, error?.message || error);
    return jsonServerError({ success: false, error: 'erro_interno' });
  }
});

// --------------------------------------------------------------------------------------
// HANDLERS
// --------------------------------------------------------------------------------------
async function handleQRCode(dados, base44) {
  if (!dados.instanceId) return jsonOk({ success: true, processed: 'qrcode', note: 'sem_instance' });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl ?? null,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro QR Code:`, e?.message);
  }
  return jsonOk({ success: true, processed: 'qrcode' });
}

async function handleConnection(dados, base44) {
  if (!dados.instanceId) return jsonOk({ success: true, processed: 'connection', note: 'sem_instance' });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        status: dados.status,
        ultima_atividade: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro Connection:`, e?.message);
  }
  return jsonOk({ success: true, processed: 'connection', status: dados.status });
}

async function handleDisconnection(dados, base44) {
  if (!dados.instanceId) return jsonOk({ success: true, ignored: true, reason: 'no_instance_id' });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes.length === 0) return jsonOk({ success: true, ignored: true, reason: 'unmapped_instance' });

    const integracao = integracoes[0];
    const timestamp = dados.moment ? new Date(dados.moment * 1000).toISOString() : new Date().toISOString();

    if (integracao.status === 'desconectado' && integracao.last_disconnected_at) {
      const diffMs = Date.now() - new Date(integracao.last_disconnected_at).getTime();
      if (diffMs < 120000) return jsonOk({ success: true, ignored: true, reason: 'already_disconnected' });
    }

    await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      status: 'desconectado',
      last_disconnected_at: timestamp,
      status_reason: 'webhookDisconnected',
      ultima_atividade: timestamp
    });

    try {
      await base44.asServiceRole.entities.NotificationEvent.create({
        tipo: 'integration_disconnected',
        titulo: `Instância WhatsApp desconectada`,
        mensagem: `A instância ${integracao.nome_instancia} foi desconectada às ${new Date(timestamp).toLocaleTimeString('pt-BR')}`,
        prioridade: 'alta',
        integration_id: integracao.id,
        metadata: { integration_name: integracao.nome_instancia, phone: integracao.numero_telefone, disconnected_at: timestamp, provider: 'z_api' }
      });
    } catch (notifErr) {
      console.warn(`[${VERSION}] ⚠️ Erro ao criar notificação:`, notifErr.message);
    }

    return jsonOk({ success: true, processed: 'disconnection', integration_id: integracao.id });
  } catch (error) {
    console.error(`[${VERSION}] ❌ Erro ao processar desconexão:`, error.message);
    return jsonOk({ success: true, error: 'processing_failed', details: error.message });
  }
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return jsonOk({ success: true, processed: 'status_update', note: 'sem_message_id' });
  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );
    if (mensagens.length > 0) {
      const statusMap = { READ: 'lida', READ_BY_ME: 'lida', DELIVERED: 'entregue', SENT: 'enviada', RECEIVED: 'recebida' };
      const novoStatus = statusMap[String(dados.status ?? '').toUpperCase()];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
      }
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro Status Update:`, e?.message);
  }
  return jsonOk({ success: true, processed: 'status_update' });
}

async function handleMessage(dados, payloadBruto, base44) {
  const inicio = Date.now();
  const _tsInicio = Date.now();

  // ✅ CAMADA 1: Guard fromMe IMEDIATAMENTE — antes de qualquer lógica
  if (dados.fromMe === true || payloadBruto.fromApi === true) {
    console.log(`[${VERSION}] ⏭️ fromMe=true ou fromApi=true — sync, IGNORADO`);
    return jsonOk({ success: true, skipped: true, reason: 'from_me_sync' });
  }

  // ✅ CAMADA 2: Validar telefone mínimo — antes de criar contato ou buscar integração
  if (!dados.from || dados.from.replace(/\D/g, '').length < 8) {
    console.log(`[${VERSION}] ⏭️ Telefone inválido: ${dados.from}`);
    return jsonOk({ success: true, skipped: true, reason: 'telefone_invalido' });
  }

  const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
  console.log(`[${VERSION}] 💬 Nova mensagem de: ${dados.from} | Via: ${connectedPhone || 'não informado'}`);

  // ⚡ CAMADA 0: CACHE EM MEMÓRIA — dedup instantâneo, 0 queries, imune a 429
  // Cobre retries da Z-API (>5s timeout) que chegam na MESMA instância Deno
  if (dados.messageId && jaProcessado(dados.messageId)) {
    console.log(`[${VERSION}] ⚡ CACHE HIT: messageId ${dados.messageId} já processado recentemente — IGNORADO`);
    return jsonOk({ success: true, ignored: true, reason: 'duplicata_cache_memoria' });
  }

  // ⚡ CAMADA 0.5: LOCK ATÔMICO VIA ZapiPayloadNormalized
  // Solução definitiva para race condition entre instâncias Deno paralelas.
  // Cria o registro de audit AGORA (antes de qualquer processing). Se já existir
  // por outro webhook concorrente com mesmo message_id, abortamos imediatamente.
  let lockRecord = null;
  if (dados.messageId) {
    try {
      // Tenta criar o lock (será o registro de audit final, evita 2 queries)
      lockRecord = await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: payloadBruto,
        instance_identificado: dados.instanceId ?? null,
        integration_id: null, // será atualizado depois
        message_id: dados.messageId,
        evento: 'ReceivedCallback',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: false, // será true no final
        provider: 'z_api'
      });

      // Verifica se já existe OUTRO lock com mesmo messageId (race condition)
      // Se houver 2+ registros, significa que outra instância criou primeiro → aborta
      const locksExistentes = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
        { message_id: dados.messageId }, 'created_date', 5
      );
      if (locksExistentes && locksExistentes.length > 1) {
        // Outro webhook chegou antes — abortar
        const primeiroLock = locksExistentes[0];
        if (primeiroLock.id !== lockRecord.id) {
          console.log(`[${VERSION}] 🔒 LOCK COLLISION: messageId ${dados.messageId} já processado por ${primeiroLock.id} — ABORTANDO`);
          // Remover nosso lock redundante
          try {
            await base44.asServiceRole.entities.ZapiPayloadNormalized.delete(lockRecord.id);
          } catch {}
          // Marcar cache para futuras
          marcarComoProcessado(dados.messageId);
          return jsonOk({ success: true, ignored: true, reason: 'duplicata_lock_atomico' });
        }
      }
    } catch (lockErr) {
      console.warn(`[${VERSION}] ⚠️ Falha ao criar lock (prosseguindo):`, lockErr.message);
      lockRecord = null; // Sem lock → confia no dedup por messageId abaixo
    }
  }

  // ✅ CAMADA 2B: Guard inter-chips — rejeitar mensagens ENTRE chips internos
  // Usa cache em memória para evitar queries paralelas em bursts Z-API
  const fromCanon = String(dados.from).replace(/\D/g, '').replace(/^0+/, '');
  try {
    const chipNumbers = await getChipsInternos(base44);
    if (chipNumbers.includes(fromCanon)) {
      console.log(`[${VERSION}] 🛡️ GUARD inter-chips: from=${dados.from} é um chip interno (cache)`);
      return jsonOk({ success: true, ignored: true, reason: 'mensagem_interna_entre_chips' });
    }
  } catch (e) {
    console.warn(`[${VERSION}] ⚠️ Erro ao verificar chips internos (prosseguindo):`, e?.message);
  }

  // Guard own_chip — rejeitar mensagens do próprio número do chip (failsafe)
  if (dados.from && connectedPhone) {
    const chipCanon = String(connectedPhone).replace(/\D/g, '').replace(/^0+/, '');
    if (fromCanon === chipCanon) {
      console.log(`[${VERSION}] 🛡️ GUARD own_chip: from=${dados.from} === chip=${connectedPhone}`);
      return jsonOk({ success: true, ignored: true, reason: 'from_own_chip' });
    }
  }

  // DEDUPLICAÇÃO por messageId
  if (dados.messageId) {
    try {
      const dup = await retryOn429(() => base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId }, '-created_date', 1
      ), 5, 1500);
      if (dup.length > 0) {
        console.log(`[${VERSION}] ⏭️ DUPLICATA por messageId: ${dados.messageId}`);
        return jsonOk({ success: true, ignored: true, reason: 'duplicata_message_id' });
      }
    } catch (err) {
      // ✅ FAIL-SAFE: se o dedup falhou por 429, não arriscar duplicar.
      // Retorna 429 para Z-API reenviar o webhook (idempotente via messageId).
      console.error(`[${VERSION}] 🔴 Dedup messageId falhou — retornando 429 para Z-API reenviar:`, err.message);
      return Response.json(
        { success: false, error: 'dedup_check_failed', retry: true },
        { status: 429, headers: corsHeaders }
      );
    }
  }

  // Buscar integração — 1 query, normalização canônica
  let integracaoId = null;
  let integracaoInfo = null;

  // Query direta por instanceId (evita fetch de 50 registros)
  if (dados.instanceId) {
    try {
      const r = await retryOn429(() => base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId }, '-created_date', 1
      ));
      if (r && r.length > 0) {
        integracaoId = r[0].id;
        integracaoInfo = { nome: r[0].nome_instancia, numero: r[0].numero_telefone };
      }
    } catch { /* silencioso */ }
  }

  // Fallback por connectedPhone
  if (!integracaoId && connectedPhone) {
    try {
      const norm = normalizarTelefone(connectedPhone);
      if (norm) {
        const r = await retryOn429(() => base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { numero_telefone: norm }, '-created_date', 1
        ));
        if (r && r.length > 0) {
          integracaoId = r[0].id;
          integracaoInfo = { nome: r[0].nome_instancia, numero: r[0].numero_telefone };
        }
      }
    } catch { /* silencioso */ }
  }

  console.log(`[${VERSION}] 🔗 Integração: ${integracaoId || 'não encontrada'} | Canal: ${integracaoInfo?.numero || connectedPhone || 'N/A'}`);

  // BUSCAR/CRIAR CONTATO
  // ⚡ CAMADA 1: Busca rápida — se @lid, usa identificador estável; senão por telefone_canonico
  const isLid = String(dados.from || '').toLowerCase().endsWith('@lid');
  const telefoneCanonico = isLid ? dados.from : dados.from.replace(/\D/g, '');
  // ⚡ Variante sem o 9 móvel (contatos antigos com 12 dígitos) — não aplica a @lid
  let telefoneCanonico12 = null;
  if (!isLid && telefoneCanonico.startsWith('55') && telefoneCanonico.length === 13 && telefoneCanonico[4] === '9') {
    telefoneCanonico12 = telefoneCanonico.substring(0, 4) + telefoneCanonico.substring(5); // remove posição 4 (o '9')
  }
  let contato;
  try {
    const buscaRapida = await retryOn429(() => base44.asServiceRole.entities.Contact.filter(
      { telefone_canonico: telefoneCanonico }, 'created_date', 1
    ));
    if (buscaRapida?.length > 0) {
      contato = buscaRapida[0];
      console.log(`[${VERSION}] ⚡ Contato encontrado por busca rápida (Camada 1): ${contato.id} | ${contato.nome}`);
      // Atualizar ultima_interacao de forma não-bloqueante
      base44.asServiceRole.entities.Contact.update(contato.id, {
        ultima_interacao: new Date().toISOString()
      }).catch(() => {});
    } else if (telefoneCanonico12) {
      // ⚡ CAMADA 1B: Tentar sem o 9 (contatos antigos com 12 dígitos)
      const buscaRapida12 = await retryOn429(() => base44.asServiceRole.entities.Contact.filter(
        { telefone_canonico: telefoneCanonico12 }, 'created_date', 1
      ));
      if (buscaRapida12?.length > 0) {
        contato = buscaRapida12[0];
        console.log(`[${VERSION}] ⚡ Contato encontrado por canonico-12 (Camada 1B): ${contato.id} | ${contato.nome}`);
        // Corrigir canonico para 13 dígitos fire-and-forget
        base44.asServiceRole.entities.Contact.update(contato.id, {
          telefone_canonico: telefoneCanonico,
          telefone: dados.from,
          ultima_interacao: new Date().toISOString()
        }).catch(() => {});
      }
    }

    if (!contato) {
      // Só chama centralizada se busca rápida não encontrou
      console.log(`[${VERSION}] 🎯 Busca rápida vazia — chamando getOrCreateContactCentralized para: ${dados.from}`);
      const resultado = await retryOn429(() => base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
        telefone: dados.from,
        pushName: dados.pushName || null,
        profilePicUrl: null,
        integracaoId: integracaoId
      }));
      if (resultado?.data?.error === 'rate_limit') {
        console.warn(`[${VERSION}] ⚠️ rate_limit_contact: getOrCreateContactCentralized retornou rate_limit — Z-API fará retry automático`);
        return jsonOk({ success: true, skipped: true, reason: 'rate_limit_contact' });
      }
      if (!resultado?.data?.success || !resultado?.data?.contact) {
        console.error(`[${VERSION}] ❌ getOrCreateContactCentralized falhou:`, resultado?.data);
        return jsonServerError({ success: false, error: 'erro_contato_dedup' });
      }
      contato = resultado.data.contact;
      console.log(`[${VERSION}] ✅ Contato: ${contato.id} | ${contato.nome} | Ação: ${resultado.data.action}`);
    }
  } catch (e) {
    const is429 = e?.message?.includes('429') || e?.message?.includes('Rate limit') || e?.message?.includes('Limite de taxa') || e?.message?.includes('rate_limit');
    if (is429) {
      console.warn(`[${VERSION}] ⚠️ rate_limit_contact (catch): 429 persistente após retries — descartando sem criar contato fantasma`);
      return jsonOk({ success: true, skipped: true, reason: 'rate_limit_contact' });
    }
    console.error(`[${VERSION}] ❌ Erro ao buscar/criar contato:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_contato' });
  }

  // 🔧 CAMADA 2: limparContatosDuplicados removido (carregava 2000 contatos por mensagem sem filtro — waste crítico)

  // BUSCAR/CRIAR THREAD — sem AUTO-MERGE (pertence ao UnificadorContatosCentralizado, não ao webhook)
  let thread = null;
  try {
    console.log(`[${VERSION}] 🔍 Buscando thread canônica para contact_id: "${contato.id}"`);
    // ✅ FIX: thread lookup usa mais retries (5) com delay maior para absorver bursts
    const threads = await retryOn429(() => base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id, is_canonical: true, status: 'aberta' },
      '-last_message_at',
      1
    ), 5, 1500);

    if (threads && threads.length > 0) {
      thread = threads[0];
      console.log(`[${VERSION}] ✅ canonical-thread-found: ${thread.id}`);

      // Atualizar integração se mudou (chip migrou)
      if (integracaoId && thread.whatsapp_integration_id !== integracaoId) {
        const historicoAtual = thread.origin_integration_ids || [];
        const novoHistorico = [...new Set([...historicoAtual, integracaoId])];
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          whatsapp_integration_id: integracaoId,
          origin_integration_ids: novoHistorico
        });
      }
    } else {
      console.log(`[${VERSION}] 🆕 Criando thread ÚNICA para este contato.`);
      const agora = new Date().toISOString();
      thread = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoId,
        conexao_id: integracaoId,
        origin_integration_ids: integracaoId ? [integracaoId] : [],
        thread_type: 'contact_external',
        channel: 'whatsapp',
        is_canonical: true,
        status: 'aberta',
        primeira_mensagem_at: agora,
        last_message_at: agora,
        last_inbound_at: agora,
        last_message_sender: 'contact',
        last_message_content: String(dados.content || '').substring(0, 100),
        last_media_type: dados.mediaType || 'none',
        total_mensagens: 1,
        unread_count: 1,
      });
      console.log(`[${VERSION}] ✅ new-canonical-thread-created: ${thread.id}`);
    }
  } catch (e) {
    if (e?.message?.includes('429') || e?.message?.includes('Rate limit') || e?.message?.includes('Limite de taxa')) {
      console.warn(`[${VERSION}] ⚠️ Rate limit persistente ao buscar/criar thread — retornando 429 para Z-API reenviar`);
      // ✅ FIX CRÍTICO: retornar 429 (não 200) para que Z-API reenvie o webhook automaticamente
      return Response.json({ success: false, error: 'rate_limit_thread' }, { status: 429, headers: corsHeaders });
    }
    console.error(`[${VERSION}] ❌ Erro thread:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_thread' });
  }

  if (!thread || !thread.id) {
    console.error(`[${VERSION}] ❌ ERRO CRÍTICO: Thread não foi criada/encontrada!`);
    return jsonServerError({ success: false, error: 'thread_not_found' });
  }

  // DEDUPLICAÇÃO POR CONTEÚDO (janela 60s para cobrir retries lentos da Z-API)
  try {
    const sessentaSegundosAtras = new Date(Date.now() - 60000).toISOString();
    const msgRecentes = await retryOn429(() => base44.asServiceRole.entities.Message.filter({
      thread_id: thread.id,
      sender_type: 'contact',
      created_date: { $gte: sessentaSegundosAtras }
    }, '-created_date', 20), 5, 1500);
    const duplicadaPorConteudo = msgRecentes.find(m =>
      m.media_type === dados.mediaType &&
      m.content === dados.content &&
      Math.abs(new Date(m.created_date) - Date.now()) < 60000
    );
    if (duplicadaPorConteudo) {
      console.log(`[${VERSION}] ⏭️ DUPLICATA POR CONTEÚDO (60s): ${duplicadaPorConteudo.id}`);
      return jsonOk({ success: true, ignored: true, reason: 'duplicata_conteudo' });
    }
  } catch (err) {
    // ✅ FAIL-SAFE: sem dedup confiável → Z-API reenvia (preferível a duplicar)
    console.error(`[${VERSION}] 🔴 Dedup conteúdo falhou — retornando 429 para Z-API reenviar:`, err.message);
    return Response.json(
      { success: false, error: 'dedup_content_check_failed', retry: true },
      { status: 429, headers: corsHeaders }
    );
  }

  // MÍDIA
  let mediaUrlFinal = dados.mediaUrl ?? null;
  let midiaPersistida = false;
  if (dados.mediaUrl && dados.mediaType && dados.mediaType !== 'none') {
    const isUrlTemporaria = dados.mediaUrl.includes('mmg.whatsapp.net') ||
                            dados.mediaUrl.includes('z-api.io') ||
                            dados.mediaUrl.includes('api.z-api.io') ||
                            dados.mediaUrl.includes('backblazeb2.com') ||
                            dados.mediaUrl.includes('temp-file-download');
    if (!isUrlTemporaria) midiaPersistida = true;
  }

  // isFromMe já foi filtrado nas camadas 1 e 2 acima — aqui sempre false
  const isFromMe = false;

  // SALVAR MENSAGEM
  let mensagem;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      recipient_id: null,
      recipient_type: null,
      content: dados.content,
      media_url: mediaUrlFinal,
      media_type: dados.mediaType,
      media_caption: dados.mediaCaption ?? null,
      channel: 'whatsapp',
      visibility: 'public_to_customer',
      status: 'recebida',
      whatsapp_message_id: dados.messageId ?? null,
      sent_at: new Date().toISOString(),
      metadata: {
        analise_multimodal: null,
        midia_persistida: midiaPersistida,
        deleted: null,
        whatsapp_integration_id: integracaoId,
        instance_id: dados.instanceId ?? null,
        connected_phone: connectedPhone ?? null,
        canal_nome: integracaoInfo?.nome ?? null,
        canal_numero: integracaoInfo?.numero ?? (connectedPhone ? '+' + connectedPhone : null),
        vcard: dados.vcard ?? null,
        location: dados.location ?? null,
        quoted_message: dados.quotedMessage ?? null,
        processed_by: VERSION,
        original_media_url: dados.mediaUrl ?? null,
        synced_from_whatsapp_web: false,
      },
    });
    console.log(`[${VERSION}] ✅ Mensagem salva: ${mensagem.id} | Mídia persistida: ${midiaPersistida}`);
    // ⚡ CAMADA 0: marcar messageId como processado IMEDIATAMENTE após salvar
    // (antes dos steps não-críticos de mídia/thread/processInbound)
    marcarComoProcessado(dados.messageId);
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro salvar mensagem:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_salvar_mensagem' });
  }

  // WORKER DE MÍDIA (fire-and-forget)
  if (dados.mediaUrl && dados.mediaType && dados.mediaType !== 'none' && !midiaPersistida) {
    base44.asServiceRole.functions.invoke('persistirMidiaZapi', {
      file_id: dados.messageId || mensagem.id,
      integration_id: integracaoId,
      media_type: dados.mediaType,
      media_url: dados.mediaUrl,
      message_id: mensagem.id,
      filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(e => console.error(`[${VERSION}] ⚠️ Worker mídia erro:`, e?.message));
  }

  // ATUALIZAR THREAD
  try {
    const agora = new Date().toISOString();
    const threadUpdate = {
      last_message_at: agora,
      last_message_sender: isFromMe ? 'user' : 'contact',
      last_message_content: String(dados.content || '').substring(0, 100),
      last_media_type: dados.mediaType || 'none',
      total_mensagens: (thread.total_mensagens || 0) + 1,
      status: 'aberta',
      whatsapp_integration_id: integracaoId || thread.whatsapp_integration_id
    };
    if (!isFromMe) {
      threadUpdate.last_inbound_at = agora;
      threadUpdate.unread_count = (thread.unread_count || 0) + 1;
    } else {
      threadUpdate.last_outbound_at = agora;
      const fromApi = payloadBruto?.fromApi === true;
      if (!fromApi) {
        threadUpdate.last_human_message_at = agora;
      }
    }
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
    console.log(`[${VERSION}] 💭 Thread atualizada | Total: ${threadUpdate.total_mensagens} | Não lidas: ${threadUpdate.unread_count}`);
  } catch (updateError) {
    console.error(`[${VERSION}] ⚠️ Erro ao atualizar thread:`, updateError.message);
  }

  // PROCESSAR VIA CÉREBRO CENTRAL
  try {
    let integracaoCompleta = null;
    if (integracaoId) {
      try {
        integracaoCompleta = await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId);
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro ao buscar integração completa:`, e.message);
      }
    }
    if (!integracaoCompleta && thread.whatsapp_integration_id) {
      try {
        integracaoCompleta = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id);
      } catch (e) { /* silencioso */ }
    }

    if (isFromMe) {
      console.log(`[${VERSION}] ⏭️ fromMe=true — sync salvo, processInbound SKIPPED`);
      return jsonOk({ success: true, message_id: mensagem.id, synced_from_whatsapp_web: true });
    }

    base44.asServiceRole.functions.invoke('processInbound', {
      message: mensagem,
      contact: contato,
      thread: thread,
      integration: integracaoCompleta,
      provider: 'z_api',
      messageContent: dados.content,
      rawPayload: payloadBruto
    }).then(() => {
      console.log(`[${VERSION}] ✅ processInbound executado com sucesso`);
    }).catch(error => {
      console.error(`[${VERSION}] ⚠️ Erro ao invocar processInbound:`, error?.message || error);
    });
  } catch (error) {
    console.error(`[${VERSION}] ⚠️ Erro ao preparar processInbound:`, error?.message || error);
  }

  // AUDIT LOG — atualiza o lock existente (se criado na Camada 0.5) ou cria um novo
  try {
    if (lockRecord && lockRecord.id) {
      await base44.asServiceRole.entities.ZapiPayloadNormalized.update(lockRecord.id, {
        integration_id: integracaoId,
        sucesso_processamento: true
      });
    } else {
      // Fallback: sem lock prévio (falhou na criação), cria audit log normal
      await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: payloadBruto,
        instance_identificado: dados.instanceId ?? null,
        integration_id: integracaoId,
        message_id: dados.messageId ?? null,
        evento: 'ReceivedCallback',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: true,
        provider: 'z_api'
      });
    }
  } catch (auditErr) {
    console.warn(`[${VERSION}] ⚠️ Erro ao salvar audit log:`, auditErr?.message);
  }

  const duracao = Date.now() - inicio;
  console.log(`[${VERSION}] ✅ SUCESSO! Msg: ${mensagem.id} | De: ${dados.from} | Int: ${integracaoId} | ${duracao}ms`);

  ;(async () => {
    try {
      await base44.asServiceRole.entities.SkillExecution.create({
        skill_name: 'webhook_zapi_inbound',
        triggered_by: 'webhook',
        execution_mode: 'autonomous_safe',
        context: { integration_id: integracaoId, canal: integracaoInfo?.numero || connectedPhone, telefone_origem: dados.from, media_type: dados.mediaType },
        success: true,
        duration_ms: Date.now() - _tsInicio,
        metricas: { mensagens_processadas: 1, midia_persistida: midiaPersistida ? 1 : 0, tempo_total_ms: duracao }
      });
    } catch (e) {
      console.warn('[webhookFinalZapi] SkillExecution falhou (non-blocking):', e.message);
    }
  })();

  return jsonOk({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    status: 'processed_inline'
  });
}