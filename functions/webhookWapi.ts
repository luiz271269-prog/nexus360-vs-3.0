import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v9.1.0 PIPELINE UNIFICADO + MÍDIA PERSISTENTE
// ============================================================================
// CORREÇÕES v9.1.0:
// 1. TODAS as mídias recebidas agora são marcadas para download obrigatório
// 2. mediaUrl = 'pending_download' para imagem, vídeo, áudio, documento, sticker
// 3. Consistência com Z-API: baixar e salvar permanentemente todas as mídias
// ============================================================================

const VERSION = 'v9.1.0-PERSISTENT-MEDIA';
const BUILD_DATE = '2025-12-17';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const requestQueue = new Map();
const RATE_LIMIT_MS = 1000;
const integrationCache = new Map();
const CACHE_TTL = 60000;

// ============================================================================
// IMPORTS
// ============================================================================
import { normalizePhone } from './lib/phoneNormalizer.js';
import { getOrCreateContact, getOrCreateThread } from './lib/contactManager.js';
import { emojiDebug, processTextWithEmojis, getTextStats } from './lib/emojiHelper.js';

// ============================================================================
// FILTRO
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';
  const evento = String(payload.event || '').toLowerCase();
  const senderId = payload.sender?.id || payload.chat?.id || '';
  const phone = senderId.replace(/@.*$/, '').toLowerCase();

  if (phone.includes('status') || senderId.includes('@broadcast') || senderId.includes('@g.us')) {
    return 'jid_sistema_ou_grupo';
  }

  if (evento.includes('qrcode') || evento.includes('connection') || evento.includes('webhookconectado')) {
    return null;
  }

  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => evento.includes(e))) return 'evento_sistema';

  if (evento === 'webhookreceived' || payload.msgContent) {
    if (payload.isGroup === true) return 'grupo';
    if (payload.fromMe === true) return 'from_me';
    if (!senderId) return 'sem_telefone';
    return null;
  }

  if (evento === 'webhookdelivery' || evento.includes('delivery')) return null;
  return 'evento_desconhecido';
}

// ============================================================================
// EXTRAIR METADADOS MÍDIA
// ============================================================================
function extrairMetadadosMidia(msgContent, tipoMidia) {
  const tipoMap = {
    image: 'imageMessage', video: 'videoMessage', audio: 'audioMessage',
    document: 'documentMessage', sticker: 'stickerMessage'
  };
  const msgKey = tipoMap[tipoMidia];
  const mediaMsg = msgContent?.[msgKey] || {};
  return {
    caption: mediaMsg.caption || null,
    fileName: mediaMsg.fileName || mediaMsg.title || null,
    mimetype: mediaMsg.mimetype || null,
    fileSize: mediaMsg.fileLength || mediaMsg.size || null,
    isPTT: mediaMsg.ptt === true
  };
}

