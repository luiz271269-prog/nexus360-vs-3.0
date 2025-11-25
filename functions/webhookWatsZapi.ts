import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizarTelefone } from './lib/phoneUtils.js';
import { connectionManager } from './lib/connectionManager.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - VERSÃO UNIFICADA v7.0.0
// ============================================================================
// PRINCÍPIOS:
// 1. Filtrar CEDO - antes de qualquer operação de banco
// 2. Audit log APENAS para mensagens reais salvas com sucesso
// 3. Suporte completo a eventos (QR, conexão, status)
// 4. whatsapp_integration_id SEMPRE no metadata
// 5. Dados ricos: vcard, location, mídia
// ============================================================================

const VERSION = 'v7.0.0';
const BUILD_DATE = '2025-11-25';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================================
// FILTRO ULTRA-RÁPIDO - Retorna motivo se deve IGNORAR, null se processar
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type || payload.event || '').toLowerCase();

  // PERMITIR: QR Code e Connection (não ignorar)
  if (tipo.includes('qrcode') || tipo.includes('connection')) {
    return null;
  }

  // IGNORAR: Eventos de presença/digitação (alto volume, sem valor)
  const eventosLixo = ['presencechatcallback', 'presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => tipo.includes(e))) {
    return 'evento_sistema';
  }

  // PERMITIR: MessageStatusCallback (atualização de status - processar separado)
  if (tipo.includes('messagestatuscallback') || (payload.status && payload.ids && Array.isArray(payload.ids))) {
    return null; // Vai para handleMessageUpdate
  }

  // Para mensagens: filtros adicionais
  if (tipo === 'receivedcallback' || (payload.phone && payload.messageId)) {
    // IGNORAR: Grupos
    if (payload.isGroup === true) return 'grupo';
    
    // IGNORAR: Enviadas por mim
    if (payload.fromMe === true) return 'from_me';
    
    // IGNORAR: JIDs de sistema
    const tel = payload.phone || '';
    if (tel.includes('@lid') || tel.includes('@broadcast') || 
        tel.includes('@g.us') || tel.includes('status@')) {
      return 'jid_sistema';
    }
    
    // IGNORAR: Sem telefone
    if (!tel) return 'sem_telefone';
    
    return null; // Processar mensagem
  }

  // Outros eventos não reconhecidos
  return 'evento_desconhecido';
}

