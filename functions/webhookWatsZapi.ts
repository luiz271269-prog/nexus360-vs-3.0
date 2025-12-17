import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { connectionManager } from './lib/connectionManager.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v9.0.0 PIPELINE UNIFICADO
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
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Imports dinâmicos movidos para dentro das funções para evitar OS Error 2

// ============================================================================
// FILTRO ULTRA-RÁPIDO
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';
  const tipo = String(payload.type || payload.event || '').toLowerCase();
  const phone = String(payload.phone || '').toLowerCase();

  if (phone.includes('status@') || phone.includes('@broadcast') || 
      phone.includes('@lid') || phone.includes('@g.us')) {
    return 'jid_sistema';
  }

  if (tipo.includes('qrcode') || tipo.includes('connection')) return null;

  const eventosLixo = ['presencechatcallback', 'presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => tipo.includes(e))) return 'evento_sistema';

  if (tipo.includes('messagestatuscallback')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) return 'status_broadcast';
    return null;
  }

  if (tipo === 'receivedcallback' || (payload.phone && payload.messageId)) {
    if (payload.isGroup === true) return 'grupo';
    if (payload.fromMe === true) return 'from_me';
    if (!payload.phone) return 'sem_telefone';
    return null;
  }

  return 'evento_desconhecido';
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
    } else if (payload.document) {
      mediaType = 'document';
      fileId = payload.document.fileId || payload.document.id || null;
      originalMediaUrl = payload.document.documentUrl || payload.document.url || payload.document.urlWithToken || payload.fileUrl || null;
      conteudo = conteudoRaw || '[Documento]';
    } else if (payload.sticker) {
      mediaType = 'sticker';
      fileId = payload.sticker.fileId || payload.sticker.id || null;
      originalMediaUrl = payload.sticker.stickerUrl || payload.sticker.url || payload.fileUrl || null;
      conteudo = '[Sticker]';
    } else if (payload.contactMessage || payload.vcard) {
      mediaType = 'contact';
      conteudo = '📇 Contato compartilhado';
    } else if (payload.location) {
      mediaType = 'location';
      conteudo = '📍 Localização';
    } else {
      conteudo = conteudoRaw;
    }

    if (!conteudo && mediaType === 'none') {
      return { type: 'unknown', error: 'mensagem_vazia' };
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
      quotedMessage: payload.quotedMsg
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

  // CRIAR MENSAGEM (pending_download se tem mídia)
  let mensagem = null;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: dados.content,
      media_url: dados.mediaType !== 'none' ? 'pending_download' : null,
      media_type: dados.mediaType,
      media_caption: dados.mediaCaption,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: dados.messageId,
      sent_at: new Date().toISOString(),
      metadata: {
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
      }
    });
    console.log('[ZAPI] Message salva DB:', mensagem.id);
  } catch (err) {
    console.error('[ZAPI] Erro salvar mensagem:', err.message);
    return Response.json({ success: false, error: 'db_save_error' }, { headers: corsHeaders });
  }

  // TRIGGER PERSISTÊNCIA ASYNC (Fire-and-forget)
  if (dados.mediaType !== 'none' && dados.fileId) {
    console.log('[ZAPI] 🚀 Disparando worker de mídia...');
    base44.asServiceRole.functions.invoke('persistirMidiaZapi', {
      message_id: mensagem.id,
      file_id: dados.fileId,
      integration_id: integracaoId,
      media_type: dados.mediaType,
      filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(e => console.error('[ZAPI] Erro trigger mídia:', e.message));
  }

  // PIPELINE (Blindado)
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
      provider: 'z_api',
      messageContent: dados.content
    });

    console.log('[' + VERSION + '] Pipeline:', pipelineResult.pipeline);

    if (pipelineResult.consumed || pipelineResult.stop) {
      const duracao = Date.now() - inicio;
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        duration_ms: duracao,
        pipeline: pipelineResult.pipeline,
        consumed: pipelineResult.consumed,
        stop: pipelineResult.stop
      }, { headers: corsHeaders });
    }
  } catch (coreError) {
    console.error('🔴 [BLINDAGEM] Core falhou (Z-API):', coreError.message);
  }

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
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido' }, { status: 200, headers: corsHeaders });
  }

  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    return Response.json({ success: true, ignored: true, reason: motivoIgnorar }, { headers: corsHeaders });
  }

  const dados = normalizarPayload(payload);
  if (dados.type === 'unknown') {
    return Response.json({ success: true, ignored: true, reason: dados.error }, { headers: corsHeaders });
  }

  if (dados.instanceId) {
    connectionManager.register(dados.instanceId, { provider: 'z_api' });
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