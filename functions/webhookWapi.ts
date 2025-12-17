import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v10.0.0 CORREÇÃO DEFINITIVA MÍDIA
// ============================================================================
// CORREÇÕES v10.0.0:
// 1. Extração correta de mediaKey + directPath (campos obrigatórios W-API)
// 2. downloadSpec estruturado para persistência determinística
// 3. Fire-and-forget sem travar pipeline
// 4. Zero acesso ao filesystem (100% em memória)
// ============================================================================

const VERSION = 'v10.0.0-MEDIA-FIX';
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
// EXTRAIR METADADOS MÍDIA + CAMPOS OBRIGATÓRIOS W-API
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
    isPTT: mediaMsg.ptt === true,
    // ✅ CAMPOS OBRIGATÓRIOS W-API (manual oficial)
    mediaKey: mediaMsg.mediaKey || null,
    directPath: mediaMsg.directPath || null
  };
}

// ============================================================================
// NORMALIZAR PAYLOAD + DOWNLOAD SPEC
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
  let downloadSpec = null;
  
  // ✅ DETECÇÃO + EXTRAÇÃO ESTRUTURADA (cada mídia gera downloadSpec)
  if (msgContent.imageMessage) {
    mediaType = 'image';
    const meta = extrairMetadadosMidia(msgContent, 'image');
    conteudoRaw = meta.caption || '[Imagem]';
    
    // ✅ DOWNLOAD SPEC ESTRUTURADO (campos obrigatórios W-API)
    if (meta.mediaKey && meta.directPath) {
      downloadSpec = {
        type: 'image',
        mediaKey: meta.mediaKey,
        directPath: meta.directPath,
        mimetype: meta.mimetype || 'image/jpeg'
      };
      mediaUrl = 'pending_download';
    }
  } else if (msgContent.videoMessage) {
    mediaType = 'video';
    const meta = extrairMetadadosMidia(msgContent, 'video');
    conteudoRaw = meta.caption || '[Vídeo]';
    
    if (meta.mediaKey && meta.directPath) {
      downloadSpec = {
        type: 'video',
        mediaKey: meta.mediaKey,
        directPath: meta.directPath,
        mimetype: meta.mimetype || 'video/mp4'
      };
      mediaUrl = 'pending_download';
    }
  } else if (msgContent.audioMessage) {
    mediaType = 'audio';
    const meta = extrairMetadadosMidia(msgContent, 'audio');
    conteudoRaw = meta.isPTT ? '[Áudio de voz]' : '[Áudio]';
    
    if (meta.mediaKey && meta.directPath) {
      downloadSpec = {
        type: 'audio',
        mediaKey: meta.mediaKey,
        directPath: meta.directPath,
        mimetype: meta.mimetype || 'audio/ogg'
      };
      mediaUrl = 'pending_download';
    }
  } else if (msgContent.documentMessage) {
    mediaType = 'document';
    const meta = extrairMetadadosMidia(msgContent, 'document');
    conteudoRaw = meta.fileName ? `[Documento: ${meta.fileName}]` : '[Documento]';
    
    if (meta.mediaKey && meta.directPath) {
      downloadSpec = {
        type: 'document',
        mediaKey: meta.mediaKey,
        directPath: meta.directPath,
        mimetype: meta.mimetype || 'application/pdf'
      };
      mediaUrl = 'pending_download';
    }
  } else if (msgContent.stickerMessage) {
    mediaType = 'sticker';
    const meta = extrairMetadadosMidia(msgContent, 'sticker');
    conteudoRaw = '[Sticker]';
    
    if (meta.mediaKey && meta.directPath) {
      downloadSpec = {
        type: 'sticker',
        mediaKey: meta.mediaKey,
        directPath: meta.directPath,
        mimetype: meta.mimetype || 'image/webp'
      };
      mediaUrl = 'pending_download';
    }
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

  const conteudo = String(conteudoRaw || '').trim();

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId || payload.key?.id,
    from: numeroLimpo,
    content: conteudo,
    mediaType,
    mediaUrl,
    downloadSpec, // ✅ Spec estruturado para persistência
    requiresDownload: !!downloadSpec, // ✅ Flag booleana
    mediaCaption: msgContent.imageMessage?.caption || msgContent.videoMessage?.caption,
    fileName: msgContent.documentMessage?.fileName,
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
// HANDLE MESSAGE - PIPELINE UNIFICADO + PERSISTÊNCIA ASSÍNCRONA
// ============================================================================
async function handleMessage(dados, payloadBruto, base44, req) {
  console.log('[WAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WAPI] STEP 1 - INÍCIO handleMessage');
  console.log('[WAPI] Tipo mídia:', dados.mediaType, '| RequiresDownload:', dados.requiresDownload);
  
  // ✅ LOG DIAGNÓSTICO (para matar problemas em 5min)
  if (dados.requiresDownload && dados.downloadSpec) {
    console.log('[WAPI] 🔍 DIAGNÓSTICO downloadSpec:', {
      type: dados.downloadSpec.type,
      hasMediaKey: !!dados.downloadSpec.mediaKey,
      hasDirectPath: !!dados.downloadSpec.directPath,
      mimetype: dados.downloadSpec.mimetype,
      mediaKeyPreview: dados.downloadSpec.mediaKey?.substring(0, 20),
      directPathPreview: dados.downloadSpec.directPath?.substring(0, 30)
    });
  }
  
  const inicio = Date.now();
  
  const lastRequest = requestQueue.get(dados.from);
  if (lastRequest && (Date.now() - lastRequest) < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
  }
  requestQueue.set(dados.from, Date.now());
  
  console.log('[WAPI] STEP 2 - Rate limit OK');
  
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId }, '-created_date', 1
      );
      if (dup.length > 0) {
        console.log('[WAPI] STEP 2.1 - Duplicata detectada, ignorando');
        return Response.json({ success: true, ignored: true, reason: 'duplicata' }, { headers: corsHeaders });
      }
    } catch (e) {}
  }
  
  console.log('[WAPI] STEP 3 - Dedup OK');
  console.log('[WAPI] STEP 4 - Resolvendo integração...');
  
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
  
  console.log('[WAPI] STEP 5 - Integração resolvida:', integracaoId);

  const profilePicUrl = payloadBruto.sender?.profilePicture || payloadBruto.sender?.profilePicThumbObj?.eurl || null;

  console.log('[WAPI] STEP 6 - Chamando getOrCreateContact...');
  
  const contato = await getOrCreateContact(base44, {
    telefone: dados.from,
    nome: dados.pushName || dados.from,
    pushName: dados.pushName,
    instance_id: dados.instanceId,
    profilePicUrl: profilePicUrl
  });
  
  console.log('[WAPI] STEP 7 - Contato OK:', contato.id);
  console.log('[WAPI] STEP 8 - Chamando getOrCreateThread...');

  const thread = await getOrCreateThread(base44, {
    contact_id: contato.id,
    integration_id: integracaoId,
    instance_id: dados.instanceId
  });
  
  console.log('[WAPI] STEP 9 - Thread OK:', thread.id);
  console.log('[WAPI] STEP 10 - Criando Message no banco...');
  
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
      downloadSpec: dados.downloadSpec, // ✅ Salvar spec para persistência
      requiresDownload: dados.requiresDownload
    }
  });

  console.log('[WAPI] STEP 11 - Message criada:', mensagem.id);
  
  // ✅ PERSISTÊNCIA ASSÍNCRONA (fire-and-forget, nunca trava pipeline)
  if (dados.requiresDownload && dados.downloadSpec) {
    console.log('[WAPI] STEP 12 - Mídia detectada, disparando persistirMidiaWapi...');
    
    // ✅ VALIDAÇÃO PRÉ-INVOKE (evitar invoke inútil)
    if (!dados.downloadSpec.mediaKey || !dados.downloadSpec.directPath) {
      console.error('[WAPI] ❌ downloadSpec incompleto:', dados.downloadSpec);
    } else {
      try {
        // ✅ FIRE-AND-FORGET (Promise sem await)
        base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
          message_id: mensagem.id,
          integration_id: integracaoId,
          downloadSpec: dados.downloadSpec,
          filename: dados.fileName
        }).catch(err => {
          console.error('[WAPI] ❌ Erro async ao persistir mídia:', err?.message);
        });
        
        console.log('[WAPI] STEP 12.1 - Invoke disparado (background)');
      } catch (err) {
        console.error('[WAPI] ❌ Falha ao disparar invoke:', err?.message);
      }
    }
  } else {
    console.log('[WAPI] STEP 12 - Sem mídia para download ou downloadSpec ausente');
  }

  const now = new Date().toISOString();

  console.log('[WAPI] STEP 14 - Buscando integração completa...');
  
  const integracao = integracaoId 
    ? await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId).catch(() => null)
    : null;
  
  console.log('[WAPI] STEP 15 - Importando inboundCore...');

  let processInboundEvent;
  try {
    const module = await import('./lib/inboundCore.js');
    processInboundEvent = module.processInboundEvent;
    console.log('[WAPI] STEP 16 - inboundCore importado OK');
  } catch (e) {
    console.error('[WAPI] ❌ STEP 16.ERROR - Falha ao importar inboundCore:', e?.message);
    console.error('[WAPI] ❌ Stack:', e?.stack);
    throw e;
  }
  
  console.log('[WAPI] STEP 17 - Chamando processInboundEvent...');
  
  const pipelineResult = await processInboundEvent({
    base44,
    contact: contato,
    thread: thread,
    message: mensagem,
    integration: integracao,
    provider: 'w_api',
    messageContent: dados.content
  });
  
  console.log('[WAPI] STEP 18 - Pipeline concluído');
  console.log('[' + VERSION + '] Pipeline:', pipelineResult.pipeline);
  console.log('[' + VERSION + '] Actions:', pipelineResult.actions);
  
  // Se foi consumido (micro-URA 1/2), retornar imediatamente
  if (pipelineResult.consumed) {
    console.log('[WAPI] STEP 19 - Retornando (consumed)');
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
    console.log('[WAPI] STEP 19 - Retornando (stop)');
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
  console.log('[WAPI] STEP 19 - Retornando (sucesso normal)');
  const duracao = Date.now() - inicio;
  console.log('[WAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WAPI] ✅ CONCLUÍDO EM', duracao, 'ms');
  
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
  console.log('[WAPI-WEBHOOK] 🚀 REQUEST RECEBIDO | Método:', req.method);
  
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