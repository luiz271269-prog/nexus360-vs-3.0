import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizarTelefone } from './lib/phoneUtils.js';
import { connectionManager } from './lib/connectionManager.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v8.0.0 OTIMIZADO
// ============================================================================
// 1. Filtrar ULTRA-CEDO antes de qualquer operação
// 2. Logs MÍNIMOS - apenas mensagens reais salvas
// 3. Ignorar: status@broadcast, @lid, grupos, fromMe, typing
// 4. whatsapp_integration_id SEMPRE no metadata
// ============================================================================

const VERSION = 'v8.0.1';
const BUILD_DATE = '2025-11-25';
const BUILD_TIMESTAMP = '20251125-174500';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================================
// FILTRO ULTRA-RÁPIDO - Retorna motivo se IGNORAR, null se processar
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type || payload.event || '').toLowerCase();
  const phone = String(payload.phone || '').toLowerCase();

  // IGNORAR IMEDIATAMENTE: status@broadcast e JIDs de sistema
  if (phone.includes('status@') || phone.includes('@broadcast') || 
      phone.includes('@lid') || phone.includes('@g.us')) {
    return 'jid_sistema';
  }

  // PERMITIR: QR Code e Connection
  if (tipo.includes('qrcode') || tipo.includes('connection')) {
    return null;
  }

  // IGNORAR: Eventos de presença/digitação (alto volume)
  const eventosLixo = ['presencechatcallback', 'presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => tipo.includes(e))) {
    return 'evento_sistema';
  }

  // MessageStatusCallback - ignorar se for de status@broadcast
  if (tipo.includes('messagestatuscallback')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) {
      return 'status_broadcast';
    }
    return null; // Processar atualizações de status válidas
  }

  // Para mensagens recebidas
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

  // Mensagem real
  const telefone = payload.phone || '';
  const numeroLimpo = normalizarTelefone(telefone);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = payload.text?.message || payload.body || '';

  if (payload.image) {
    mediaType = 'image';
    mediaUrl = payload.image.imageUrl || payload.image.url;
    conteudo = conteudo || payload.image.caption || '[Imagem]';
  } else if (payload.video) {
    mediaType = 'video';
    mediaUrl = payload.video.videoUrl || payload.video.url;
    conteudo = conteudo || payload.video.caption || '[Vídeo]';
  } else if (payload.audio) {
    mediaType = 'audio';
    mediaUrl = payload.audio.audioUrl || payload.audio.url;
    conteudo = '[Áudio]';
  } else if (payload.document) {
    mediaType = 'document';
    mediaUrl = payload.document.documentUrl || payload.document.url;
    conteudo = conteudo || '[Documento]';
  } else if (payload.sticker) {
    mediaType = 'sticker';
    mediaUrl = payload.sticker.stickerUrl;
    conteudo = '[Sticker]';
  } else if (payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (payload.location) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  }

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: conteudo,
    mediaType,
    mediaUrl,
    mediaCaption: payload.image?.caption || payload.video?.caption,
    pushName: payload.senderName || payload.chatName,
    vcard: payload.contactMessage || payload.vcard,
    location: payload.location,
    quotedMessage: payload.quotedMsg
  };
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

  // FILTRO ULTRA-RÁPIDO (sem logs)
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

async function handleMessage(dados, payloadBruto, base44) {
  const inicio = Date.now();
  
  // Verificar duplicata
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

  // Buscar integração
  let integracaoId = null;
  if (dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId }, '-created_date', 1
      );
      if (int.length > 0) integracaoId = int[0].id;
    } catch (e) {}
  }

  // Buscar/criar contato
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
    await base44.asServiceRole.entities.Contact.update(contato.id, update);
  } else {
    contato = await base44.asServiceRole.entities.Contact.create({
      nome: dados.pushName || dados.from,
      telefone: dados.from,
      tipo_contato: 'lead',
      whatsapp_status: 'verificado',
      ultima_interacao: new Date().toISOString()
    });
  }

  // Buscar/criar thread
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
      total_mensagens: 1,
      unread_count: 1
    });
  }

  // Salvar mensagem
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
      processed_by: VERSION
    }
  });

  // Audit log (apenas mensagens reais)
  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: true
    });
  } catch (e) {}

  const duracao = Date.now() - inicio;
  console.log('[' + VERSION + '] ✅ Msg:', mensagem.id, '| De:', dados.from, '| Int:', integracaoId, '| ' + duracao + 'ms');

  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao
  }, { headers: corsHeaders });
}