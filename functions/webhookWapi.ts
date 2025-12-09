import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v1.4.0 CORRIGIDO
// ============================================================================
// CORREÇÕES:
// 1. Extração de mediaUrl CORRIGIDA - buscar em múltiplos campos
// 2. Normalização de telefone SEM + para consistência
// 3. Logs detalhados para debug de mídia
// 4. Suporte para evento webhookConectado
// 5. Detecção de saudação robusta (normalização NFD) - v1.4.0
// 6. Logs aprimorados para debug do pré-atendimento
// ============================================================================

const VERSION = 'v1.4.0-wapi';
const BUILD_DATE = '2025-12-09';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// NORMALIZAÇÃO DE TELEFONE - VERSÃO UNIFICADA (SEM + para consistência)
// ============================================================================
function normalizarTelefoneUnificado(telefone) {
  if (!telefone) return null;
  
  let numeroLimpo = String(telefone).split('@')[0];
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  
  if (!apenasNumeros) return null;
  if (apenasNumeros.length < 10) return null;
  
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  return apenasNumeros;
}

// ============================================================================
// FILTRO ULTRA-RAPIDO
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const evento = String(payload.event || '').toLowerCase();
  const senderId = payload.sender?.id || payload.chat?.id || '';
  const phone = senderId.replace(/@.*$/, '').toLowerCase();

  if (phone.includes('status') || senderId.includes('@broadcast') || senderId.includes('@g.us')) {
    return 'jid_sistema_ou_grupo';
  }

  // ✅ RECONHECER webhookConectado, qrcode e connection
  if (evento.includes('qrcode') || evento.includes('connection') || evento.includes('webhookconectado')) {
    return null;
  }

  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => evento.includes(e))) {
    return 'evento_sistema';
  }

  if (evento === 'webhookreceived' || payload.msgContent) {
    if (payload.isGroup === true) return 'grupo';
    if (payload.fromMe === true) return 'from_me';
    if (!senderId) return 'sem_telefone';
    return null;
  }

  if (evento === 'webhookdelivery' || evento.includes('delivery')) {
    return null;
  }

  return 'evento_desconhecido';
}

// ============================================================================
// EXTRAIR URL DE MÍDIA - FUNÇÃO DEDICADA (W-API)
// W-API aninha mídias em msgContent.*Message (diferente da Z-API)
// ============================================================================
function extrairMediaUrl(payload, msgContent, tipoMidia) {
  // Campos do payload raiz (W-API às vezes coloca aqui)
  const camposRaiz = [
    payload.mediaUrl,
    payload.media?.url,
    payload.downloadUrl,
    payload.fileUrl,
    payload.url,
    payload.media?.downloadUrl,
    payload.urlMedia
  ];
  
  // ✅ Campos específicos por tipo de mídia no msgContent (estrutura aninhada W-API)
  const camposMsgContent = {
    image: [
      msgContent?.imageMessage?.url,
      msgContent?.imageMessage?.directPath,
      msgContent?.imageMessage?.mediaUrl,
      msgContent?.imageMessage?.image?.url,  // Estrutura alternativa
      msgContent?.imageMessage?.downloadUrl,
      msgContent?.imageMessage?.thumbnail
    ],
    video: [
      msgContent?.videoMessage?.url,
      msgContent?.videoMessage?.directPath,
      msgContent?.videoMessage?.mediaUrl,
      msgContent?.videoMessage?.video?.url
    ],
    audio: [
      msgContent?.audioMessage?.url,
      msgContent?.audioMessage?.directPath,
      msgContent?.audioMessage?.mediaUrl,
      msgContent?.audioMessage?.audio?.url
    ],
    document: [
      msgContent?.documentMessage?.url,
      msgContent?.documentMessage?.directPath,
      msgContent?.documentMessage?.mediaUrl,
      msgContent?.documentMessage?.document?.url
    ],
    sticker: [
      msgContent?.stickerMessage?.url,
      msgContent?.stickerMessage?.directPath
    ]
  };
  
  // Buscar primeiro nos campos do tipo específico
  const camposDoTipo = camposMsgContent[tipoMidia] || [];
  for (const campo of camposDoTipo) {
    if (campo && typeof campo === 'string' && campo.startsWith('http')) {
      console.log(`[W-API WEBHOOK] 📎 URL encontrada em msgContent.${tipoMidia}Message:`, campo.substring(0, 80));
      return campo;
    }
  }
  
  // Buscar nos campos raiz
  for (const campo of camposRaiz) {
    if (campo && typeof campo === 'string' && campo.startsWith('http')) {
      console.log('[W-API WEBHOOK] 📎 URL encontrada no payload raiz:', campo.substring(0, 80));
      return campo;
    }
  }
  
  console.log('[W-API WEBHOOK] ⚠️ Nenhuma URL de mídia encontrada para tipo:', tipoMidia);
  return null;
}