// ============================================================================
// NORMALIZAR PAYLOAD - Detecta tipo e extrai dados estruturados
// ============================================================================
function normalizarPayload(payload) {
  const tipo = String(payload.type || payload.event || '').toLowerCase();
  const instanceId = payload.instanceId || payload.instance || payload.instance_id || null;

  // 1. QR Code
  if (tipo.includes('qrcode')) {
    return {
      type: 'qrcode',
      instanceId,
      qrCodeUrl: payload.qrcode || payload.qr || null
    };
  }

  // 2. Connection Status
  if (tipo.includes('connection')) {
    return {
      type: 'connection',
      instanceId,
      status: payload.connected ? 'conectado' : 'desconectado'
    };
  }

  // 3. Message Status Update (READ, DELIVERED, SENT)
  if (tipo.includes('messagestatuscallback') || (payload.status && payload.ids && Array.isArray(payload.ids))) {
    return {
      type: 'message_update',
      instanceId,
      messageId: payload.ids?.[0] || null,
      status: payload.status,
      timestamp: payload.momment || Date.now()
    };
  }

  // 4. Mensagem Real (ReceivedCallback)
  const telefone = payload.phone || payload.telefone || '';
  const numeroLimpo = normalizarTelefone(telefone);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = payload.text?.message || payload.body || '';
  let vcard = null;
  let location = null;
  let mediaFileName = null;
  let mediaMimeType = null;

  // Detectar tipos de mídia
  if (payload.image) {
    mediaType = 'image';
    mediaUrl = payload.image.imageUrl || payload.image.url || payload.image.link;
    conteudo = conteudo || payload.image.caption || '[Imagem]';
    mediaMimeType = payload.image.mimetype;
  } else if (payload.video) {
    mediaType = 'video';
    mediaUrl = payload.video.videoUrl || payload.video.url || payload.video.link;
    conteudo = conteudo || payload.video.caption || '[Vídeo]';
    mediaMimeType = payload.video.mimetype;
  } else if (payload.audio) {
    mediaType = 'audio';
    mediaUrl = payload.audio.audioUrl || payload.audio.url || payload.audio.link;
    conteudo = '[Áudio]';
    mediaMimeType = payload.audio.mimetype;
  } else if (payload.document || payload.documentMessage) {
    mediaType = 'document';
    const doc = payload.document || payload.documentMessage;
    mediaUrl = doc.documentUrl || doc.url || doc.link;
    mediaFileName = doc.fileName || doc.title || 'Arquivo';
    conteudo = conteudo || `[Documento: ${mediaFileName}]`;
    mediaMimeType = doc.mimetype;
  } else if (payload.sticker) {
    mediaType = 'sticker';
    mediaUrl = payload.sticker.stickerUrl || payload.sticker.url;
    conteudo = '[Sticker]';
  } else if (payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    vcard = payload.contactMessage || payload.vcard;
    const nome = vcard.displayName || vcard.name || 'Sem nome';
    conteudo = `📇 Contato: ${nome}`;
  } else if (payload.location || payload.locationMessage) {
    mediaType = 'location';
    location = payload.location || payload.locationMessage;
    const nome = location.name || 'Localização';
    conteudo = `📍 ${nome}`;
  } else if (payload.buttonsResponseMessage) {
    conteudo = payload.buttonsResponseMessage.message || payload.buttonsResponseMessage.selectedButtonId || conteudo;
  }

  // Mensagem vazia sem mídia = ignorar
  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId || null,
    from: numeroLimpo,
    content: conteudo,
    mediaType,
    mediaUrl,
    mediaCaption: payload.image?.caption || payload.video?.caption || null,
    mediaFileName,
    mediaMimeType,
    timestamp: payload.momment || payload.timestamp || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    vcard,
    location,
    quotedMessage: payload.quotedMsg || payload.quotedMessage || null
  };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  const inicio = Date.now();

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health check com métricas
  if (req.method === 'GET') {
    return Response.json({
      version: VERSION,
      build_date: BUILD_DATE,
      status: 'operational',
      connection_manager: connectionManager.getMetrics(),
      timestamp: new Date().toISOString()
    }, { headers: corsHeaders });
  }

  // Inicializar SDK
  let base44;
  try {
    base44 = createClientFromRequest(req.clone());
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error', version: VERSION }, { status: 500, headers: corsHeaders });
  }

  // Parsear JSON
  let payload;
  try {
    const body = await req.text();
    if (!body) return Response.json({ success: true, ignored: true, reason: 'empty', version: VERSION }, { headers: corsHeaders });
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido', version: VERSION }, { status: 200, headers: corsHeaders });
  }

  // ========== FILTRO RÁPIDO ==========
  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    return Response.json({ success: true, ignored: true, reason: motivoIgnorar, version: VERSION }, { headers: corsHeaders });
  }

  // ========== NORMALIZAR PAYLOAD ==========
  const dados = normalizarPayload(payload);
  
  if (dados.type === 'unknown') {
    return Response.json({ success: true, ignored: true, reason: dados.error || 'unknown', version: VERSION }, { headers: corsHeaders });
  }

  // Registrar conexão ativa
  if (dados.instanceId) {
    connectionManager.register(dados.instanceId, {
      provider: 'z_api',
      phone: payload.phone || payload.telefone
    });
  }

  // ========== ROTEAMENTO POR TIPO ==========
  try {
    switch (dados.type) {
      case 'qrcode':
        return await handleQRCode(dados, base44);
      
      case 'connection':
        return await handleConnection(dados, base44);
      
      case 'message_update':
        return await handleMessageUpdate(dados, base44);
      
      case 'message':
        return await handleMessage(dados, payload, base44, inicio);
      
      default:
        return Response.json({ success: true, ignored: true, reason: 'tipo_desconhecido', version: VERSION }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error('[' + VERSION + '] ERRO:', error.message);
    return Response.json({ success: false, error: error.message, version: VERSION }, { status: 500, headers: corsHeaders });
  }
});

// ============================================================================
// HANDLERS ESPECIALIZADOS
// ============================================================================

