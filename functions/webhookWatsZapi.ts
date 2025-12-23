import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v10.0.0 INGESTÃO PURA (CÉREBRO ISOLADO)
// ============================================================================
// 1. Webhook BURRO: só recebe, valida, salva e responde 200.
// 2. Inteligência isolada em processInbound (URA/Promoções/Roteamento).
// 3. Zero imports de lib/ - elimina "os error 2" definitivamente.
// ============================================================================

const VERSION = 'v10.0.0-PURE-INGESTION';
const BUILD_DATE = '2025-12-18';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Imports dinâmicos movidos para dentro das funções para evitar OS Error 2

// ============================================================================
// GATE 0: CLASSIFICADOR CIRÚRGICO DE EVENTOS Z-API
// ============================================================================
/**
 * Classifica o tipo de evento recebido da Z-API ANTES de normalizar
 * Retorna: 'system-status' | 'user-message' | 'ignore'
 */
function classifyZapiEvent(payload) {
  if (!payload || typeof payload !== 'object') return 'ignore';

  const tipo = String(payload.type || '').toLowerCase();

  // 1️⃣ STATUS/ACK: MessageStatusCallback (READ, DELIVERED, etc)
  if (tipo === 'messagestatuscallback' || (payload.status && Array.isArray(payload.ids))) {
    return 'system-status';
  }

  // 2️⃣ MENSAGEM DE USUÁRIO: ReceivedCallback
  if (tipo === 'receivedcallback') {
    return 'user-message';
  }

  // 3️⃣ OUTROS: QRCode, Connection, etc
  return 'ignore';
}

// ============================================================================
// FILTRO ULTRA-RÁPIDO (Pós-Classificação)
// ============================================================================
function deveIgnorar(payload, classification) {
  if (classification === 'ignore') return 'evento_desconhecido';
  if (classification === 'system-status') return 'ruido_sistema';

  const phone = String(payload.phone || '').toLowerCase();

  if (phone.includes('status@') || phone.includes('@broadcast') || 
      phone.includes('@lid') || phone.includes('@g.us')) {
    return 'jid_sistema';
  }

  if (payload.isGroup === true) return 'grupo';
  if (payload.fromMe === true) return 'from_me';
  if (!payload.phone) return 'sem_telefone';

  return null; // ✅ Passa para normalização
}

// ============================================================================
// NORMALIZAR PAYLOAD
// ============================================================================
function normalizarPayload(payload) {
  try {
    const tipo = String(payload.type || payload.event || '').toLowerCase();
    const instanceId = payload.instanceId || payload.instance || null;

    if (tipo.includes('qrcode')) {
      return { type: 'qrcode', instanceId, qrCodeUrl: payload.qrcode || payload.qr };
    }

    if (tipo.includes('connection')) {
      return { type: 'connection', instanceId, status: payload.connected ? 'conectado' : 'desconectado' };
    }

    if (tipo.includes('messagestatuscallback')) {
      return {
        type: 'message_update',
        instanceId,
        messageId: payload.ids?.[0] || null,
        status: payload.status
      };
    }

    // Inline phone normalization
    const telefone = payload.phone || '';
    const numeroLimpo = (telefone || '').replace(/\D/g, '');
    if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

    let mediaType = 'none';
    let fileId = null;
    let originalMediaUrl = null;
    
    let conteudoRaw = payload.text?.message || payload.body || '';
    let conteudo = '';
    
    // Simplificado - sempre usa pending_download
    if (payload.image) {
      mediaType = 'image';
      fileId = payload.image.fileId || payload.image.id || null;
      originalMediaUrl = payload.image.imageUrl || payload.image.url || payload.image.urlWithToken || payload.fileUrl || null;
      conteudo = conteudoRaw || payload.image.caption || '[Imagem]';
    } else if (payload.video) {
      mediaType = 'video';
      fileId = payload.video.fileId || payload.video.id || null;
      originalMediaUrl = payload.video.videoUrl || payload.video.url || payload.video.urlWithToken || payload.fileUrl || null;
      conteudo = conteudoRaw || payload.video.caption || '[Vídeo]';
    } else if (payload.audio) {
      mediaType = 'audio';
      fileId = payload.audio.fileId || payload.audio.id || null;
      originalMediaUrl = payload.audio.audioUrl || payload.audio.url || payload.audio.urlWithToken || payload.fileUrl || null;
      conteudo = '[Áudio]';
    } else if (payload.document || payload.file || payload.documentUrl || payload.fileUrl) {
      // 📎 DETECÇÃO ROBUSTA: Z-API tem variações document/file/documentUrl/fileUrl
      const docField = payload.document || payload.file || {};
      const docUrl = docField.documentUrl || docField.url || docField.link || 
                     payload.documentUrl || payload.fileUrl || payload.mediaUrl;

      mediaType = 'document';
      fileId = docField.fileId || docField.id || payload.fileId || null;
      originalMediaUrl = docUrl || null;
      conteudo = conteudoRaw || docField.caption || docField.fileName || payload.caption || '[PDF/Documento]';

      console.log(`[ZAPI] 📎 DOCUMENTO DETECTADO:`, {
        fileId,
        url: originalMediaUrl?.substring(0, 80),
        fileName: docField.fileName || payload.fileName,
        caption: conteudo
      });
    } else if (payload.sticker) {
      mediaType = 'sticker';
      fileId = payload.sticker.fileId || payload.sticker.id || null;
      originalMediaUrl = payload.sticker.stickerUrl || payload.sticker.url || payload.fileUrl || null;
      conteudo = '[Sticker]';
    } else if (payload.contactMessage || payload.vcard) {
      mediaType = 'contact';
      conteudo = '📇 Contato compartilhado';
    } else if (payload.location) {
      // 📍 DETECÇÃO ROBUSTA DE LOCALIZAÇÃO
      const loc = payload.location;
      
      mediaType = 'location';
      conteudo = '📍 Localização recebida';
      
      console.log(`[ZAPI] 📍 LOCALIZAÇÃO DETECTADA:`, {
        lat: loc.latitude,
        lng: loc.longitude,
        name: loc.name,
        address: loc.address,
        url: loc.url,
        rawKeys: Object.keys(loc)
      });
    } else {
      conteudo = conteudoRaw;
    }

    if (!conteudo && mediaType === 'none') {
      return { type: 'unknown', error: 'mensagem_vazia' };
    }

    // ✅ NORMALIZAR LOCATION SE NECESSÁRIO
    let locationMetadata = null;
    if (mediaType === 'location' && payload.location) {
      const { normalizeLocation } = await import('./lib/normalizeLocation.js');
      const locNormalized = normalizeLocation({ provider: 'zapi', raw: payload });
      if (locNormalized) {
        locationMetadata = locNormalized.metadata;
      }
    }

    return {
      type: 'message',
      instanceId,
      messageId: payload.messageId,
      from: numeroLimpo,
      content: String(conteudo || '').trim(),
      mediaType,
      originalMediaUrl,
      fileId,
      mediaCaption: payload.image?.caption || payload.video?.caption,
      pushName: payload.senderName || payload.chatName,
      vcard: payload.contactMessage || payload.vcard,
      location: payload.location,
      quotedMessage: payload.quotedMsg,
      locationMetadata
    };
  } catch (err) {
    console.error('🔴 [CRITICAL] Erro em normalizarPayload:', err.message);
    return { type: 'unknown', error: 'normalization_failed', raw_error: err.message };
  }
}

