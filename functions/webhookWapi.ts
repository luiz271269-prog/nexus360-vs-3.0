import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v12.0.0 INGESTÃO PURA
// ============================================================================
// ARQUITETURA LIMPA:
// 1. Este webhook é BURRO: só recebe, valida, salva e responde 200
// 2. Inteligência isolada em processInbound (URA/Pré-atendimento/Promoções)
// 3. Zero imports de lib/ - elimina "os error 2" definitivamente
// ============================================================================

const VERSION = 'v12.0.0-PURE-INGESTION';
const BUILD_DATE = '2025-12-18';

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
// NORMALIZAR PAYLOAD (BLINDADA E AUTOSSUFICIENTE)
// ============================================================================
// ATENÇÃO: NÃO IMPORTAR FUNÇÕES EXTERNAS AQUI DENTRO
// Esta função roda antes de tudo e não pode falhar.

function normalizarPayload(payload) {
  try {
    const evento = String(payload.event || '').toLowerCase();
    const instanceId = payload.instanceId || null;

    // 1. Tratamento de Eventos de Sistema
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

    // 2. Extração de Remetente (Inline Regex - Sem dependência externa)
    const senderId = payload.sender?.id || payload.chat?.id || '';
    const numeroLimpo = (senderId || '').replace(/\D/g, ''); // ✅ Inline, sem 'os error 2'

    if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

    // 3. Extração de Conteúdo e Mídia
    const msgContent = payload.msgContent || {};
    let mediaType = 'none';
    let conteudoRaw = '';
    let downloadSpec = null;

    // Função auxiliar interna para metadados (segura)
    const getMediaMeta = (obj) => ({
      caption: obj?.caption || null,
      fileName: obj?.fileName || obj?.title || null,
      mimetype: obj?.mimetype || null,
      mediaKey: obj?.mediaKey || null,
      directPath: obj?.directPath || null
    });

    if (msgContent.imageMessage) {
      mediaType = 'image';
      const meta = getMediaMeta(msgContent.imageMessage);
      // ✅ FIX VISUAL: Garante texto para imagens
      conteudoRaw = meta.caption || '📷 [Imagem recebida]';
      if (meta.mediaKey && meta.directPath) {
        downloadSpec = { ...meta, type: 'image', mimetype: meta.mimetype || 'image/jpeg' };
      }
    }
    else if (msgContent.videoMessage) {
      mediaType = 'video';
      const meta = getMediaMeta(msgContent.videoMessage);
      // ✅ FIX VISUAL: Garante texto para vídeos
      conteudoRaw = meta.caption || '🎥 [Vídeo recebido]';
      if (meta.mediaKey && meta.directPath) {
        downloadSpec = { ...meta, type: 'video', mimetype: meta.mimetype || 'video/mp4' };
      }
    }
    else if (msgContent.audioMessage) {
      mediaType = 'audio';
      const meta = getMediaMeta(msgContent.audioMessage);
      // ✅ FIX VISUAL: Garante texto para áudios
      conteudoRaw = msgContent.audioMessage.ptt ? '🎤 [Áudio de voz]' : '🎵 [Áudio recebido]';
      if (meta.mediaKey && meta.directPath) {
        downloadSpec = { ...meta, type: 'audio', mimetype: meta.mimetype || 'audio/ogg' };
      }
    }
    else if (msgContent.documentMessage) {
      mediaType = 'document';
      const meta = getMediaMeta(msgContent.documentMessage);
      const fileName = meta.fileName || 'arquivo';
      // ✅ FIX VISUAL: Garante texto descritivo para documentos
      conteudoRaw = meta.caption ? `${meta.caption} (${fileName})` : `📄 [Documento: ${fileName}]`;
      if (meta.mediaKey && meta.directPath) {
        downloadSpec = { ...meta, type: 'document', mimetype: meta.mimetype || 'application/pdf' };
      }
    }
    else if (msgContent.stickerMessage) {
      mediaType = 'sticker';
      const meta = getMediaMeta(msgContent.stickerMessage);
      conteudoRaw = '[Sticker]';
      if (meta.mediaKey && meta.directPath) {
        downloadSpec = { ...meta, type: 'sticker', mimetype: meta.mimetype || 'image/webp' };
      }
    }
    else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
      mediaType = 'contact';
      conteudoRaw = '📇 Contato compartilhado';
    }
    else if (msgContent.locationMessage) {
      mediaType = 'location';
      conteudoRaw = '📍 Localização';
    }
    else if (msgContent.extendedTextMessage) {
      conteudoRaw = msgContent.extendedTextMessage.text || '';
    }
    else if (msgContent.conversation) {
      conteudoRaw = msgContent.conversation;
    }

    // Fallback de texto
    if (!conteudoRaw && mediaType === 'none') {
      conteudoRaw = payload.body || payload.text || '';
    }

    return {
      type: 'message',
      instanceId,
      messageId: payload.messageId || payload.key?.id,
      from: numeroLimpo,
      content: String(conteudoRaw || '').trim(),
      mediaType,
      mediaCaption: downloadSpec?.caption,
      pushName: payload.pushName || payload.senderName || payload.sender?.pushName,
      vcard: msgContent.contactMessage || msgContent.contactsArrayMessage,
      location: msgContent.locationMessage,
      quotedMessage: payload.quotedMsg || msgContent.extendedTextMessage?.contextInfo?.quotedMessage,
      downloadSpec: downloadSpec,
      fileName: conteudoRaw || null
    };

  } catch (err) {
    // 🛡️ CATCH DE ÚLTIMA INSTÂNCIA DA NORMALIZAÇÃO
    console.error('🔴 [CRITICAL] Erro dentro de normalizarPayload:', err.message);

    // Retorna um objeto mínimo válido para não quebrar o webhook
    return {
      type: 'unknown',
      error: 'normalization_failed',
      raw_error: err.message
    };
  }
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
// HANDLE MESSAGE - 100% INLINE (ZERO DEPENDÊNCIAS EXTERNAS)
// ============================================================================
async function handleMessage(dados, payloadBruto, base44, req) {
  console.log('[WAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WAPI] INICIO handleMessage (Inline) | Tipo:', dados.mediaType);

  const inicio = Date.now();

  // 1. RATE LIMIT (Em memória)
  const lastRequest = requestQueue.get(dados.from);
  if (lastRequest && (Date.now() - lastRequest) < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }
  requestQueue.set(dados.from, Date.now());

  // 2. DEDUPLICAÇÃO
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

  // 3. RESOLVER INTEGRAÇÃO
  let integracaoId = null;
  if (dados.instanceId) {
    try {
      const cached = integrationCache.get(dados.instanceId);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        integracaoId = cached.id;
      } else {
        const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
        );
        if (int.length > 0) {
          integracaoId = int[0].id;
          integrationCache.set(dados.instanceId, { id: integracaoId, timestamp: Date.now() });
        }
      }
    } catch (e) { console.error('[WAPI] Erro ao resolver integração:', e.message); }
  }

  // 4. GET OR CREATE CONTACT (Inline)
  const profilePicUrl = payloadBruto.sender?.profilePicture || payloadBruto.sender?.profilePicThumbObj?.eurl || null;
  let contato = null;

  try {
    const existingContacts = await base44.asServiceRole.entities.Contact.filter(
      { telefone: dados.from }, '-created_date', 1
    );

    if (existingContacts.length > 0) {
      contato = existingContacts[0];
      if (profilePicUrl && contato.foto_perfil_url !== profilePicUrl) {
        await base44.asServiceRole.entities.Contact.update(contato.id, { foto_perfil_url: profilePicUrl });
      }
    } else {
      contato = await base44.asServiceRole.entities.Contact.create({
        telefone: dados.from,
        nome: dados.pushName || dados.from,
        foto_perfil_url: profilePicUrl
      });
    }
  } catch (err) {
    console.error('[WAPI] Erro crítico Contact:', err.message);
    contato = { id: 'fallback_' + dados.from.replace(/\D/g, '') };
  }

  // 5. GET OR CREATE THREAD (Inline)
  let thread = null;
  try {
    const existingThreads = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id }, '-created_date', 1
    );

    if (existingThreads.length > 0) {
      thread = existingThreads[0];
    } else {
      thread = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoId
      });
    }
  } catch (err) {
    console.error('[WAPI] Erro crítico Thread:', err.message);
    thread = { id: 'fallback_thread_' + Date.now() };
  }

  // 6. CRIAR MENSAGEM
  let mensagem = null;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
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
        downloadSpec: dados.downloadSpec,
        processed_by: 'v11_inline',
        provider: 'w_api'
      }
    });
    console.log('[WAPI] Message salva DB:', mensagem.id);
  } catch (err) {
    console.error('[WAPI] Erro ao salvar mensagem:', err.message);
    return Response.json({ success: false, error: 'db_save_error' }, { headers: corsHeaders });
  }

  // 7. TRIGGER PERSISTÊNCIA (Async Fire-and-Forget)
  if (dados.downloadSpec) {
    console.log('[WAPI] 🚀 Disparando worker de mídia...');
    base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
      message_id: mensagem.id,
      integration_id: integracaoId,
      downloadSpec: dados.downloadSpec,
      filename: dados.fileName || dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(e => console.error('[WAPI] Erro trigger mídia:', e.message));
  }

  // 8. ATUALIZAR THREAD STATUS (Básico)
  try {
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      last_message_content: dados.content.substring(0, 200),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'contact',
      last_media_type: dados.mediaType,
      unread_count: (thread.unread_count || 0) + 1,
      status: 'aberta'
    });
    console.log('[WAPI] ✅ Thread atualizada');
  } catch (updateError) {
    console.error('[WAPI] ⚠️ Erro ao atualizar thread:', updateError.message);
  }

  // 9. DISPARAR CÉREBRO (Async Fire-and-Forget)
  try {
    console.log('[WAPI] 🚀 Disparando processInbound (Cérebro separado)...');
    
    let integracaoObj = null;
    if (integracaoId) {
      try {
        integracaoObj = await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId);
      } catch (e) {
        console.warn('[WAPI] ⚠️ Integração não encontrada, enviando ID:', e.message);
        integracaoObj = { id: integracaoId };
      }
    }

    // Fire-and-Forget: Se falhar, não trava o 200 OK do webhook
    base44.asServiceRole.functions.invoke('processInbound', {
      message: mensagem,
      contact: contato,
      thread: thread,
      integration: integracaoObj,
      provider: 'w_api',
      messageContent: dados.content
    }).catch(e => console.error('[WAPI] ⚠️ Erro no processInbound (não afeta ingestão):', e.message));
    
    console.log('[WAPI] ✅ Cérebro disparado (isolado)');
  } catch (err) {
    console.error('[WAPI] ⚠️ Erro ao disparar Cérebro:', err.message);
  }

  // 9. RETORNO FINAL (Sempre Sucesso)
  const duracao = Date.now() - inicio;
  return Response.json({
    success: true,
    message_id: mensagem ? mensagem.id : 'error',
    contact_id: contato.id,
    thread_id: thread.id,
    status: 'processed_inline',
    duration_ms: duracao
  }, { headers: corsHeaders });
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