async function handleQRCode(dados, base44) {
  if (!dados.instanceId) {
    return Response.json({ success: true, ignored: true, reason: 'qr_sem_instance', version: VERSION }, { headers: corsHeaders });
  }

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
  } catch (e) {
    console.warn('[' + VERSION + '] Erro ao atualizar QR:', e.message);
  }

  return Response.json({ success: true, processed: 'qrcode', version: VERSION }, { headers: corsHeaders });
}

async function handleConnection(dados, base44) {
  if (!dados.instanceId) {
    return Response.json({ success: true, ignored: true, reason: 'conn_sem_instance', version: VERSION }, { headers: corsHeaders });
  }

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
  } catch (e) {
    console.warn('[' + VERSION + '] Erro ao atualizar conexão:', e.message);
  }

  return Response.json({ success: true, processed: 'connection', status: dados.status, version: VERSION }, { headers: corsHeaders });
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) {
    return Response.json({ success: true, ignored: true, reason: 'update_sem_msgid', version: VERSION }, { headers: corsHeaders });
  }

  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );

    if (mensagens.length > 0) {
      const statusMap = {
        'READ': 'lida',
        'READ_BY_ME': 'lida',
        'DELIVERED': 'entregue',
        'SENT': 'enviada'
      };
      
      const novoStatus = statusMap[dados.status];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
      }
    }
  } catch (e) {
    // Silencioso - atualização de status não é crítica
  }

  return Response.json({ success: true, processed: 'message_update', version: VERSION }, { headers: corsHeaders });
}

async function handleMessage(dados, payloadBruto, base44, inicio) {
  // ========== VERIFICAR DUPLICATA ==========
  if (dados.messageId) {
    try {
      const duplicatas = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId }, '-created_date', 1
      );
      if (duplicatas.length > 0) {
        return Response.json({ success: true, ignored: true, reason: 'duplicata', version: VERSION }, { headers: corsHeaders });
      }
    } catch (e) { /* continuar */ }
  }

  console.log('[' + VERSION + '] Msg:', dados.from, '| Mídia:', dados.mediaType, '| Instance:', dados.instanceId);

  // ========== BUSCAR INTEGRAÇÃO ==========
  let integracaoId = null;
  if (dados.instanceId) {
    try {
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId }, '-created_date', 1
      );
      if (integracoes.length > 0) {
        integracaoId = integracoes[0].id;
      }
    } catch (e) { /* continuar */ }
  }

  // ========== BUSCAR/CRIAR CONTATO ==========
  let contato;
  const contatos = await base44.asServiceRole.entities.Contact.filter(
    { telefone: dados.from }, '-created_date', 1
  );

  if (contatos.length > 0) {
    contato = contatos[0];
    const atualizacao = { ultima_interacao: new Date().toISOString() };
    
    // Atualizar nome se genérico
    const nomeAtual = contato.nome?.trim() || '';
    const nomeGenerico = !nomeAtual || nomeAtual === dados.from || /^[\+\d\s\-\(\)]+$/.test(nomeAtual);
    if (dados.pushName && nomeGenerico) {
      atualizacao.nome = dados.pushName;
    }
    
    await base44.asServiceRole.entities.Contact.update(contato.id, atualizacao);
  } else {
    contato = await base44.asServiceRole.entities.Contact.create({
      nome: dados.pushName || dados.from,
      telefone: dados.from,
      tipo_contato: 'lead',
      whatsapp_status: 'verificado',
      ultima_interacao: new Date().toISOString()
    });
  }

  // ========== BUSCAR/CRIAR THREAD ==========
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

  // ========== SALVAR MENSAGEM ==========
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
      timestamp: dados.timestamp,
      is_from_me: dados.isFromMe,
      vcard: dados.vcard,
      location: dados.location,
      quoted_message: dados.quotedMessage,
      media_file_name: dados.mediaFileName,
      mime_type: dados.mediaMimeType,
      processed_by: VERSION
    }
  });

  // ========== AUDIT LOG (apenas sucesso) ==========
  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: true
    });
  } catch (e) { /* não falhar por audit */ }

  const duracao = Date.now() - inicio;
  console.log('[' + VERSION + '] ✅ ' + duracao + 'ms | Msg:', mensagem.id, '| Int:', integracaoId);

  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    version: VERSION
  }, { headers: corsHeaders });
}