// ============================================================================
// HANDLERS
// ============================================================================
async function handleQRCode(dados, base44) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'qrcode' }, { headers: corsHeaders });
}

async function handleConnection(dados, base44) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        status: dados.status,
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'connection', status: dados.status }, { headers: corsHeaders });
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );
    if (mensagens.length > 0) {
      const statusMap = { 'READ': 'lida', 'READ_BY_ME': 'lida', 'DELIVERED': 'entregue', 'SENT': 'enviada' };
      const novoStatus = statusMap[dados.status];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
      }
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'status_update' }, { headers: corsHeaders });
}

// ============================================================================
// HANDLE MESSAGE - PIPELINE UNIFICADO
// ============================================================================
async function handleMessage(dados, payloadBruto, base44) {
  console.log('[ZAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[ZAPI] INICIO handleMessage (Inline) | Tipo:', dados.mediaType);
  
  const inicio = Date.now();
  
  const [dupResult, intResult] = await Promise.all([
    dados.messageId 
      ? base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: dados.messageId }, '-created_date', 1).catch(() => [])
      : Promise.resolve([]),
    dados.instanceId
      ? base44.asServiceRole.entities.WhatsAppIntegration.filter({ instance_id_provider: dados.instanceId }, '-created_date', 1).catch(() => [])
      : Promise.resolve([])
  ]);

  if (dupResult.length > 0) {
    return Response.json({ success: true, ignored: true, reason: 'duplicata' }, { headers: corsHeaders });
  }

  let integracaoId = null;
  let integracaoInfo = null;
  if (intResult.length > 0) {
    integracaoId = intResult[0].id;
    integracaoInfo = { nome: intResult[0].nome_instancia, numero: intResult[0].numero_telefone };
  }
  
  const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
  const profilePicUrl = payloadBruto.photo || payloadBruto.senderName?.profilePicUrl || payloadBruto.profilePicUrl || null;

  // GET OR CREATE CONTACT (Inline)
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
    console.error('[ZAPI] Erro Contact:', err.message);
    contato = { id: 'fallback_' + dados.from.replace(/\D/g, '') };
  }

  // GET OR CREATE THREAD (Inline)
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
    console.error('[ZAPI] Erro Thread:', err.message);
    thread = { id: 'fallback_thread_' + Date.now() };
  }

  // CRIAR MENSAGEM (pending_download se tem mídia, exceto location)
  let mensagem = null;
  try {
    const baseMetadata = {
      whatsapp_integration_id: integracaoId,
      instance_id: dados.instanceId,
      connected_phone: connectedPhone,
      canal_nome: integracaoInfo?.nome || null,
      canal_numero: integracaoInfo?.numero || (connectedPhone ? '+' + connectedPhone : null),
      vcard: dados.vcard,
      location: dados.location,
      quoted_message: dados.quotedMessage,
      file_id: dados.fileId,
      original_media_url: dados.originalMediaUrl,
      processed_by: 'v10_inline',
      provider: 'z_api'
    };

    // ✅ Se tem locationMetadata normalizado, mesclar
    const finalMetadata = dados.locationMetadata 
      ? { ...baseMetadata, ...dados.locationMetadata }
      : baseMetadata;

    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: dados.content,
      media_url: dados.mediaType !== 'none' && dados.mediaType !== 'location' ? 'pending_download' : null,
      media_type: dados.mediaType,
      media_caption: dados.mediaCaption,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: dados.messageId,
      sent_at: new Date().toISOString(),
      metadata: finalMetadata
    });
    console.log('[ZAPI] Message salva DB:', mensagem.id);
    
    // ✅ LOG DE VALIDAÇÃO LOCATION
    if (dados.mediaType === 'location') {
      console.log('📍 [SAVED LOCATION ZAPI]', {
        mediaType: dados.mediaType,
        content: dados.content,
        location: finalMetadata?.location || finalMetadata?.location?.location
      });
    }
  } catch (err) {
    console.error('[ZAPI] Erro salvar mensagem:', err.message);
    return Response.json({ success: false, error: 'db_save_error' }, { headers: corsHeaders });
  }

  // ATUALIZAR THREAD STATUS (Básico)
  try {
    const threadUpdates = {
      last_message_content: dados.content.substring(0, 200),
      last_message_at: new Date().toISOString(),
      last_inbound_at: new Date().toISOString(), // ✅ CRÍTICO: Timestamp separado para mensagens RECEBIDAS
      last_message_sender: 'contact',
      last_media_type: dados.mediaType,
      unread_count: (thread.unread_count || 0) + 1,
      status: 'aberta'
    };
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdates);
    console.log('[ZAPI] ✅ Thread atualizada (last_inbound_at registrado)');
  } catch (updateError) {
    console.error('[ZAPI] ⚠️ Erro ao atualizar thread:', updateError.message);
  }

  // TRIGGER PERSISTÊNCIA DE MÍDIA (Fire-and-Forget) - exceto location
  if (dados.mediaType !== 'none' && dados.mediaType !== 'location' && dados.fileId) {
    console.log('[ZAPI] 🚀 Disparando worker de mídia...');
    base44.asServiceRole.functions.invoke('persistirMidiaZapi', {
      message_id: mensagem.id,
      file_id: dados.fileId,
      integration_id: integracaoId,
      media_type: dados.mediaType,
      filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(e => console.error('[ZAPI] Erro trigger mídia:', e.message));
  }

  // DISPARAR CÉREBRO (Async Fire-and-Forget)
  try {
    console.log('[ZAPI] 🚀 Disparando processInbound (Cérebro separado)...');
    
    let integracaoObj = null;
    if (integracaoId) {
      try {
        integracaoObj = await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId);
      } catch (e) {
        console.warn('[ZAPI] ⚠️ Integração não encontrada, enviando ID:', e.message);
        integracaoObj = { id: integracaoId };
      }
    }

    // Fire-and-Forget: Se falhar, não trava o 200 OK do webhook
    base44.asServiceRole.functions.invoke('processInbound', {
      message: mensagem,
      contact: contato,
      thread: thread,
      integration: integracaoObj,
      provider: 'z_api',
      messageContent: dados.content
    }).catch(e => console.error('[ZAPI] ⚠️ Erro no processInbound (não afeta ingestão):', e.message));
    
    console.log('[ZAPI] ✅ Cérebro disparado (isolado)');
  } catch (err) {
    console.error('[ZAPI] ⚠️ Erro ao disparar Cérebro:', err.message);
  }

  // RETORNO FINAL (Sempre Sucesso)
  const duracao = Date.now() - inicio;
  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    status: 'processed_inline',
    duration_ms: duracao
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
    return Response.json({ version: VERSION, status: 'ok' }, { headers: corsHeaders });
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
    
    // 🚨 ESPIÃO PDF: Captura JSON exato quando detecta documento
    if (body.includes('document') || body.includes('.pdf') || body.includes('file')) {
      console.log(`🚨 [ESPIÃO Z-API] PDF DETECTADO | Raw (200 chars):`, body.substring(0, 200));
      try {
        const parsed = JSON.parse(body);
        console.log(`🚨 [ESPIÃO Z-API] Campos documento:`, JSON.stringify({
          has_document: !!parsed.document,
          has_file: !!parsed.file,
          document_keys: parsed.document ? Object.keys(parsed.document) : [],
          file_keys: parsed.file ? Object.keys(parsed.file) : []
        }));
      } catch {}
    }
    
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido' }, { status: 200, headers: corsHeaders });
  }

  // ✅ GATE 0: Classificar evento ANTES de qualquer normalização
  const classification = classifyZapiEvent(payload);
  
  const motivoIgnorar = deveIgnorar(payload, classification);
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
        return await handleMessage(dados, payload, base44);
      default:
        return Response.json({ success: true, ignored: true }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error('[' + VERSION + '] ERRO:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});