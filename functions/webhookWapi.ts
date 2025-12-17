import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { processarMidiaWapi } from './wapiMediaHandler.js';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v11.0.0 SOLUCAO DEFINITIVA
// ============================================================================
// CORRECOES v11.0.0:
// 1. Eliminado "os error 2" - zero acesso ao filesystem
// 2. Midia 100% em memoria usando wapiMediaHandler
// 3. Normalizacao padrao WhatsApp para integracao com sistema
// 4. Import dinamico do inboundCore para isolar falhas
// ============================================================================

const VERSION = 'v11.0.0-SERVERLESS-SAFE';
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
// NORMALIZACAO DE PAYLOAD
// ============================================================================
async function normalizarPayload(payload) {
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
  let conteudoRaw = '';
  let downloadSpec = null;
  
  // Processar texto simples
  if (msgContent.conversation) {
    conteudoRaw = msgContent.conversation;
  } else if (msgContent.extendedTextMessage) {
    conteudoRaw = msgContent.extendedTextMessage.text;
  }
  // Extrair metadados de mídia (SEM chamar API)
  else if (msgContent.imageMessage) {
    mediaType = 'image';
    conteudoRaw = msgContent.imageMessage.caption || '[Imagem]';
    downloadSpec = {
      mediaKey: msgContent.imageMessage.mediaKey,
      directPath: msgContent.imageMessage.directPath,
      mimetype: msgContent.imageMessage.mimetype,
      type: 'image'
    };
  } else if (msgContent.videoMessage) {
    mediaType = 'video';
    conteudoRaw = msgContent.videoMessage.caption || '[Vídeo]';
    downloadSpec = {
      mediaKey: msgContent.videoMessage.mediaKey,
      directPath: msgContent.videoMessage.directPath,
      mimetype: msgContent.videoMessage.mimetype,
      type: 'video'
    };
  } else if (msgContent.audioMessage) {
    mediaType = 'audio';
    conteudoRaw = '[Áudio]';
    downloadSpec = {
      mediaKey: msgContent.audioMessage.mediaKey,
      directPath: msgContent.audioMessage.directPath,
      mimetype: msgContent.audioMessage.mimetype,
      type: 'audio'
    };
  } else if (msgContent.documentMessage) {
    mediaType = 'document';
    conteudoRaw = msgContent.documentMessage.caption || msgContent.documentMessage.fileName || '[Documento]';
    downloadSpec = {
      mediaKey: msgContent.documentMessage.mediaKey,
      directPath: msgContent.documentMessage.directPath,
      mimetype: msgContent.documentMessage.mimetype,
      type: 'document'
    };
  } else if (msgContent.stickerMessage) {
    mediaType = 'sticker';
    conteudoRaw = '[Sticker]';
    downloadSpec = {
      mediaKey: msgContent.stickerMessage.mediaKey,
      directPath: msgContent.stickerMessage.directPath,
      mimetype: msgContent.stickerMessage.mimetype,
      type: 'sticker'
    };
  } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
    mediaType = 'contact';
    conteudoRaw = '📇 Contato compartilhado';
  } else if (msgContent.locationMessage) {
    mediaType = 'location';
    conteudoRaw = '📍 Localização';
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
    mediaCaption: downloadSpec?.caption,
    pushName: payload.pushName || payload.senderName || payload.sender?.pushName,
    vcard: msgContent.contactMessage || msgContent.contactsArrayMessage,
    location: msgContent.locationMessage,
    quotedMessage: payload.quotedMsg || msgContent.extendedTextMessage?.contextInfo?.quotedMessage,
    downloadSpec: downloadSpec,
    fileName: conteudoRaw || null
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
// HANDLE MESSAGE - PIPELINE SIMPLIFICADO
// ============================================================================
async function handleMessage(dados, payloadBruto, base44, req) {
  console.log('[WAPI] INICIO handleMessage | Tipo midia:', dados.mediaType);
  
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
    media_url: dados.downloadSpec ? 'pending_download' : null,
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
      downloadSpec: dados.downloadSpec || null,
      midia_persistida: false
    }
  });

  console.log('[WAPI] Message criada:', mensagem.id);

  // 🚀 TRIGGER DE PERSISTÊNCIA (alinhado com Z-API)
  if (dados.mediaType && dados.mediaType !== 'none' && dados.downloadSpec) {
    console.log('[WAPI] Disparando persistência de mídia em background...');
    
    // Fire-and-forget (não espera terminar para não travar webhook)
    base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
      message_id: mensagem.id,
      integration_id: integracaoId,
      downloadSpec: dados.downloadSpec,
      filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(err => {
      console.error('[WAPI] Erro ao disparar persistência:', err?.message);
    });
  }
  
  // Import dinamico do inboundCore para isolar falhas
  try {
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
        provider: 'w_api'
      }, { headers: corsHeaders });
    }
    
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
    
    const duracao = Date.now() - inicio;
    console.log('[WAPI] CONCLUIDO EM', duracao, 'ms');
    
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      duration_ms: duracao,
      pipeline: pipelineResult.pipeline,
      actions: pipelineResult.actions,
      provider: 'w_api'
    }, { headers: corsHeaders });
    
  } catch (coreError) {
    console.error('[WAPI] Erro no inboundCore (isolado):', coreError?.message);
    console.error('[WAPI] Stack:', coreError?.stack);
    
    // Retorna sucesso mesmo com erro no core para nao reenviar mensagem
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      duration_ms: duracao,
      pipeline: ['core_error_isolated'],
      warning: 'inboundCore falhou mas mensagem foi salva',
      provider: 'w_api'
    }, { headers: corsHeaders });
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  console.log('[WAPI-WEBHOOK] REQUEST RECEBIDO | Metodo:', req.method);
  
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

  const dados = await normalizarPayload(payload);
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
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});