// ============================================================================
// EXTRAIR METADADOS DE MÍDIA - W-API
// ============================================================================
function extrairMetadadosMidia(msgContent, tipoMidia) {
  const tipoMap = {
    image: 'imageMessage',
    video: 'videoMessage',
    audio: 'audioMessage',
    document: 'documentMessage',
    sticker: 'stickerMessage'
  };
  
  const msgKey = tipoMap[tipoMidia];
  const mediaMsg = msgContent?.[msgKey] || {};
  
  return {
    caption: mediaMsg.caption || null,
    fileName: mediaMsg.fileName || mediaMsg.title || null,
    mimetype: mediaMsg.mimetype || null,
    fileSize: mediaMsg.fileLength || mediaMsg.size || null,
    isPTT: mediaMsg.ptt === true // Push to Talk (áudio de voz)
  };
}

// ============================================================================
// NORMALIZAR PAYLOAD - CORRIGIDO
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

  // Conexão (incluindo webhookConectado)
  if (evento.includes('connection') || evento.includes('webhookconectado')) {
    const status = payload.connected === true ? 'conectado' : 'desconectado';
    return { type: 'connection', instanceId, status };
  }

  // Status de entrega
  if (evento === 'webhookdelivery' || evento.includes('delivery')) {
    return {
      type: 'message_update',
      instanceId,
      messageId: payload.messageId || payload.key?.id,
      status: payload.status || payload.ack
    };
  }

  // Mensagem recebida
  const senderId = payload.sender?.id || payload.chat?.id || '';
  const numeroLimpo = normalizarTelefoneUnificado(senderId);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  const msgContent = payload.msgContent || {};
  
  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = '';

  // ✅ Detectar tipo e extrair URL + metadados (W-API estrutura aninhada)
  let mediaMetadata = {};
  
  if (msgContent.imageMessage) {
    mediaType = 'image';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'image');
    conteudo = mediaMetadata.caption || '[Imagem]';
    
    const mediaKey = msgContent.imageMessage?.mediaKey;
    const directPath = msgContent.imageMessage?.directPath;
    
    console.log('[W-API WEBHOOK] 🖼️ Imagem detectada | mediaKey:', mediaKey ? 'SIM' : 'NÃO', '| directPath:', directPath ? 'SIM' : 'NÃO');
    
    mediaUrl = extrairMediaUrl(payload, msgContent, 'image');
    if (!mediaUrl && mediaKey && directPath) {
      // Armazenar ESTRUTURA COMPLETA para descriptografia (não apenas mediaKey/directPath)
      mediaMetadata.messageStruct = msgContent.imageMessage;
      mediaMetadata.requiresDownload = true;
      console.log('[W-API WEBHOOK] 📦 Mídia requer download via API');
    }
    
  } else if (msgContent.videoMessage) {
    mediaType = 'video';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'video');
    conteudo = mediaMetadata.caption || '[Vídeo]';
    
    const mediaKey = msgContent.videoMessage?.mediaKey;
    const directPath = msgContent.videoMessage?.directPath;
    
    console.log('[W-API WEBHOOK] 🎬 Vídeo detectado | mediaKey:', mediaKey ? 'SIM' : 'NÃO', '| directPath:', directPath ? 'SIM' : 'NÃO');
    
    mediaUrl = extrairMediaUrl(payload, msgContent, 'video');
    if (!mediaUrl && mediaKey && directPath) {
      mediaMetadata.mediaKey = mediaKey;
      mediaMetadata.directPath = directPath;
      mediaMetadata.requiresDownload = true;
      console.log('[W-API WEBHOOK] 📦 Mídia requer download via API');
    }
    
  } else if (msgContent.audioMessage) {
    mediaType = 'audio';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'audio');
    conteudo = mediaMetadata.isPTT ? '[Áudio de voz]' : '[Áudio]';
    
    const mediaKey = msgContent.audioMessage?.mediaKey;
    const directPath = msgContent.audioMessage?.directPath;
    
    console.log('[W-API WEBHOOK] 🎵 Áudio detectado (PTT:', mediaMetadata.isPTT, ') | mediaKey:', mediaKey ? 'SIM' : 'NÃO', '| directPath:', directPath ? 'SIM' : 'NÃO');
    
    mediaUrl = extrairMediaUrl(payload, msgContent, 'audio');
    if (!mediaUrl && mediaKey && directPath) {
      mediaMetadata.mediaKey = mediaKey;
      mediaMetadata.directPath = directPath;
      mediaMetadata.requiresDownload = true;
    }
    
  } else if (msgContent.documentMessage) {
    mediaType = 'document';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'document');
    conteudo = mediaMetadata.fileName ? `[Documento: ${mediaMetadata.fileName}]` : '[Documento]';
    
    const mediaKey = msgContent.documentMessage?.mediaKey;
    const directPath = msgContent.documentMessage?.directPath;
    
    console.log('[W-API WEBHOOK] 📄 Documento detectado | Arquivo:', mediaMetadata.fileName || 'N/A', '| mediaKey:', mediaKey ? 'SIM' : 'NÃO');
    
    mediaUrl = extrairMediaUrl(payload, msgContent, 'document');
    if (!mediaUrl && mediaKey && directPath) {
      mediaMetadata.mediaKey = mediaKey;
      mediaMetadata.directPath = directPath;
      mediaMetadata.requiresDownload = true;
    }
    
  } else if (msgContent.stickerMessage) {
    mediaType = 'sticker';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'sticker');
    mediaMetadata = extrairMetadadosMidia(msgContent, 'sticker');
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

  // ✅ FALLBACK: Tentar extrair de outros campos (W-API pode usar estruturas diferentes)
  if (!conteudo && mediaType === 'none') {
    conteudo = payload.body || payload.text || payload.message?.text || payload.content || '';
    if (conteudo) {
      console.log('[W-API WEBHOOK] 📝 Conteúdo extraído de campo alternativo:', conteudo);
    }
  }

  if (!conteudo && mediaType === 'none') {
    console.log('[W-API WEBHOOK] ⚠️ Mensagem vazia - payload.body:', payload.body, '| payload.text:', payload.text);
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  // Log final de mídia
  if (mediaType !== 'none') {
    console.log('[W-API WEBHOOK] 📊 Resultado extração:', {
      tipo: mediaType,
      temUrl: !!mediaUrl,
      urlPreview: mediaUrl?.substring(0, 60) || 'NENHUMA'
    });
  }

  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId || payload.key?.id,
    from: numeroLimpo,
    content: conteudo,
    mediaType,
    mediaUrl,
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
    return Response.json({ success: false, error: 'JSON invalido' }, { status: 200, headers: corsHeaders });
  }

  // Log detalhado para debug
  console.log('[W-API WEBHOOK] ========== PAYLOAD RECEBIDO ==========');
  console.log('[W-API WEBHOOK] Evento:', payload.event);
  console.log('[W-API WEBHOOK] InstanceId:', payload.instanceId);
  console.log('[W-API WEBHOOK] Sender:', payload.sender?.id);
  console.log('[W-API WEBHOOK] body:', payload.body || 'N/A');
  console.log('[W-API WEBHOOK] text:', payload.text || 'N/A');
  console.log('[W-API WEBHOOK] mediaUrl (raiz):', payload.mediaUrl || 'N/A');
  console.log('[W-API WEBHOOK] downloadUrl:', payload.downloadUrl || 'N/A');
  console.log('[W-API WEBHOOK] fileUrl:', payload.fileUrl || 'N/A');
  console.log('[W-API WEBHOOK] url:', payload.url || 'N/A');
  if (payload.msgContent) {
    console.log('[W-API WEBHOOK] msgContent keys:', Object.keys(payload.msgContent).join(', '));
    if (payload.msgContent.conversation) {
      console.log('[W-API WEBHOOK] msgContent.conversation:', payload.msgContent.conversation);
    }
  }
  console.log('[W-API WEBHOOK] ===========================================');

  // FILTRO
  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    console.log('[W-API WEBHOOK] ❌ IGNORADO:', motivoIgnorar);
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
  console.log('[W-API WEBHOOK] 🔌 Evento de conexão | Instance:', dados.instanceId, '| Status:', dados.status);
  
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
      console.log('[W-API WEBHOOK] ✅ Status atualizado:', integracoes[0].nome_instancia, '->', dados.status);
    } else {
      console.log('[W-API WEBHOOK] ⚠️ Nenhuma integração encontrada para instance:', dados.instanceId);
    }
  } catch (e) {
    console.error('[W-API WEBHOOK] ❌ Erro ao atualizar status:', e.message);
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

async function handleMessage(dados, payloadBruto, base44, req) {
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

  // Buscar integracao W-API
  let integracaoId = null;
  if (dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
      );
      if (int.length > 0) integracaoId = int[0].id;
    } catch (e) {}
  }

  // Extrair foto de perfil
  const profilePicUrl = payloadBruto.sender?.profilePicture
    || payloadBruto.sender?.profilePicThumbObj?.eurl 
    || payloadBruto.sender?.imgUrl
    || null;

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
      provider: 'w_api',
      messageStruct: dados.messageStruct,
      requiresDownload: dados.requiresDownload
    }
  });

  // ============================================================================
  // ✅ PRÉ-ATENDIMENTO AUTOMÁTICO - VERSÃO CORRIGIDA v1.4.0
  // ============================================================================
  // ⚠️ NÃO PROCESSAR SE FOR MÍDIA (áudio, imagem, vídeo, documento)
  // ============================================================================
  
  const isMidia = dados.mediaType && dados.mediaType !== 'none' && 
                  ['image', 'video', 'audio', 'document', 'sticker'].includes(dados.mediaType);
  
  if (isMidia) {
    console.log('[W-API WEBHOOK] 📎 Mensagem de mídia - NÃO ativar pré-atendimento | Tipo:', dados.mediaType);
  } else {
    // Processar pré-atendimento para mensagens de TEXTO
    const SAUDACOES = [
      'oi', 'ola', 'oie', 'oii', 'oiii',
      'bom dia', 'boa tarde', 'boa noite',
      'bomdia', 'boatarde', 'boanoite',
      'hey', 'hello', 'hi',
      'e ai', 'eai', 'eae',
      'tudo bem', 'tudo bom', 'como vai',
      'opa', 'fala', 'salve'
    ];
    
    // Normalizar mensagem (remover acentos e pontuação)
    const mensagemNorm = (dados.content || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    
    const isSaudacao = SAUDACOES.some(s => 
      mensagemNorm === s || 
      mensagemNorm.startsWith(s + ' ') || 
      mensagemNorm.startsWith(s + ',') || 
      mensagemNorm.startsWith(s + '!')
    );
    
    console.log('[W-API WEBHOOK] 🔍 Msg recebida:', dados.content, '| Normalizada:', mensagemNorm, '| É saudação?', isSaudacao);
    
    // Buscar execuções ativas
    let execucoesAtivas = [];
    try {
      execucoesAtivas = await base44.asServiceRole.entities.FlowExecution.filter({
        thread_id: thread.id,
        status: 'ativo'
      }, '-created_date', 1);
    } catch (e) {
      console.log('[W-API WEBHOOK] ⚠️ Erro ao buscar execuções ativas:', e?.message);
    }

    // Verificar estado da thread
    const threadAtualizada = await base44.asServiceRole.entities.MessageThread.get(thread.id);
    const preAtendimentoAtivo = threadAtualizada.pre_atendimento_ativo === true;
    const estadoPreAtend = threadAtualizada.pre_atendimento_state || 'INIT';
    
    console.log('[W-API WEBHOOK] 📊 Thread State:', {
      pre_atendimento_ativo: preAtendimentoAtivo,
      estado: estadoPreAtend,
      execucoes_ativas: execucoesAtivas.length
    });
    
    // Resetar se thread marcada como ativa mas sem execuções
    if (preAtendimentoAtivo && execucoesAtivas.length === 0) {
      console.log('[W-API WEBHOOK] ⚠️ Thread com PA ativo mas sem execuções - RESETANDO');
      try {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_ativo: false,
          pre_atendimento_state: 'INIT'
        });
      } catch (e) {
        console.error('[W-API WEBHOOK] ❌ Erro ao resetar:', e?.message);
      }
    }
    
    // DECISÃO: Processar resposta OU iniciar novo
    if (preAtendimentoAtivo && execucoesAtivas.length > 0) {
      // PA em andamento - processar resposta
      console.log('[W-API WEBHOOK] 🔄 PA ativo | Processando resposta | Estado:', estadoPreAtend);
      try {
        await base44.functions.invoke('executarPreAtendimento', {
          action: 'processar_resposta',
          thread_id: thread.id,
          contact_id: contato.id,
          integration_id: integracaoId,
          resposta_usuario: dados.content
        });
      } catch (e) {
        console.error('[W-API WEBHOOK] ❌ Erro ao processar resposta PA:', e?.message);
      }
    } else if (isSaudacao) {
      // Saudação detectada - INICIAR PA
      console.log('[W-API WEBHOOK] 🚀 SAUDAÇÃO DETECTADA! Iniciando PA | Msg:', mensagemNorm);
      try {
        const resultPA = await base44.functions.invoke('executarPreAtendimento', {
          action: 'iniciar',
          thread_id: thread.id,
          contact_id: contato.id,
          integration_id: integracaoId
        });
        console.log('[W-API WEBHOOK] ✅ PA iniciado | Resultado:', resultPA?.data || 'ok');
      } catch (e) {
        console.error('[W-API WEBHOOK] ❌ ERRO ao iniciar PA:', e?.message, '| Stack:', e?.stack);
      }
    } else {
      console.log('[W-API WEBHOOK] ℹ️ Não é saudação, PA não ativado | Msg:', mensagemNorm.substring(0, 40));
    }
  }

  const duracao = Date.now() - inicio;
  console.log('[W-API WEBHOOK] ✅ Msg:', mensagem.id, '| Tipo:', dados.mediaType, '| URL:', dados.mediaUrl ? 'SIM' : 'NÃO', '| ' + duracao + 'ms');

  // ✅ DOWNLOAD E PERSISTÊNCIA - ARQUITETURA ASYNC (ESTUDO TÉCNICO)
  // Passo 5: Baixar mídia descriptografada via API W-API
  // Passo 6-8: Persistir no Storage Base44
  if (dados.mediaType && dados.mediaType !== 'none' && dados.messageStruct && integracaoId) {
    console.log('[W-API WEBHOOK] 🚀 Iniciando processo de download assíncrono...');
    
    // ⚠️ PROCESSO ASSÍNCRONO - NÃO BLOQUEAR WEBHOOK
    base44.functions.invoke('persistirMidiaWapi', {
      message_id: mensagem.id,
      media_type: dados.mediaType,
      integration_id: integracaoId,
      message_struct: dados.messageStruct, // Estrutura completa para W-API
      filename: dados.fileName,
      mimetype: dados.mimetype
    }).then(result => {
      if (result?.data?.success) {
        console.log('[W-API WEBHOOK] ✅ Mídia persistida (async):', result.data.permanent_url?.substring(0, 60));
      } else {
        console.error('[W-API WEBHOOK] ❌ Persistência falhou:', result?.data?.error);
      }
    }).catch(err => {
      console.error('[W-API WEBHOOK] ❌ Erro na persistência assíncrona:', err.message);
    });
    
    console.log('[W-API WEBHOOK] ⏩ Webhook retornando (persistência em background)');
  }

  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    provider: 'w_api',
    version: VERSION,
    pre_atendimento_triggered: isSaudacao && execucoesAtivas.length === 0
  }, { headers: corsHeaders });
}