import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizarTelefone } from './lib/phoneUtils.js';
import { connectionManager } from './lib/connectionManager.js';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v1.0.0 (Paralelo ao Z-API)
// ============================================================================
// Esta função é específica para a W-API e não interfere no webhookWatsZapi
// TODO: Ajustar parsing conforme formato de eventos da W-API
// ============================================================================

const VERSION = 'v1.0.0-wapi';
const BUILD_DATE = '2025-01-27';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// FILTRO ULTRA-RÁPIDO - Retorna motivo se IGNORAR, null se processar
// TODO: Ajustar conforme formato de eventos da W-API
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type || payload.event || '').toLowerCase();
  const phone = String(payload.phone || payload.from || payload.sender || '').toLowerCase();

  // IGNORAR: status@broadcast e JIDs de sistema
  if (phone.includes('status@') || phone.includes('@broadcast') || 
      phone.includes('@lid') || phone.includes('@g.us')) {
    return 'jid_sistema';
  }

  // PERMITIR: QR Code e Connection
  if (tipo.includes('qrcode') || tipo.includes('connection')) {
    return null;
  }

  // IGNORAR: Eventos de presença/digitação
  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => tipo.includes(e))) {
    return 'evento_sistema';
  }

  // Para mensagens recebidas
  // TODO: Ajustar condição conforme formato W-API
  if (tipo === 'message' || tipo === 'received' || (payload.phone && payload.messageId)) {
    if (payload.isGroup === true) return 'grupo';
    if (payload.fromMe === true) return 'from_me';
    if (!payload.phone && !payload.from && !payload.sender) return 'sem_telefone';
    return null;
  }

  // Status de mensagem
  if (tipo.includes('status') || tipo.includes('ack')) {
    return null;
  }

  return 'evento_desconhecido';
}

// ============================================================================
// NORMALIZAR PAYLOAD
// TODO: Ajustar conforme formato de payload da W-API
// ============================================================================
function normalizarPayload(payload) {
  const tipo = String(payload.type || payload.event || '').toLowerCase();
  const instanceId = payload.instanceId || payload.instance || payload.session || null;

  if (tipo.includes('qrcode')) {
    return { 
      type: 'qrcode', 
      instanceId, 
      qrCodeUrl: payload.qrcode || payload.qr || payload.base64 
    };
  }

  if (tipo.includes('connection')) {
    const status = payload.connected === true || payload.status === 'connected' 
      ? 'conectado' 
      : 'desconectado';
    return { type: 'connection', instanceId, status };
  }

  if (tipo.includes('status') || tipo.includes('ack')) {
    return {
      type: 'message_update',
      instanceId,
      messageId: payload.messageId || payload.id || payload.ids?.[0],
      status: payload.status || payload.ack
    };
  }

  // Mensagem real
  const telefone = payload.phone || payload.from || payload.sender || '';
  const numeroLimpo = normalizarTelefone(telefone);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = payload.text?.message || payload.message || payload.body || '';

  // TODO: Ajustar extração de mídia conforme W-API
  if (payload.image || payload.imageMessage) {
    mediaType = 'image';
    mediaUrl = payload.image?.url || payload.imageMessage?.url || payload.mediaUrl;
    conteudo = conteudo || payload.image?.caption || '[Imagem]';
  } else if (payload.video || payload.videoMessage) {
    mediaType = 'video';
    mediaUrl = payload.video?.url || payload.videoMessage?.url || payload.mediaUrl;
    conteudo = conteudo || payload.video?.caption || '[Vídeo]';
  } else if (payload.audio || payload.audioMessage) {
    mediaType = 'audio';
    mediaUrl = payload.audio?.url || payload.audioMessage?.url || payload.mediaUrl;
    conteudo = '[Áudio]';
  } else if (payload.document || payload.documentMessage) {
    mediaType = 'document';
    mediaUrl = payload.document?.url || payload.documentMessage?.url || payload.mediaUrl;
    conteudo = conteudo || '[Documento]';
  } else if (payload.sticker || payload.stickerMessage) {
    mediaType = 'sticker';
    mediaUrl = payload.sticker?.url || payload.stickerMessage?.url;
    conteudo = '[Sticker]';
  } else if (payload.contact || payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (payload.location || payload.locationMessage) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  }

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId || payload.id || payload.key?.id,
    from: numeroLimpo,
    content: conteudo,
    mediaType,
    mediaUrl,
    mediaCaption: payload.image?.caption || payload.video?.caption || payload.caption,
    pushName: payload.pushName || payload.senderName || payload.contactName || payload.chatName,
    vcard: payload.contact || payload.contactMessage || payload.vcard,
    location: payload.location || payload.locationMessage,
    quotedMessage: payload.quotedMsg || payload.quotedMessage
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
    return Response.json({ 
      version: VERSION, 
      status: 'ok', 
      provider: 'w_api',
      build: BUILD_DATE 
    }, { headers: corsHeaders });
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

  console.log('[W-API WEBHOOK] 📥 Payload recebido:', JSON.stringify(payload, null, 2).substring(0, 500));

  // FILTRO ULTRA-RÁPIDO
  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    console.log('[W-API WEBHOOK] ⏭️ Ignorado:', motivoIgnorar);
    return Response.json({ success: true, ignored: true, reason: motivoIgnorar }, { headers: corsHeaders });
  }

  const dados = normalizarPayload(payload);
  if (dados.type === 'unknown') {
    return Response.json({ success: true, ignored: true, reason: dados.error }, { headers: corsHeaders });
  }

  if (dados.instanceId) {
    connectionManager.register(dados.instanceId, { provider: 'w_api' });
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
    console.error('[W-API WEBHOOK] ❌ ERRO:', error.message);
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
      { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {
    console.error('[W-API WEBHOOK] Erro QRCode:', e.message);
  }
  
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
  } catch (e) {
    console.error('[W-API WEBHOOK] Erro Connection:', e.message);
  }
  
  return Response.json({ success: true, processed: 'connection', status: dados.status, provider: 'w_api' }, { headers: corsHeaders });
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return Response.json({ success: true }, { headers: corsHeaders });
  
  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );
    if (mensagens.length > 0) {
      // TODO: Ajustar mapeamento de status conforme W-API
      const statusMap = { 
        'READ': 'lida', 
        'read': 'lida',
        'DELIVERED': 'entregue', 
        'delivered': 'entregue',
        'SENT': 'enviada',
        'sent': 'enviada',
        '3': 'lida',
        '2': 'entregue',
        '1': 'enviada'
      };
      const novoStatus = statusMap[dados.status] || statusMap[String(dados.status)];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
      }
    }
  } catch (e) {
    console.error('[W-API WEBHOOK] Erro MessageUpdate:', e.message);
  }
  
  return Response.json({ success: true, processed: 'status_update', provider: 'w_api' }, { headers: corsHeaders });
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

  // Buscar integração W-API
  let integracaoId = null;
  if (dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
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
      processed_by: VERSION,
      provider: 'w_api'
    }
  });

  // Audit log
  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId,
      integration_id: integracaoId,
      evento: 'ReceivedCallback-WAPI',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: true
    });
  } catch (e) {}

  const duracao = Date.now() - inicio;
  console.log('[W-API WEBHOOK] ✅ Msg:', mensagem.id, '| De:', dados.from, '| Int:', integracaoId, '| ' + duracao + 'ms');

  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    provider: 'w_api',
    version: VERSION
  }, { headers: corsHeaders });
}