// ============================================================================
// NORMALIZAR PAYLOAD
// ============================================================================
function normalizarPayload(payload) {
  const evento = String(payload.event || '').toLowerCase();
  const instanceId = payload.instanceId || null;

  if (evento.includes('qrcode') || payload.qrcode) {
    return { type: 'qrcode', instanceId, qrCodeUrl: payload.qrcode || payload.qr || payload.base64 };
  }

  if (evento.includes('connection') || evento.includes('webhookconectado')) {
    const status = payload.connected === true ? 'conectado' : 'desconectado';
    return { type: 'connection', instanceId, status };
  }

  if (evento === 'webhookdelivery' || evento.includes('delivery')) {
    return {
      type: 'message_update',
      instanceId,
      messageId: payload.messageId || payload.key?.id,
      status: payload.status || payload.ack
    };
  }

  const senderId = payload.sender?.id || payload.chat?.id || '';
  const numeroLimpo = normalizePhone(senderId);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  const msgContent = payload.msgContent || {};
  let mediaType = 'none';
  let mediaUrl = null;
  let conteudoRaw = '';
  let mediaMetadata = {};
  
  // ✅ EXTRAÇÃO SEGURA DE TEXTO COM EMOJIS
  // ✅ v9.1.0: TODAS as mídias marcadas como 'pending_download'
  if (msgContent.imageMessage) {
    mediaType = 'image';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'image');
    conteudoRaw = mediaMetadata.caption || '[Imagem]';
    mediaUrl = 'pending_download'; // ✅ Marca para download obrigatório
    mediaMetadata.messageStruct = msgContent.imageMessage;
    mediaMetadata.requiresDownload = true;
  } else if (msgContent.videoMessage) {
    mediaType = 'video';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'video');
    conteudoRaw = mediaMetadata.caption || '[Vídeo]';
    mediaUrl = 'pending_download'; // ✅ Marca para download obrigatório
    mediaMetadata.messageStruct = msgContent.videoMessage;
    mediaMetadata.requiresDownload = true;
  } else if (msgContent.audioMessage) {
    mediaType = 'audio';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'audio');
    conteudoRaw = mediaMetadata.isPTT ? '[Áudio de voz]' : '[Áudio]';
    mediaUrl = 'pending_download'; // ✅ Marca para download obrigatório
    mediaMetadata.messageStruct = msgContent.audioMessage;
    mediaMetadata.requiresDownload = true;
  } else if (msgContent.documentMessage) {
    mediaType = 'document';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'document');
    conteudoRaw = mediaMetadata.fileName ? `[Documento: ${mediaMetadata.fileName}]` : '[Documento]';
    mediaUrl = 'pending_download'; // ✅ Marca para download obrigatório
    mediaMetadata.messageStruct = msgContent.documentMessage;
    mediaMetadata.requiresDownload = true;
  } else if (msgContent.stickerMessage) {
    mediaType = 'sticker';
    conteudoRaw = '[Sticker]';
    mediaUrl = 'pending_download'; // ✅ Marca para download obrigatório
    mediaMetadata.messageStruct = msgContent.stickerMessage;
    mediaMetadata.requiresDownload = true;
  } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
    mediaType = 'contact';
    conteudoRaw = '📇 Contato compartilhado';
  } else if (msgContent.locationMessage) {
    mediaType = 'location';
    conteudoRaw = '📍 Localização';
  } else if (msgContent.extendedTextMessage) {
    conteudoRaw = msgContent.extendedTextMessage.text || '';
  } else if (msgContent.conversation) {
    conteudoRaw = msgContent.conversation;
  }

  if (!conteudoRaw && mediaType === 'none') {
    conteudoRaw = payload.body || payload.text || payload.message?.text || payload.content || '';
  }
  
  // Debug texto bruto
  emojiDebug('WAPI_RAW_TEXT', conteudoRaw);
  
  // Processar com segurança de emoji
  const conteudo = processTextWithEmojis(conteudoRaw);
  
  // Debug após processamento
  emojiDebug('WAPI_PROCESSED_TEXT', conteudo);
  const stats = getTextStats(conteudo);
  if (stats.hasEmojis) {
    console.log('[WAPI] ✅ Mensagem com emojis:', stats);
  }

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message', instanceId,
    messageId: payload.messageId || payload.key?.id,
    from: numeroLimpo, content: conteudo,
    mediaType, mediaUrl,
    mediaCaption: mediaMetadata.caption || msgContent.imageMessage?.caption || msgContent.videoMessage?.caption,
    fileName: mediaMetadata.fileName,
    mimetype: mediaMetadata.mimetype,
    messageStruct: mediaMetadata.messageStruct,
    requiresDownload: mediaMetadata.requiresDownload || false,
    pushName: payload.pushName || payload.senderName || payload.sender?.pushName,
    vcard: msgContent.contactMessage || msgContent.contactsArrayMessage,
    location: msgContent.locationMessage,
    quotedMessage: payload.quotedMsg || msgContent.extendedTextMessage?.contextInfo?.quotedMessage
  };
}

// ============================================================================
// HANDLERS
// ============================================================================
async function handleQRCode(dados, base44) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'qrcode', provider: 'w_api' }, { headers: corsHeaders });
}

