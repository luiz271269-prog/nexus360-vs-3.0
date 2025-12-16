import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v9.0.0 PIPELINE UNIFICADO
// ============================================================================
// CORREÇÕES v9.0.0:
// 1. Imports dinâmicos para evitar erro de deployment
// 2. Pipeline unificado com inboundCore.js
// 3. Micro-URA + Promoções + Roteamento integrados
// ============================================================================

const VERSION = 'v9.0.0-PIPELINE';
const BUILD_DATE = '2025-12-16';

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
// NORMALIZAÇÃO DE TELEFONE
// ============================================================================
function normalizarTelefoneUnificado(telefone) {
  if (!telefone) return null;
  let numeroLimpo = String(telefone).split('@')[0];
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  return apenasNumeros;
}

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
// EXTRAIR MÍDIA
// ============================================================================
function extrairMediaUrl(payload, msgContent, tipoMidia) {
  const camposRaiz = [
    payload.mediaUrl, payload.media?.url, payload.downloadUrl,
    payload.fileUrl, payload.url, payload.media?.downloadUrl, payload.urlMedia
  ];
  
  const camposMsgContent = {
    image: [msgContent?.imageMessage?.url, msgContent?.imageMessage?.directPath, msgContent?.imageMessage?.mediaUrl],
    video: [msgContent?.videoMessage?.url, msgContent?.videoMessage?.directPath],
    audio: [msgContent?.audioMessage?.url, msgContent?.audioMessage?.directPath],
    document: [msgContent?.documentMessage?.url, msgContent?.documentMessage?.directPath],
    sticker: [msgContent?.stickerMessage?.url, msgContent?.stickerMessage?.directPath]
  };
  
  const camposDoTipo = camposMsgContent[tipoMidia] || [];
  for (const campo of camposDoTipo) {
    if (campo && typeof campo === 'string' && campo.startsWith('http')) return campo;
  }
  for (const campo of camposRaiz) {
    if (campo && typeof campo === 'string' && campo.startsWith('http')) return campo;
  }
  return null;
}

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
  const numeroLimpo = normalizarTelefoneUnificado(senderId);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  const msgContent = payload.msgContent || {};
  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = '';
  let mediaMetadata = {};
  
  if (msgContent.imageMessage) {
    mediaType = 'image';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'image');
    conteudo = mediaMetadata.caption || '[Imagem]';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'image');
    if (!mediaUrl && msgContent.imageMessage?.mediaKey) {
      mediaMetadata.messageStruct = msgContent.imageMessage;
      mediaMetadata.requiresDownload = true;
    }
  } else if (msgContent.videoMessage) {
    mediaType = 'video';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'video');
    conteudo = mediaMetadata.caption || '[Vídeo]';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'video');
    if (!mediaUrl && msgContent.videoMessage?.mediaKey) {
      mediaMetadata.messageStruct = msgContent.videoMessage;
      mediaMetadata.requiresDownload = true;
    }
  } else if (msgContent.audioMessage) {
    mediaType = 'audio';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'audio');
    conteudo = mediaMetadata.isPTT ? '[Áudio de voz]' : '[Áudio]';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'audio');
    if (!mediaUrl && msgContent.audioMessage?.mediaKey) {
      mediaMetadata.messageStruct = msgContent.audioMessage;
      mediaMetadata.requiresDownload = true;
    }
  } else if (msgContent.documentMessage) {
    mediaType = 'document';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'document');
    conteudo = mediaMetadata.fileName ? `[Documento: ${mediaMetadata.fileName}]` : '[Documento]';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'document');
    if (!mediaUrl && msgContent.documentMessage?.mediaKey) {
      mediaMetadata.messageStruct = msgContent.documentMessage;
      mediaMetadata.requiresDownload = true;
    }
  } else if (msgContent.stickerMessage) {
    mediaType = 'sticker';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'sticker');
    conteudo = '[Sticker]';
  } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (msgContent.locationMessage) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  } else if (msgContent.extendedTextMessage) {
    conteudo = msgContent.extendedTextMessage.text || '';
  } else if (msgContent.conversation) {
    conteudo = msgContent.conversation;
  }

  if (!conteudo && mediaType === 'none') {
    conteudo = payload.body || payload.text || payload.message?.text || payload.content || '';
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

  let contato;
  const contatos = await base44.asServiceRole.entities.Contact.filter(
    { telefone: dados.from }, '-created_date', 1
  );

  if (contatos.length > 0) {
    contato = contatos[0];
    const update = { ultima_interacao: new Date().toISOString() };
    if (dados.pushName && (!contato.nome || contato.nome === dados.from)) {
      update.nome = dados.pushName;
    }
    if (profilePicUrl && profilePicUrl !== 'null' && contato.foto_perfil_url !== profilePicUrl) {
      update.foto_perfil_url = profilePicUrl;
      update.foto_perfil_atualizada_em = new Date().toISOString();
    }
    await base44.asServiceRole.entities.Contact.update(contato.id, update);
  } else {
    contato = await base44.asServiceRole.entities.Contact.create({
      nome: dados.pushName || dados.from,
      telefone: dados.from,
      tipo_contato: 'lead',
      whatsapp_status: 'verificado',
      ultima_interacao: new Date().toISOString(),
      foto_perfil_url: profilePicUrl || null,
      foto_perfil_atualizada_em: profilePicUrl ? new Date().toISOString() : null
    });
  }

  let thread;
  const threads = await base44.asServiceRole.entities.MessageThread.filter(
    { contact_id: contato.id }, '-last_message_at', 1
  );

  if (threads.length > 0) {
    thread = threads[0];
    const threadUpdate = {
      last_message_at: new Date().toISOString(),
      last_message_sender: 'contact',
      last_message_content: (dados.content || '').substring(0, 100),
      last_media_type: dados.mediaType,
      unread_count: (thread.unread_count || 0) + 1,
      total_mensagens: (thread.total_mensagens || 0) + 1,
      status: 'aberta'
    };
    if (integracaoId && !thread.whatsapp_integration_id) {
      threadUpdate.whatsapp_integration_id = integracaoId;
    }
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
  } else {
    thread = await base44.asServiceRole.entities.MessageThread.create({
      contact_id: contato.id,
      whatsapp_integration_id: integracaoId,
      status: 'aberta',
      primeira_mensagem_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'contact',
      last_message_content: (dados.content || '').substring(0, 100),
      last_media_type: dados.mediaType,
      total_mensagens: 1,
      unread_count: 1,
      pre_atendimento_setor_explicitamente_escolhido: false,
      pre_atendimento_ativo: false,
      pre_atendimento_state: 'INIT',
      transfer_pending: false
    });
  }

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
    console.error('[W-API WEBHOOK] ERRO:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});