import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v1.0.1 (Paralelo ao Z-API)
// ============================================================================
// Baseado na documentação oficial W-API:
// - Evento de mensagem: webhookReceived
// - Evento de status: webhookDelivery  
// - Estrutura: { event, sender: { id }, chat: { id }, msgContent: { ... }, instanceId }
// ============================================================================

const VERSION = 'v1.0.1-wapi';
const BUILD_DATE = '2025-01-27';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Normalizar telefone (remover @s.whatsapp.net e caracteres especiais)
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  // Remove @s.whatsapp.net, @c.us, etc
  let limpo = telefone.replace(/@.*$/, '');
  // Remove caracteres não numéricos
  limpo = limpo.replace(/\D/g, '');
  // Validar tamanho mínimo
  if (limpo.length < 10) return null;
  return limpo;
}

// ============================================================================
// FILTRO ULTRA-RÁPIDO - Retorna motivo se IGNORAR, null se processar
// Baseado nos eventos da W-API
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const evento = String(payload.event || '').toLowerCase();
  
  // Extrair telefone do sender ou chat (formato W-API)
  const senderId = payload.sender?.id || payload.chat?.id || '';
  const phone = senderId.replace(/@.*$/, '').toLowerCase();

  // IGNORAR: status@broadcast e JIDs de sistema/grupos
  if (phone.includes('status') || senderId.includes('@broadcast') || 
      senderId.includes('@g.us') || senderId.includes('@lid')) {
    return 'jid_sistema_ou_grupo';
  }

  // PERMITIR: QR Code e Connection
  if (evento.includes('qrcode') || evento.includes('connection')) {
    return null;
  }

  // IGNORAR: Eventos de presença/digitação
  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => evento.includes(e))) {
    return 'evento_sistema';
  }

  // PERMITIR: webhookReceived (mensagem recebida)
  if (evento === 'webhookreceived' || payload.msgContent) {
    // Ignorar mensagens de grupo
    if (payload.isGroup === true) return 'grupo';
    // Ignorar mensagens enviadas por mim
    if (payload.fromMe === true) return 'from_me';
    // Validar se tem telefone
    if (!senderId) return 'sem_telefone';
    return null;
  }

  // PERMITIR: webhookDelivery (status de entrega)
  if (evento === 'webhookdelivery' || evento.includes('delivery')) {
    return null;
  }

  return 'evento_desconhecido';
}

// ============================================================================
// NORMALIZAR PAYLOAD - Baseado no formato W-API
// Estrutura: { event, sender: { id }, chat: { id }, msgContent: { ... }, instanceId }
// ============================================================================
function normalizarPayload(payload) {
  const evento = String(payload.event || '').toLowerCase();
  const instanceId = payload.instanceId || null;

  // QR Code
  if (evento.includes('qrcode') || payload.qrcode) {
    return { 
      type: 'qrcode', 
      instanceId, 
      qrCodeUrl: payload.qrcode || payload.qr || payload.base64 
    };
  }

  // Conexão
  if (evento.includes('connection')) {
    const status = payload.connected === true ? 'conectado' : 'desconectado';
    return { type: 'connection', instanceId, status };
  }

  // Status de entrega (webhookDelivery)
  if (evento === 'webhookdelivery' || evento.includes('delivery')) {
    return {
      type: 'message_update',
      instanceId,
      messageId: payload.messageId || payload.key?.id,
      status: payload.status || payload.ack
    };
  }

  // Mensagem recebida (webhookReceived)
  // Extrair telefone do sender.id (formato: 5511999999999@s.whatsapp.net)
  const senderId = payload.sender?.id || payload.chat?.id || '';
  const numeroLimpo = normalizarTelefone(senderId);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = '';
  
  // Extrair conteúdo do msgContent (estrutura aninhada da W-API)
  const msgContent = payload.msgContent || {};
  
  if (msgContent.extendedTextMessage) {
    conteudo = msgContent.extendedTextMessage.text || '';
  } else if (msgContent.conversation) {
    conteudo = msgContent.conversation;
  } else if (msgContent.imageMessage) {
    mediaType = 'image';
    mediaUrl = msgContent.imageMessage.url;
    conteudo = msgContent.imageMessage.caption || '[Imagem]';
  } else if (msgContent.videoMessage) {
    mediaType = 'video';
    mediaUrl = msgContent.videoMessage.url;
    conteudo = msgContent.videoMessage.caption || '[Vídeo]';
  } else if (msgContent.audioMessage) {
    mediaType = 'audio';
    mediaUrl = msgContent.audioMessage.url;
    conteudo = '[Áudio]';
  } else if (msgContent.documentMessage) {
    mediaType = 'document';
    mediaUrl = msgContent.documentMessage.url;
    conteudo = msgContent.documentMessage.fileName || '[Documento]';
  } else if (msgContent.stickerMessage) {
    mediaType = 'sticker';
    mediaUrl = msgContent.stickerMessage.url;
    conteudo = '[Sticker]';
  } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (msgContent.locationMessage) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  }

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
    mediaCaption: msgContent.imageMessage?.caption || msgContent.videoMessage?.caption,
    pushName: payload.pushName || payload.senderName || payload.sender?.pushName,
    vcard: msgContent.contactMessage || msgContent.contactsArrayMessage,
    location: msgContent.locationMessage,
    quotedMessage: payload.quotedMsg || msgContent.extendedTextMessage?.contextInfo?.quotedMessage
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