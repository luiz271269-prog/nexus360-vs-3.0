// redeploy: 2026-03-25T00:00-FIX-AUTOMERGE-GUARD
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Fonte: functions/lib/phoneNormalizer.js (inlined — Deno não suporta imports locais)
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let n = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!n || n.length < 10) return null;
  n = n.replace(/^0+/, '');
  if (!n.startsWith('55')) {
    if (n.length === 10 || n.length === 11) n = '55' + n;
  }
  if (n.startsWith('55') && n.length === 12) {
    if (['6','7','8','9'].includes(n[4])) n = n.substring(0, 4) + '9' + n.substring(4);
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
const VERSION = 'v11.0.0-CLEAN';
const BUILD_DATE = '2026-03-25';

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
    phone.includes('@lid') ||
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
  } else if (payload.audio) {
    mediaType = 'audio';
    if (typeof payload.audio === 'object') {
      mediaUrl = payload.audio.audioUrl ?? payload.audio.url ?? payload.audio.link ?? payload.audio.mediaUrl ?? null;
    } else if (typeof payload.audio === 'string' && payload.audio.startsWith('http')) {
      mediaUrl = payload.audio;
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

  // ✅ CAMADA 2B: Guard inter-chips — rejeitar mensagens ENTRE chips internos
  const fromCanon = String(dados.from).replace(/\D/g, '').replace(/^0+/, '');
  try {
    const integracoes = await retryOn429(() => base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { status: 'conectado' }, '-created_date', 100
    ));
    const chipNumbers = integracoes
      .map(i => (i.numero_telefone || '').replace(/\D/g, '').replace(/^0+/, ''))
      .filter(n => n && n.length > 8);
    if (chipNumbers.includes(fromCanon)) {
      const chipInfo = integracoes.find(i => (i.numero_telefone || '').replace(/\D/g, '').replace(/^0+/, '') === fromCanon);
      console.log(`[${VERSION}] 🛡️ GUARD inter-chips: from=${dados.from} é um chip interno (${chipInfo?.nome_instancia})`);
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
      ));
      if (dup.length > 0) {
        console.log(`[${VERSION}] ⏭️ DUPLICATA por messageId: ${dados.messageId}`);
        return jsonOk({ success: true, ignored: true, reason: 'duplicata_message_id' });
      }
    } catch (err) {
      console.warn(`[${VERSION}] ⚠️ Erro ao verificar duplicata por messageId:`, err.message);
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
  let contato;
  try {
    console.log(`[${VERSION}] 🎯 Chamando getOrCreateContactCentralized para: ${dados.from}`);
    const resultado = await retryOn429(() => base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
      telefone: dados.from,
      pushName: dados.pushName || null,
      profilePicUrl: null,
      integracaoId: integracaoId
    }));
    if (!resultado?.data?.success || !resultado?.data?.contact) {
      console.error(`[${VERSION}] ❌ getOrCreateContactCentralized falhou:`, resultado?.data);
      return jsonServerError({ success: false, error: 'erro_contato_dedup' });
    }
    contato = resultado.data.contact;
    console.log(`[${VERSION}] ✅ Contato: ${contato.id} | ${contato.nome} | Ação: ${resultado.data.action}`);
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro ao chamar getOrCreateContactCentralized:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_contato' });
  }

  // BUSCAR/CRIAR THREAD — sem AUTO-MERGE (pertence ao UnificadorContatosCentralizado, não ao webhook)
  let thread = null;
  try {
    console.log(`[${VERSION}] 🔍 Buscando thread canônica para contact_id: "${contato.id}"`);
    const threads = await retryOn429(() => base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id, is_canonical: true, status: 'aberta' },
      '-last_message_at',
      1
    ));

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
      console.warn(`[${VERSION}] ⚠️ Rate limit ao buscar/criar thread — descartando sem criar thread fantasma`);
      return jsonOk({ success: true, received: true, queued: true, reason: 'rate_limit_thread' });
    }
    console.error(`[${VERSION}] ❌ Erro thread:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_thread' });
  }

  if (!thread || !thread.id) {
    console.error(`[${VERSION}] ❌ ERRO CRÍTICO: Thread não foi criada/encontrada!`);
    return jsonServerError({ success: false, error: 'thread_not_found' });
  }

  // DEDUPLICAÇÃO POR CONTEÚDO
  try {
    const doisSegundosAtras = new Date(Date.now() - 2000).toISOString();
    const msgRecentes = await retryOn429(() => base44.asServiceRole.entities.Message.filter({
      thread_id: thread.id,
      sender_type: 'contact',
      created_date: { $gte: doisSegundosAtras }
    }, '-created_date', 10));
    const duplicadaPorConteudo = msgRecentes.find(m =>
      m.media_type === dados.mediaType &&
      m.content === dados.content &&
      Math.abs(new Date(m.created_date) - Date.now()) < 2000
    );
    if (duplicadaPorConteudo) {
      console.log(`[${VERSION}] ⏭️ DUPLICATA POR CONTEÚDO: ${duplicadaPorConteudo.id}`);
      return jsonOk({ success: true, ignored: true, reason: 'duplicata_conteudo' });
    }
  } catch (err) {
    console.warn(`[${VERSION}] ⚠️ Erro ao verificar duplicata por conteúdo:`, err.message);
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

  // AUDIT LOG
  try {
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