async function handleConnection(dados, base44) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        status: dados.status,
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'connection', status: dados.status, provider: 'w_api' }, { headers: corsHeaders });
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );
    if (mensagens.length > 0) {
      const statusMap = { 
        'READ': 'lida', 'read': 'lida', '3': 'lida',
        'DELIVERED': 'entregue', 'delivered': 'entregue', '2': 'entregue',
        'SENT': 'enviada', 'sent': 'enviada', '1': 'enviada'
      };
      const novoStatus = statusMap[dados.status] || statusMap[String(dados.status)];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
      }
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'status_update', provider: 'w_api' }, { headers: corsHeaders });
}

// ============================================================================
// HANDLE MESSAGE - PIPELINE UNIFICADO
// ============================================================================
async function handleMessage(dados, payloadBruto, base44, req) {
  const inicio = Date.now();
  
  const lastRequest = requestQueue.get(dados.from);
  if (lastRequest && (Date.now() - lastRequest) < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
  }
  requestQueue.set(dados.from, Date.now());
  
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId }, '-created_date', 1
      );
      if (dup.length > 0) {
        return Response.json({ success: true, ignored: true, reason: 'duplicata' }, { headers: corsHeaders });
      }
    } catch (e) {}
  }

  let integracaoId = null;
  if (dados.instanceId) {
    const cached = integrationCache.get(dados.instanceId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      integracaoId = cached.id;
    } else {
      try {
        const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
        );
        if (int.length > 0) {
          integracaoId = int[0].id;
          integrationCache.set(dados.instanceId, { id: integracaoId, timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  const profilePicUrl = payloadBruto.sender?.profilePicture || payloadBruto.sender?.profilePicThumbObj?.eurl || null;

  // ✅ USAR GERENCIADOR ÚNICO (evita duplicação)
  const contato = await getOrCreateContact(base44, {
    telefone: dados.from,
    nome: dados.pushName || dados.from,
    pushName: dados.pushName,
    instance_id: dados.instanceId,
    profilePicUrl: profilePicUrl
  });

  const thread = await getOrCreateThread(base44, {
    contact_id: contato.id,
    integration_id: integracaoId,
    instance_id: dados.instanceId
  });

  const mensagem = await base44.asServiceRole.entities.Message.create({
    thread_id: thread.id,
    sender_id: contato.id,
    sender_type: 'contact',
    content: dados.content,
    media_url: dados.mediaUrl || null,
    media_type: dados.mediaType,
    media_caption: dados.mediaCaption,
    channel: 'whatsapp',
    status: 'recebida',
    whatsapp_message_id: dados.messageId,
    sent_at: new Date().toISOString(),
    metadata: {
      whatsapp_integration_id: integracaoId,
      instance_id: dados.instanceId,
      vcard: dados.vcard,
      location: dados.location,
      quoted_message: dados.quotedMessage,
      processed_by: VERSION,
      provider: 'w_api',
      messageStruct: dados.messageStruct,
      requiresDownload: dados.requiresDownload
    }
  });

  console.log('[WAPI-WEBHOOK] ✅ Mensagem criada:', {
    id: mensagem.id,
    media_type: dados.mediaType,
    media_url: dados.mediaUrl,
    requiresDownload: dados.requiresDownload,
    hasMessageStruct: !!dados.messageStruct
  });

  // ✅ PERSISTIR MÍDIA EM BACKGROUND (crítico para W-API) - BLINDADO
  if (dados.requiresDownload && dados.messageStruct) {
    console.log(`[WAPI-WEBHOOK] 📥 TENTANDO INICIAR DOWNLOAD | Tipo: ${dados.mediaType} | Mensagem: ${mensagem.id}`);
    console.log('[WAPI-WEBHOOK] 📦 Payload persistência:', {
      message_id: mensagem.id,
      media_type: dados.mediaType,
      integration_id: integracaoId,
      has_message_struct: !!dados.messageStruct,
      filename: dados.fileName,
      mimetype: dados.mimetype
    });
    
    // Blindar invoke para NUNCA derrubar o webhook
    try {
      console.log('[WAPI-WEBHOOK] 🔄 Chamando base44.asServiceRole.functions.invoke...');
      
      const invokePromise = base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
        message_id: mensagem.id,
        media_type: dados.mediaType,
        integration_id: integracaoId,
        message_struct: dados.messageStruct,
        filename: dados.fileName,
        mimetype: dados.mimetype
      });
      
      console.log('[WAPI-WEBHOOK] ✅ Invoke chamado com sucesso, aguardando execução em background');
      
      Promise.resolve(invokePromise).then(() => {
        console.log('[WAPI-WEBHOOK] ✅ persistirMidiaWapi completou com sucesso');
      }).catch(err => {
        console.error('[WAPI-WEBHOOK] ❌ Erro async ao persistir mídia:', err?.message);
        console.error('[WAPI-WEBHOOK] ❌ Stack:', err?.stack);
        console.error('[WAPI-WEBHOOK] ❌ Full error:', JSON.stringify(err, null, 2));
      });
      
    } catch (err) {
      console.error('[WAPI-WEBHOOK] ❌ invoke persistirMidiaWapi falhou SINCRONAMENTE:', err?.message);
      console.error('[WAPI-WEBHOOK] ❌ Stack:', err?.stack);
      console.error('[WAPI-WEBHOOK] ❌ Full error:', JSON.stringify(err, null, 2));
    }
  } else {
    console.log('[WAPI-WEBHOOK] ⏭️ Mídia NÃO requer download:', {
      requiresDownload: dados.requiresDownload,
      hasMessageStruct: !!dados.messageStruct,
      mediaType: dados.mediaType
    });
  }

  const now = new Date().toISOString();

  // ============================================================================
  // PIPELINE ÚNICO IMUTÁVEL - v9.0.0
  // ============================================================================
  const integracao = integracaoId 
    ? await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId).catch(() => null)
    : null;

  const { processInboundEvent } = await import('./lib/inboundCore.js');
  
  const pipelineResult = await processInboundEvent({
    base44,
    contact: contato,
    thread: thread,
    message: mensagem,
    integration: integracao,
    provider: 'w_api',
    messageContent: dados.content
  });
  
  console.log('[' + VERSION + '] Pipeline:', pipelineResult.pipeline);
  console.log('[' + VERSION + '] Actions:', pipelineResult.actions);
  
  // Se foi consumido (micro-URA 1/2), retornar imediatamente
  if (pipelineResult.consumed) {
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      duration_ms: duracao,
      pipeline: pipelineResult.pipeline,
      consumed: true,
      action: pipelineResult.action,
      provider: 'w_api'
    }, { headers: corsHeaders });
  }
  
  // Se teve hard-stop, retornar
  if (pipelineResult.stop) {
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      duration_ms: duracao,
      pipeline: pipelineResult.pipeline,
      stop: true,
      reason: pipelineResult.reason,
      provider: 'w_api'
    }, { headers: corsHeaders });
  }
  
  // Retorno normal
  const duracao = Date.now() - inicio;
  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    pipeline: pipelineResult.pipeline,
    actions: pipelineResult.actions,
    novo_ciclo: pipelineResult.novoCiclo,
    provider: 'w_api'
  }, { headers: corsHeaders });
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return Response.json({ version: VERSION, status: 'ok', provider: 'w_api' }, { headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req.clone());
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  let payload;
  try {
    const body = await req.text();
    if (!body) return Response.json({ success: true, ignored: true }, { headers: corsHeaders });
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'JSON invalido' }, { status: 200, headers: corsHeaders });
  }

  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    return Response.json({ success: true, ignored: true, reason: motivoIgnorar }, { headers: corsHeaders });
  }

  const dados = normalizarPayload(payload);
  if (dados.type === 'unknown') {
    return Response.json({ success: true, ignored: true, reason: dados.error }, { headers: corsHeaders });
  }

  try {
    switch (dados.type) {
      case 'qrcode':
        return await handleQRCode(dados, base44);
      case 'connection':
        return await handleConnection(dados, base44);
      case 'message_update':
        return await handleMessageUpdate(dados, base44);
      case 'message':
        return await handleMessage(dados, payload, base44, req);
      default:
        return Response.json({ success: true, ignored: true }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error('[W-API WEBHOOK] ERRO:', error?.message);
    console.error('[W-API WEBHOOK] STACK:', error?.stack);
    console.error('[W-API WEBHOOK] FULL ERROR:', JSON.stringify(error, null, 2));
    return Response.json({ success: false, error: error.message, stack: error?.stack }, { status: 500, headers: corsHeaders });
  }
});