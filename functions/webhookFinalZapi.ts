import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// FUNÇÕES UTILITÁRIAS INLINE (evitar imports externos)
// ============================================================================

function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let numeroLimpo = String(telefone).split('@')[0];
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  
  // Adicionar código do país se não tiver
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  // Normalizar celulares brasileiros: adicionar 9 se faltar
  // Formato esperado: 55 + DDD(2) + 9 + número(8) = 13 dígitos
  // Se veio 55 + DDD(2) + número(8) = 12 dígitos, adiciona o 9
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const ddd = apenasNumeros.substring(2, 4);
    const numero = apenasNumeros.substring(4);
    // Celulares começam com 9, 8, 7, 6 (após o 9 adicional)
    // Se não começa com 9, adicionar
    if (!numero.startsWith('9')) {
      apenasNumeros = '55' + ddd + '9' + numero;
    }
  }
  
  return '+' + apenasNumeros;
}

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v9.1.0 FINAL
// ============================================================================
const VERSION = 'v9.1.0-FINAL';
const BUILD_DATE = '2025-11-25';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonOk(body, init = {}) {
  return Response.json(body, { status: 200, headers: corsHeaders, ...init });
}
function jsonBadRequest(body) {
  return Response.json(body, { status: 400, headers: corsHeaders });
}
function jsonServerError(body) {
  return Response.json(body, { status: 500, headers: corsHeaders });
}

// --------------------------------------------------------------------------------------
// FILTRO ULTRA-RÁPIDO - Retorna motivo se IGNORAR, null se processar
// --------------------------------------------------------------------------------------
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type ?? payload.event ?? '').toLowerCase();
  const phone = String(payload.phone ?? payload.from ?? '').toLowerCase();
  const isGroup = payload.isGroup === true || String(payload.chatId ?? '').includes('@g.us');

  // IGNORAR IMEDIATAMENTE: status@broadcast e JIDs de sistema
  if (
    phone.includes('status@') ||
    phone.includes('@broadcast') ||
    phone.includes('@lid') ||
    phone.includes('@g.us') ||
    isGroup
  ) {
    return 'jid_sistema';
  }

  // PERMITIR: QR Code e Connection
  if (tipo.includes('qrcode') || tipo.includes('connection')) {
    return null;
  }

  // IGNORAR: Eventos de presença/digitação/chamada (alto volume)
  // MAS APENAS SE NÃO TIVER messageId (mensagem real)
  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  const temMessageId = payload.messageId || payload.id;
  if (!temMessageId && eventosLixo.some((e) => tipo.includes(e))) {
    return 'evento_sistema';
  }

  // MessageStatusCallback - ignorar se for de status@broadcast
  if (tipo.includes('messagestatuscallback') || tipo.includes('message-status')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) {
      return 'status_broadcast';
    }
    return null; // Processar atualizações de status válidas
  }

  // Para mensagens recebidas - verificar messageId E phone (mensagem real)
  const hasMsgId = payload.messageId || payload.id;
  const hasPhone = payload.phone || payload.from;
  const hasContent = payload.text || payload.body || payload.message || payload.image || payload.video || payload.audio || payload.document;

  // Se tem messageId + phone + conteúdo = é mensagem real
  if (hasMsgId && hasPhone && (hasContent || payload.momment)) {
    if (payload.fromMe === true) return 'from_me';
    return null; // PROCESSAR!
  }

  // ReceivedCallback explícito
  if (tipo.includes('receivedcallback')) {
    if (payload.fromMe === true) return 'from_me';
    if (!payload.phone && !payload.from) return 'sem_telefone';
    return null;
  }

  return 'evento_desconhecido';
}

// --------------------------------------------------------------------------------------
// NORMALIZAR PAYLOAD
// --------------------------------------------------------------------------------------
function coerceString(v, def = null) {
  if (v == null) return def;
  try {
    const s = String(v);
    return s.length ? s : def;
  } catch {
    return def;
  }
}

function normalizarPayload(payload) {
  const tipoRaw = coerceString(payload.type ?? payload.event, '').toLowerCase();
  const instanceId =
    payload.instanceId ??
    payload.instance ??
    payload.instance_id ??
    payload.instance_id_provider ??
    null;

  // QR Code
  if (tipoRaw.includes('qrcode') || payload.qrcode || payload.qr) {
    return {
      type: 'qrcode',
      instanceId,
      qrCodeUrl: payload.qrcode ?? payload.qr ?? payload.qrCodeUrl ?? null,
    };
  }

  // Connection
  if (tipoRaw.includes('connection') || typeof payload.connected === 'boolean') {
    return {
      type: 'connection',
      instanceId,
      status: payload.connected ? 'conectado' : 'desconectado',
    };
  }

  // ⚠️ IMPORTANTE: Detectar se é MENSAGEM REAL antes de status update
  // Mensagem real tem: messageId + phone + (text/senderName/chatName) + fromMe=false
  const temConteudoMensagem = payload.text || payload.body || payload.message || 
                              payload.image || payload.video || payload.audio || 
                              payload.document || payload.sticker;
  const temIndicadoresMensagem = payload.senderName || payload.chatName || payload.pushName;
  const ehMensagemReal = payload.messageId && 
                         payload.phone && 
                         payload.fromMe === false && 
                         (temConteudoMensagem || temIndicadoresMensagem);

  // Status de mensagem - APENAS se NÃO for mensagem real
  // MessageStatusCallback geralmente vem com array "ids" e sem senderName
  if (!ehMensagemReal && (tipoRaw.includes('messagestatuscallback') || tipoRaw.includes('message-status') || (Array.isArray(payload.ids) && payload.ids.length > 0))) {
    const messageId =
      (Array.isArray(payload.ids) && payload.ids[0]) ||
      payload.messageId ||
      payload.id ||
      null;
    return {
      type: 'message_update',
      instanceId,
      messageId,
      status: payload.status,
    };
  }

  // Mensagem real
  const telefoneOrig = payload.phone ?? payload.from ?? payload.chatId ?? '';
  const numeroLimpo = normalizarTelefone(telefoneOrig);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  const messageId =
    payload.messageId ||
    payload.id ||
    (Array.isArray(payload.ids) && payload.ids[0]) ||
    payload.key?.id ||
    null;

  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo =
    payload.text?.message ??
    payload.text ??
    payload.body ??
    payload.message ??
    payload.caption ??
    '';

  // LOG DETALHADO PARA DEBUG DE MÍDIA
  const mediaFields = ['image', 'video', 'audio', 'document', 'sticker', 'imageUrl', 'videoUrl', 'audioUrl', 'documentUrl', 'mediaUrl', 'forwardedFrom'];
  const presentMediaFields = mediaFields.filter(f => payload[f]);
  if (presentMediaFields.length > 0) {
    console.log(`[${VERSION}] 📎 Campos de mídia presentes:`, presentMediaFields);
    for (const field of presentMediaFields) {
      console.log(`[${VERSION}] 📎 ${field}:`, JSON.stringify(payload[field]).substring(0, 300));
    }
  }
  
  // LOG ESPECIAL PARA MENSAGENS ENCAMINHADAS
  if (payload.isForwarded || payload.forwardedFrom) {
    console.log(`[${VERSION}] 📨 MENSAGEM ENCAMINHADA detectada!`);
    console.log(`[${VERSION}] 📨 forwardedFrom:`, JSON.stringify(payload.forwardedFrom || {}).substring(0, 200));
  }

  // Z-API pode enviar mídia de várias formas:
  // 1. { image: { imageUrl: "...", caption: "..." } }
  // 2. { image: "base64..." } 
  // 3. { imageUrl: "..." } direto no root
  // 4. { mediaUrl: "..." } genérico
  
  // ✅ PRIMEIRO: Verificar se é mensagem encaminhada com mídia
  const forwardedImage = payload.forwardedFrom?.image || payload.isForwarded && payload.image;
  
  if (payload.image || forwardedImage) {
    mediaType = 'image';
    const imgData = payload.image || forwardedImage;
    if (typeof imgData === 'object') {
      mediaUrl = imgData.imageUrl ?? imgData.url ?? imgData.link ?? imgData.mediaUrl ?? null;
      if (!conteudo) conteudo = imgData.caption ?? '[Imagem]';
    } else if (typeof imgData === 'string' && imgData.startsWith('http')) {
      mediaUrl = imgData;
      if (!conteudo) conteudo = '[Imagem]';
    }
  } else if (payload.imageUrl) {
    // URL direta no root
    mediaType = 'image';
    mediaUrl = payload.imageUrl;
    if (!conteudo) conteudo = payload.caption ?? '[Imagem]';
  } else if (payload.video) {
    mediaType = 'video';
    if (typeof payload.video === 'object') {
      mediaUrl = payload.video.videoUrl ?? payload.video.url ?? payload.video.link ?? payload.video.mediaUrl ?? null;
      if (!conteudo) conteudo = payload.video.caption ?? '[Vídeo]';
    } else if (typeof payload.video === 'string' && payload.video.startsWith('http')) {
      mediaUrl = payload.video;
      if (!conteudo) conteudo = '[Vídeo]';
    }
  } else if (payload.videoUrl) {
    mediaType = 'video';
    mediaUrl = payload.videoUrl;
    if (!conteudo) conteudo = payload.caption ?? '[Vídeo]';
  } else if (payload.audio) {
    mediaType = 'audio';
    if (typeof payload.audio === 'object') {
      mediaUrl = payload.audio.audioUrl ?? payload.audio.url ?? payload.audio.link ?? payload.audio.mediaUrl ?? null;
    } else if (typeof payload.audio === 'string' && payload.audio.startsWith('http')) {
      mediaUrl = payload.audio;
    }
    conteudo = conteudo || '[Áudio]';
  } else if (payload.audioUrl) {
    mediaType = 'audio';
    mediaUrl = payload.audioUrl;
    conteudo = conteudo || '[Áudio]';
  } else if (payload.document) {
    mediaType = 'document';
    if (typeof payload.document === 'object') {
      mediaUrl = payload.document.documentUrl ?? payload.document.url ?? payload.document.link ?? payload.document.mediaUrl ?? null;
      if (!conteudo) conteudo = payload.document.caption ?? payload.document.fileName ?? '[Documento]';
    } else if (typeof payload.document === 'string' && payload.document.startsWith('http')) {
      mediaUrl = payload.document;
      if (!conteudo) conteudo = '[Documento]';
    }
  } else if (payload.documentUrl) {
    mediaType = 'document';
    mediaUrl = payload.documentUrl;
    if (!conteudo) conteudo = payload.caption ?? '[Documento]';
  } else if (payload.sticker) {
    mediaType = 'sticker';
    if (typeof payload.sticker === 'object') {
      mediaUrl = payload.sticker.stickerUrl ?? payload.sticker.url ?? null;
    } else if (typeof payload.sticker === 'string' && payload.sticker.startsWith('http')) {
      mediaUrl = payload.sticker;
    }
    conteudo = '[Sticker]';
  } else if (payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (payload.location) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  }
  
  // Fallback: mediaUrl genérico no root
  if (mediaType === 'none' && payload.mediaUrl) {
    mediaUrl = payload.mediaUrl;
    // Tentar detectar tipo pela extensão
    const ext = (payload.mediaUrl.split('.').pop() || '').toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      mediaType = 'image';
      if (!conteudo) conteudo = '[Imagem]';
    } else if (['mp4', 'mov', 'avi', '3gp'].includes(ext)) {
      mediaType = 'video';
      if (!conteudo) conteudo = '[Vídeo]';
    } else if (['mp3', 'ogg', 'opus', 'wav', 'm4a'].includes(ext)) {
      mediaType = 'audio';
      if (!conteudo) conteudo = '[Áudio]';
    } else {
      mediaType = 'document';
      if (!conteudo) conteudo = '[Documento]';
    }
  }

  // Log final de mídia detectada
  if (mediaType !== 'none') {
    console.log(`[${VERSION}] 📎 Mídia detectada: ${mediaType} | URL: ${mediaUrl ? mediaUrl.substring(0, 80) + '...' : 'null'}`);
  }

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message',
    instanceId,
    messageId,
    from: numeroLimpo,
    content: String(conteudo ?? '').trim(),
    mediaType,
    mediaUrl,
    mediaCaption: payload.image?.caption ?? payload.video?.caption ?? payload.caption ?? null,
    pushName: payload.senderName ?? payload.pushName ?? payload.chatName ?? null,
    vcard: payload.contactMessage ?? payload.vcard ?? null,
    location: payload.location ?? null,
    quotedMessage: payload.quotedMsg ?? payload.quotedMessage ?? null,
  };
}

// --------------------------------------------------------------------------------------
// HANDLER PRINCIPAL
// --------------------------------------------------------------------------------------
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return jsonOk({ version: VERSION, build: BUILD_DATE, status: 'ok' });
    }

    if (req.method !== 'POST') {
      return jsonBadRequest({ success: false, error: 'metodo_nao_suportado' });
    }

    let base44;
    try {
      base44 = createClientFromRequest(req.clone());
    } catch (e) {
      console.error(`[${VERSION}] SDK init error:`, e?.message || e);
      return jsonServerError({ success: false, error: 'sdk_init_error' });
    }

    let payload;
    try {
      const body = await req.text();
      if (!body) return jsonOk({ success: true, ignored: true, reason: 'sem_corpo' });
      payload = JSON.parse(body);
    } catch (e) {
      return jsonBadRequest({ success: false, error: 'json_invalido' });
    }

    console.log(`[${VERSION}] 📥 Payload recebido (1/2):`, JSON.stringify(payload).substring(0, 1000));
  console.log(`[${VERSION}] 📥 Payload recebido (2/2):`, JSON.stringify(payload).substring(1000, 2000));

    const motivoIgnorar = deveIgnorar(payload);
    if (motivoIgnorar) {
      console.log(`[${VERSION}] ⏭️ Ignorado: ${motivoIgnorar}`);
      return jsonOk({ success: true, ignored: true, reason: motivoIgnorar });
    }

    const dados = normalizarPayload(payload);
    if (dados.type === 'unknown') {
      console.log(`[${VERSION}] ⏭️ Unknown: ${dados.error}`);
      return jsonOk({ success: true, ignored: true, reason: dados.error });
    }

    console.log(`[${VERSION}] 🔄 Processando: ${dados.type}`);

    // Connection manager removido para simplificar

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
        return jsonOk({ success: true, ignored: true, reason: 'tipo_desconhecido' });
    }
  } catch (error) {
    console.error(`[${VERSION}] ❌ ERRO não tratado:`, error?.message || error);
    return jsonServerError({ success: false, error: 'erro_interno' });
  }
});

// --------------------------------------------------------------------------------------
// HANDLERS
// --------------------------------------------------------------------------------------
async function handleQRCode(dados, base44) {
  console.log(`[${VERSION}] 📱 QR Code recebido para: ${dados.instanceId}`);
  
  if (!dados.instanceId) return jsonOk({ success: true, processed: 'qrcode', note: 'sem_instance' });

  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId },
      '-created_date',
      1
    );

    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl ?? null,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString(),
      });
      console.log(`[${VERSION}] ✅ QR Code atualizado para integração: ${integracoes[0].nome_instancia}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro QR Code:`, e?.message);
  }

  return jsonOk({ success: true, processed: 'qrcode' });
}

async function handleConnection(dados, base44) {
  console.log(`[${VERSION}] 🔌 Connection: ${dados.instanceId} -> ${dados.status}`);
  
  if (!dados.instanceId) return jsonOk({ success: true, processed: 'connection', note: 'sem_instance' });

  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId },
      '-created_date',
      1
    );

    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        status: dados.status,
        ultima_atividade: new Date().toISOString(),
      });
      console.log(`[${VERSION}] ✅ Status atualizado: ${integracoes[0].nome_instancia} -> ${dados.status}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro Connection:`, e?.message);
  }

  return jsonOk({ success: true, processed: 'connection', status: dados.status });
}

async function handleMessageUpdate(dados, base44) {
  console.log(`[${VERSION}] 📋 Status Update: ${dados.messageId} -> ${dados.status}`);
  
  if (!dados.messageId) return jsonOk({ success: true, processed: 'status_update', note: 'sem_message_id' });

  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId },
      '-created_date',
      1
    );

    if (mensagens.length > 0) {
      const statusMap = {
        READ: 'lida',
        READ_BY_ME: 'lida',
        DELIVERED: 'entregue',
        SENT: 'enviada',
        RECEIVED: 'recebida',
      };
      const key = String(dados.status ?? '').toUpperCase();
      const novoStatus = statusMap[key];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
        console.log(`[${VERSION}] ✅ Mensagem ${dados.messageId} -> ${novoStatus}`);
      }
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro Status Update:`, e?.message);
  }

  return jsonOk({ success: true, processed: 'status_update' });
}

async function handleMessage(dados, payloadBruto, base44) {
    const inicio = Date.now();
    const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
    console.log(`[${VERSION}] 💬 Nova mensagem de: ${dados.from} | Via: ${connectedPhone || 'não informado'}`);

  // Idempotência por whatsapp_message_id
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId },
        '-created_date',
        1
      );
      if (dup.length > 0) {
        console.log(`[${VERSION}] ⏭️ Mensagem duplicada: ${dados.messageId}`);
        return jsonOk({ success: true, ignored: true, reason: 'duplicata' });
      }
    } catch {
      // segue mesmo se falhar lookup
    }
  }

  // Buscar integração - PRIORIZAR connectedPhone para identificar canal exato
  let integracaoId = null;
  let integracaoInfo = null;

  // Primeiro: tentar por connectedPhone (mais preciso - identifica QUAL conexão recebeu)
  if (connectedPhone) {
    try {
      // Normalizar o connectedPhone para busca
      const phoneVariacoes = [
        '+' + connectedPhone,
        connectedPhone,
        '+55' + connectedPhone.replace(/^55/, '')
      ];

      for (const tel of phoneVariacoes) {
        if (integracaoId) break;
        const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { numero_telefone: tel },
          '-created_date',
          1
        );
        if (int.length > 0) {
          integracaoId = int[0].id;
          integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
        }
      }
    } catch {
      // silencioso
    }
  }

  // Fallback: buscar por instanceId
  if (!integracaoId && dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId },
        '-created_date',
        1
      );
      if (int.length > 0) {
        integracaoId = int[0].id;
        integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
      }
    } catch {
      // silencioso
    }
  }

  console.log(`[${VERSION}] 🔗 Integração: ${integracaoId || 'não encontrada'} | Canal: ${integracaoInfo?.numero || connectedPhone || 'N/A'}`);

  // Buscar/criar contato - tentar múltiplas variações do telefone
  let contato;
  try {
    // Gerar variações do telefone para busca
    const telefoneBase = dados.from.replace(/\D/g, '');
    const variacoes = [
      dados.from,                                    // +554899322400
      dados.from.replace('+', ''),                   // 554899322400
      '+55' + telefoneBase.substring(2),            // +5548999322400 (se já tem 55)
    ];
    
    // Se tem 13 dígitos (55+DDD+9+8), também buscar versão sem o 9
    if (telefoneBase.length === 13 && telefoneBase.startsWith('55')) {
      const semNono = telefoneBase.substring(0, 4) + telefoneBase.substring(5);
      variacoes.push('+' + semNono);
      variacoes.push(semNono);
    }
    
    // Se tem 12 dígitos (55+DDD+8), também buscar versão com o 9
    if (telefoneBase.length === 12 && telefoneBase.startsWith('55')) {
      const comNono = telefoneBase.substring(0, 4) + '9' + telefoneBase.substring(4);
      variacoes.push('+' + comNono);
      variacoes.push(comNono);
    }
    
    console.log(`[${VERSION}] 🔍 Buscando contato com variações:`, variacoes.slice(0, 3).join(', '));
    
    let contatos = [];
    for (const tel of variacoes) {
      if (contatos.length > 0) break;
      try {
        contatos = await base44.asServiceRole.entities.Contact.filter(
          { telefone: tel },
          '-created_date',
          1
        );
      } catch { /* continua */ }
    }

    if (contatos.length > 0) {
      contato = contatos[0];
      const update = { ultima_interacao: new Date().toISOString() };
      if (dados.pushName && (!contato.nome || contato.nome === dados.from)) {
        update.nome = dados.pushName;
      }
      await base44.asServiceRole.entities.Contact.update(contato.id, update);
      console.log(`[${VERSION}] 👤 Contato existente: ${contato.nome}`);
    } else {
      contato = await base44.asServiceRole.entities.Contact.create({
        nome: dados.pushName || dados.from,
        telefone: dados.from,
        tipo_contato: 'lead',
        whatsapp_status: 'verificado',
        ultima_interacao: new Date().toISOString(),
      });
      console.log(`[${VERSION}] 👤 Novo contato criado: ${contato.nome}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro contato:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_contato' });
  }

  // Buscar/criar thread
  let thread;
  try {
    const threads = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id },
      '-last_message_at',
      1
    );

    if (threads.length > 0) {
      thread = threads[0];
      const threadUpdate = {
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: String(dados.content || '').substring(0, 100),
        last_media_type: dados.mediaType || 'none',
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1,
        status: 'aberta',
      };
      if (integracaoId && !thread.whatsapp_integration_id) {
        threadUpdate.whatsapp_integration_id = integracaoId;
      }
      await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
      console.log(`[${VERSION}] 💭 Thread existente: ${thread.id}`);
    } else {
      thread = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoId,
        status: 'aberta',
        primeira_mensagem_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: String(dados.content || '').substring(0, 100),
        last_media_type: dados.mediaType || 'none',
        total_mensagens: 1,
        unread_count: 1,
      });
      console.log(`[${VERSION}] 💭 Nova thread criada: ${thread.id}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro thread:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_thread' });
  }

  // Salvar mensagem
  let mensagem;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: dados.content,
      media_url: dados.mediaUrl ?? null,
      media_type: dados.mediaType,
      media_caption: dados.mediaCaption ?? null,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: dados.messageId ?? null,
      sent_at: new Date().toISOString(),
      metadata: {
        analise_multimodal: null,
        midia_persistida: null,
        deleted: null,
        whatsapp_integration_id: integracaoId,
        instance_id: dados.instanceId ?? null,
        connected_phone: connectedPhone ?? null,
        canal_nome: integracaoInfo?.nome ?? null,
        canal_numero: integracaoInfo?.numero ?? (connectedPhone ? '+' + connectedPhone : null),
        vcard: dados.vcard ?? null,
        location: dados.location ?? null,
        quoted_message: dados.quotedMessage ?? null,
        processed_by: VERSION,
      },
    });
    console.log(`[${VERSION}] ✅ Mensagem salva: ${mensagem.id}`);
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro salvar mensagem:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_salvar_mensagem' });
  }

  // ============================================================================
  // ✅ PRÉ-ATENDIMENTO AUTOMÁTICO - ATIVADO POR SAUDAÇÕES
  // ============================================================================
  const SAUDACOES = [
    'oi', 'olá', 'ola', 'oie', 'oii', 'oiii',
    'bom dia', 'boa tarde', 'boa noite',
    'bomdia', 'boatarde', 'boanoite',
    'hey', 'hello', 'hi',
    'e aí', 'e ai', 'eai', 'eae',
    'tudo bem', 'tudo bom', 'como vai',
    'opa', 'fala', 'salve'
  ];
  
  const mensagemLower = (dados.content || '').toLowerCase().trim();
  const isSaudacao = SAUDACOES.some(s => mensagemLower === s || mensagemLower.startsWith(s + ' ') || mensagemLower.startsWith(s + ',') || mensagemLower.startsWith(s + '!'));
  
  // Verificar se há execução ativa de pré-atendimento
  let execucoesAtivas = [];
  try {
    execucoesAtivas = await base44.asServiceRole.entities.FlowExecution.filter({
      thread_id: thread.id,
      status: 'ativo'
    }, '-created_date', 1);
  } catch (e) {
    console.log(`[${VERSION}] ⚠️ Erro ao buscar execuções ativas:`, e?.message);
  }

  if (execucoesAtivas.length > 0) {
    // Processar resposta do pré-atendimento em andamento
    console.log(`[${VERSION}] 🔄 Processando resposta pré-atendimento | Thread: ${thread.id}`);
    try {
      await executarPreAtendimentoInline(base44, {
        action: 'processar_resposta',
        thread_id: thread.id,
        contact_id: contato.id,
        integration_id: integracaoId,
        resposta_usuario: dados.content
      });
    } catch (e) {
      console.error(`[${VERSION}] ❌ Erro ao processar resposta pré-atendimento:`, e?.message);
    }
  } else if (isSaudacao) {
    // Iniciar pré-atendimento apenas se for saudação
    console.log(`[${VERSION}] 🚀 Saudação detectada! Iniciando pré-atendimento | Msg: "${mensagemLower}" | Thread: ${thread.id}`);
    try {
      await executarPreAtendimentoInline(base44, {
        action: 'iniciar',
        thread_id: thread.id,
        contact_id: contato.id,
        integration_id: integracaoId
      });
      console.log(`[${VERSION}] ✅ Pré-atendimento iniciado com sucesso`);
    } catch (e) {
      console.error(`[${VERSION}] ❌ Erro ao iniciar pré-atendimento:`, e?.message);
    }
  } else {
    console.log(`[${VERSION}] ℹ️ Mensagem não é saudação, pré-atendimento não ativado | Msg: "${mensagemLower.substring(0, 30)}"`);
  }

  // Audit log
  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId ?? null,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: true,
    });
  } catch {
    // silencioso
  }

  const duracao = Date.now() - inicio;
  console.log(`[${VERSION}] ✅ SUCESSO! Msg: ${mensagem.id} | De: ${dados.from} | Int: ${integracaoId} | ${duracao}ms`);

  return jsonOk({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    pre_atendimento_triggered: isSaudacao && execucoesAtivas.length === 0
  });
}

// ============================================================================
// PRÉ-ATENDIMENTO INLINE
// ============================================================================
async function executarPreAtendimentoInline(base44, params) {
  const { action, thread_id, contact_id, integration_id, resposta_usuario } = params;

  function getSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function mapearSetorDeResposta(resposta, opcoesSetor) {
    if (!resposta || !opcoesSetor) return null;
    const textoLower = resposta.toLowerCase().trim();
    
    for (const opcao of opcoesSetor) {
      const labelLower = opcao.label.toLowerCase();
      if (textoLower === labelLower || textoLower.includes(opcao.setor) || labelLower.includes(textoLower)) {
        return opcao.setor;
      }
    }
    
    const mapeamento = {
      'vendas': ['venda', 'comprar', 'compra', 'preço', 'orçamento', 'cotação', '1', 'comercial'],
      'assistencia': ['suporte', 'assistencia', 'assistência', 'técnico', 'problema', 'ajuda', '2', 'reparo'],
      'financeiro': ['financeiro', 'boleto', 'pagamento', 'nota', 'fiscal', '3', 'cobrança'],
      'fornecedor': ['fornecedor', 'parceiro', 'fornecimento', '4'],
      'geral': ['outro', 'outros', 'geral', '5', 'não sei']
    };
    
    for (const [setor, palavras] of Object.entries(mapeamento)) {
      if (palavras.some(p => textoLower.includes(p))) {
        return setor;
      }
    }
    return null;
  }

  // ========== AÇÃO: INICIAR ==========
  if (action === 'iniciar') {
    const templates = await base44.asServiceRole.entities.FlowTemplate.filter({
      is_pre_atendimento_padrao: true,
      ativo: true
    }, '-created_date', 1);

    if (templates.length === 0) {
      console.log('[PRE-ATEND] ⚠️ Nenhum template de pré-atendimento configurado');
      return { success: false, error: 'sem_template' };
    }

    const template = templates[0];
    if (template.activation_mode === 'disabled') {
      console.log('[PRE-ATEND] ⚠️ Pré-atendimento desativado');
      return { success: false, skipped: true };
    }

    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);

    if (!thread || !contato) {
      return { success: false, error: 'thread_ou_contato_nao_encontrado' };
    }

    const saudacao = getSaudacao();
    let mensagemTexto = template.mensagem_saudacao || 'Olá! {saudacao}, para qual setor você gostaria de falar?';
    mensagemTexto = mensagemTexto.replace('{saudacao}', saudacao);
    
    if (contato.nome && contato.nome !== contato.telefone) {
      mensagemTexto = mensagemTexto.replace('Olá!', `Olá, ${contato.nome}!`);
    }

    const opcoesSetor = template.opcoes_setor || [
      { label: '💼 Vendas', setor: 'vendas' },
      { label: '🔧 Suporte', setor: 'assistencia' },
      { label: '💰 Financeiro', setor: 'financeiro' }
    ];

    const listaOpcoes = opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n');
    const mensagemCompleta = `${mensagemTexto}\n\n${listaOpcoes}\n\n_Responda com o número ou nome da opção desejada._`;

    // Buscar integração - ACEITAR QUALQUER CONEXÃO DISPONÍVEL
    let integracao = null;
    
    // 1. Tentar pela integration_id fornecida
    if (integration_id) {
      try {
        integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
      } catch (e) {
        console.log('[PRE-ATEND] ⚠️ Integração específica não encontrada:', integration_id);
      }
    }
    
    // 2. Fallback: buscar pela thread.whatsapp_integration_id
    if (!integracao && thread.whatsapp_integration_id) {
      try {
        integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id);
        console.log('[PRE-ATEND] 📱 Usando integração da thread:', thread.whatsapp_integration_id);
      } catch (e) {
        console.log('[PRE-ATEND] ⚠️ Integração da thread não encontrada');
      }
    }
    
    // 3. Fallback final: buscar QUALQUER integração conectada
    if (!integracao) {
      try {
        const integracoesDisponiveis = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { status: 'conectado' },
          '-ultima_atividade',
          1
        );
        if (integracoesDisponiveis.length > 0) {
          integracao = integracoesDisponiveis[0];
          console.log('[PRE-ATEND] 📱 Usando primeira integração conectada:', integracao.nome_instancia);
        }
      } catch (e) {
        console.log('[PRE-ATEND] ⚠️ Erro ao buscar integrações disponíveis');
      }
    }
    
    if (!integracao) {
      console.error('[PRE-ATEND] ❌ Nenhuma integração WhatsApp disponível');
      return { success: false, error: 'nenhuma_integracao_disponivel' };
    }

    // ✅ ENVIO UNIVERSAL - Detectar provider (Z-API ou W-API)
    const provider = integracao.api_provider || 'z_api';
    console.log('[PRE-ATEND] 📤 Enviando saudação para:', contato.telefone, '| Provider:', provider);
    
    let envioResp, envioData;
    const telefoneNumerico = contato.telefone.replace(/\D/g, '');
    
    if (provider === 'w_api') {
      // ========== W-API ==========
      const wapiUrl = `${integracao.base_url_provider || 'https://api.w-api.app/v1'}/${integracao.instance_id_provider}/messages/send-text`;
      const wapiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integracao.api_key_provider}`
      };
      
      envioResp = await fetch(wapiUrl, {
        method: 'POST',
        headers: wapiHeaders,
        body: JSON.stringify({
          phone: telefoneNumerico,
          message: mensagemCompleta
        })
      });
      envioData = await envioResp.json();
      console.log('[PRE-ATEND] 📥 Resposta W-API:', JSON.stringify(envioData));
      
    } else {
      // ========== Z-API (padrão) ==========
      const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
      const zapiHeaders = { 'Content-Type': 'application/json' };
      if (integracao.security_client_token_header) {
        zapiHeaders['Client-Token'] = integracao.security_client_token_header;
      }
      
      envioResp = await fetch(zapiUrl, {
        method: 'POST',
        headers: zapiHeaders,
        body: JSON.stringify({
          phone: telefoneNumerico,
          message: mensagemCompleta
        })
      });
      envioData = await envioResp.json();
      console.log('[PRE-ATEND] 📥 Resposta Z-API:', JSON.stringify(envioData));
    }

    if (!envioResp.ok || envioData.error) {
      console.error('[PRE-ATEND] ❌ Erro ao enviar:', envioData);
      return { success: false, error: envioData.error || 'erro_envio' };
    }

    const flowExecution = await base44.asServiceRole.entities.FlowExecution.create({
      flow_template_id: template.id,
      contact_id: contact_id,
      thread_id: thread_id,
      whatsapp_integration_id: integration_id,
      status: 'ativo',
      current_step: 0,
      started_at: new Date().toISOString(),
      variables: { saudacao, opcoes_setor: opcoesSetor }
    });

    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      pre_atendimento_ativo: true,
      pre_atendimento_state: 'WAITING_SECTOR_CHOICE',
      pre_atendimento_started_at: new Date().toISOString()
    });

    await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: 'system',
      sender_type: 'user',
      content: mensagemCompleta,
      channel: 'whatsapp',
      status: 'enviada',
      whatsapp_message_id: envioData.messageId,
      sent_at: new Date().toISOString(),
      metadata: { whatsapp_integration_id: integration_id, pre_atendimento: true }
    });

    console.log('[PRE-ATEND] ✅ Pré-atendimento iniciado | FlowExec:', flowExecution.id);
    return { success: true, flow_execution_id: flowExecution.id };
  }

  // ========== AÇÃO: PROCESSAR RESPOSTA ==========
  if (action === 'processar_resposta') {
    const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
      thread_id: thread_id,
      status: 'ativo'
    }, '-created_date', 1);

    if (execucoes.length === 0) {
      return { success: false, error: 'sem_execucao_ativa' };
    }

    const execucao = execucoes[0];
    const opcoesSetor = execucao.variables?.opcoes_setor || [];
    const tentativas = execucao.variables?.tentativas_nao_entendidas || 0;
    
    // ============================================================================
    // 🔧 NORMALIZAÇÃO ROBUSTA DO TEXTO
    // ============================================================================
    const textoOriginal = (resposta_usuario || '').trim();
    const textoLower = textoOriginal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const palavrasTexto = textoLower.split(/\s+/).filter(p => p.length > 0);
    
    console.log('[PRE-ATEND] 🔍 Analisando:', textoOriginal);
    console.log('[PRE-ATEND] 🔍 Normalizado:', textoLower);
    
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    const isFidelizado = contato.is_cliente_fidelizado === true;
    const tipoContato = contato.tipo_contato || 'novo';
    
    // Buscar integração
    let integracao = null;
    if (integration_id) {
      try { integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id); } catch (e) {}
    }
    if (!integracao && execucao.whatsapp_integration_id) {
      try { integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(execucao.whatsapp_integration_id); } catch (e) {}
    }
    if (!integracao && thread?.whatsapp_integration_id) {
      try { integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id); } catch (e) {}
    }
    if (!integracao) {
      try {
        const integracoesDisponiveis = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }, '-ultima_atividade', 1);
        if (integracoesDisponiveis.length > 0) integracao = integracoesDisponiveis[0];
      } catch (e) {}
    }
    if (!integracao) {
      console.error('[PRE-ATEND] ❌ Nenhuma integração disponível');
      return { success: false, error: 'nenhuma_integracao_disponivel' };
    }

    const provider = integracao.api_provider || 'z_api';
    const telefoneNumerico = contato.telefone.replace(/\D/g, '');

    // ============================================================================
    // FUNÇÃO AUXILIAR: ENVIAR MENSAGEM UNIVERSAL
    // ============================================================================
    async function enviarMensagem(msg) {
      try {
        if (provider === 'w_api') {
          await fetch(`${integracao.base_url_provider || 'https://api.w-api.app/v1'}/${integracao.instance_id_provider}/messages/send-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integracao.api_key_provider}` },
            body: JSON.stringify({ phone: telefoneNumerico, message: msg })
          });
        } else {
          const zapiHeaders = { 'Content-Type': 'application/json' };
          if (integracao.security_client_token_header) zapiHeaders['Client-Token'] = integracao.security_client_token_header;
          await fetch(`${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`, {
            method: 'POST',
            headers: zapiHeaders,
            body: JSON.stringify({ phone: telefoneNumerico, message: msg })
          });
        }
        await base44.asServiceRole.entities.Message.create({
          thread_id: thread_id,
          sender_id: 'system',
          sender_type: 'user',
          content: msg,
          channel: 'whatsapp',
          status: 'enviada',
          sent_at: new Date().toISOString(),
          metadata: { whatsapp_integration_id: integracao.id, pre_atendimento: true }
        });
      } catch (e) {
        console.error('[PRE-ATEND] ❌ Erro ao enviar mensagem:', e?.message);
      }
    }

    // ============================================================================
    // 📜 ANÁLISE PROFUNDA DO HISTÓRICO DE CONVERSAS
    // ============================================================================
    let historicoMensagens = [];
    try {
      historicoMensagens = await base44.asServiceRole.entities.Message.filter(
        { thread_id: thread_id },
        '-created_date',
        30 // últimas 30 mensagens para contexto mais amplo
      );
      console.log('[PRE-ATEND] 📜 Histórico:', historicoMensagens.length, 'mensagens');
    } catch (e) {
      console.log('[PRE-ATEND] ⚠️ Erro histórico:', e?.message);
    }

    // Análise profunda do contexto
    const contexto = {
      setores: { vendas: 0, assistencia: 0, financeiro: 0, fornecedor: 0 },
      intencoes: { cotacao: 0, suporte: 0, pagamento: 0, informacao: 0 },
      atendentesmencionados: [],
      ultimoAtendente: thread?.assigned_user_name || null,
      ultimoSetor: thread?.sector_id || null,
      temConversa: historicoMensagens.length > 2,
      mensagemEhContinuacao: false
    };
    
    // ============================================================================
    // 🔧 FUNÇÃO: SIMILARIDADE DE STRINGS (Levenshtein simplificado)
    // ============================================================================
    function similaridade(s1, s2) {
      if (!s1 || !s2) return 0;
      if (s1 === s2) return 1;
      if (s1.length < 2 || s2.length < 2) return 0;
      
      // Se um contém o outro
      if (s1.includes(s2) || s2.includes(s1)) return 0.9;
      
      // Se começam igual (primeiros 3+ chars)
      const minLen = Math.min(s1.length, s2.length);
      let prefixMatch = 0;
      for (let i = 0; i < minLen; i++) {
        if (s1[i] === s2[i]) prefixMatch++;
        else break;
      }
      if (prefixMatch >= 3) return 0.7 + (prefixMatch / minLen) * 0.2;
      
      // Contar caracteres em comum
      let comum = 0;
      const chars1 = s1.split('');
      const chars2 = s2.split('');
      for (const c of chars1) {
        const idx = chars2.indexOf(c);
        if (idx !== -1) {
          comum++;
          chars2.splice(idx, 1);
        }
      }
      return comum / Math.max(s1.length, s2.length);
    }

    // Função para verificar se palavra corresponde a algum termo (com tolerância a erros)
    function matchPalavra(palavra, termos) {
      for (const termo of termos) {
        if (palavra === termo) return true;
        if (palavra.length >= 4 && termo.length >= 4) {
          const sim = similaridade(palavra, termo);
          if (sim >= 0.75) return true; // 75% de similaridade
        }
      }
      return false;
    }

    // Palavras-chave por categoria (expandidas)
    const keywords = {
      vendas: ['venda', 'vendas', 'compra', 'comprar', 'comprou', 'comprei', 'comercial', 'produto', 'produtos', 'catalogo', 'bicicleta', 'bicicletas', 'bike', 'bikes', 'preco', 'valor', 'desconto', 'promocao', 'estoque', 'disponivel', 'tem', 'quero', 'interessado', 'interesse'],
      assistencia: ['suporte', 'tecnico', 'tecnica', 'assistencia', 'problema', 'problemas', 'defeito', 'defeitos', 'garantia', 'conserto', 'reparo', 'reparar', 'manutencao', 'nao funciona', 'quebrou', 'quebrado', 'trocar', 'troca', 'arrumar'],
      financeiro: ['financeiro', 'boleto', 'boletos', 'pagamento', 'pagamentos', 'pagar', 'paguei', 'pix', 'nota', 'notas', 'fiscal', 'nf', 'nfe', 'cobranca', 'parcela', 'parcelas', 'fatura', 'faturas', 'baixou', 'baixar', 'compensou', 'compensar', 'pago', 'paga', 'recibo', 'comprovante', 'transferencia', 'deposito', 'depositei'],
      fornecedor: ['fornecedor', 'fornecedores', 'parceiro', 'parceiros', 'parceria', 'representante', 'distribuidor', 'atacado', 'revenda', 'revendedor']
    };
    
    const intentKeywords = {
      cotacao: ['cotacao', 'orcamento', 'quanto', 'preco', 'valor', 'proposta', 'orcar', 'orcando', 'cotando', 'cotar'],
      suporte: ['ajuda', 'ajudar', 'problema', 'problemas', 'erro', 'erros', 'nao consigo', 'como faco', 'duvida', 'duvidas'],
      pagamento: ['pix', 'boleto', 'pagar', 'paguei', 'pagamento', 'baixou', 'baixar', 'compensou', 'compensar', 'pago', 'paga', 'transferencia', 'deposito', 'depositei', 'transferi'],
      informacao: ['informacao', 'saber', 'gostaria', 'poderia', 'sobre', 'informar']
    };

    // Analisar TODAS as mensagens do histórico
    for (const msg of historicoMensagens) {
      const conteudo = (msg.content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const palavrasMsg = conteudo.split(/\s+/).filter(p => p.length >= 2);
      
      // Contar menções de setores (com tolerância a erros)
      for (const [setor, termos] of Object.entries(keywords)) {
        for (const palavra of palavrasMsg) {
          if (matchPalavra(palavra, termos)) {
            contexto.setores[setor]++;
          }
        }
      }
      
      // Contar intenções (com tolerância a erros)
      for (const [intent, termos] of Object.entries(intentKeywords)) {
        for (const palavra of palavrasMsg) {
          if (matchPalavra(palavra, termos)) {
            contexto.intencoes[intent]++;
          }
        }
      }
    }

    // Analisar a mensagem ATUAL (peso maior + tolerância a erros)
    for (const palavra of palavrasTexto) {
      for (const [setor, termos] of Object.entries(keywords)) {
        if (matchPalavra(palavra, termos)) {
          contexto.setores[setor] += 5; // Peso maior para mensagem atual
          console.log('[PRE-ATEND] 🎯 Match setor:', palavra, '->', setor);
        }
      }
      for (const [intent, termos] of Object.entries(intentKeywords)) {
        if (matchPalavra(palavra, termos)) {
          contexto.intencoes[intent] += 5;
          console.log('[PRE-ATEND] 🎯 Match intenção:', palavra, '->', intent);
        }
      }
    }

    // Determinar setor e intenção dominantes
    const setorDominante = Object.entries(contexto.setores).sort((a, b) => b[1] - a[1])[0];
    const intencaoDominante = Object.entries(contexto.intencoes).sort((a, b) => b[1] - a[1])[0];
    
    console.log('[PRE-ATEND] 📊 Contexto setores:', JSON.stringify(contexto.setores));
    console.log('[PRE-ATEND] 📊 Contexto intenções:', JSON.stringify(contexto.intencoes));
    console.log('[PRE-ATEND] 🎯 Setor dominante:', setorDominante[0], '(', setorDominante[1], ')');
    console.log('[PRE-ATEND] 🎯 Intenção dominante:', intencaoDominante[0], '(', intencaoDominante[1], ')');

    // Verificar se é mensagem de continuação (não é resposta ao menu)
    const ehRespostaMenu = /^[1-5]$/.test(textoLower) || 
                          opcoesSetor.some(op => textoLower.includes(op.setor) || textoLower === op.label.toLowerCase());
    contexto.mensagemEhContinuacao = !ehRespostaMenu && textoLower.length > 10;

    // ============================================================================
    // 👥 CARREGAR ATENDENTES
    // ============================================================================
    let todosAtendentes = [];
    try {
      const [usuarios, vendedores] = await Promise.all([
        base44.asServiceRole.entities.User.filter({}, '-created_date', 100),
        base44.asServiceRole.entities.Vendedor.filter({ status: 'ativo' }, '-created_date', 50)
      ]);
      
      for (const u of usuarios) {
        if (u.full_name) {
          const nomeNorm = u.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const partes = nomeNorm.split(' ').filter(p => p.length >= 2);
          // Gerar apelidos/variações comuns do nome
          const apelidos = [];
          const pn = partes[0] || '';
          if (pn.length >= 4) {
            apelidos.push(pn.substring(0, 3)); // ex: "tha" de "thais"
            apelidos.push(pn.substring(0, 4)); // ex: "thai" de "thais"
          }
          // Variações comuns de nomes
          const variacoes = {
            'thais': ['tais', 'thays', 'tays'],
            'gabriel': ['gab', 'gabi', 'grabiel'],
            'rafael': ['rafa', 'rafinha'],
            'lucas': ['luca', 'luke'],
            'maria': ['mari', 'marih'],
            'julia': ['ju', 'julinha', 'juju'],
            'ana': ['aninha', 'anninha'],
            'joao': ['joaozinho', 'jão'],
            'pedro': ['pedrinho', 'ped'],
            'carlos': ['carlão', 'carlinhos', 'carl'],
            'fernanda': ['fer', 'nanda', 'fê'],
            'patricia': ['pat', 'pati', 'patty'],
            'rodrigo': ['rod', 'rods', 'rodriguinho'],
            'marcelo': ['marce', 'cel', 'celinho'],
            'eduardo': ['edu', 'dudu', 'duda'],
            'bruno': ['bru', 'bruninho'],
            'felipe': ['fel', 'felipinho', 'lipe'],
            'guilherme': ['gui', 'guiga', 'guilha'],
            'gustavo': ['gus', 'gu', 'guga'],
            'leonardo': ['leo', 'leozinho'],
            'matheus': ['mat', 'mateus', 'teus'],
            'renato': ['rena', 'renatinho'],
            'andre': ['dre', 'andrezinho'],
            'diego': ['di', 'dieguinho'],
            'fabio': ['fab', 'fabinho'],
            'henrique': ['hen', 'rick', 'rique'],
            'leandro': ['le', 'leandrinho'],
            'marcos': ['marc', 'marquinhos'],
            'paulo': ['paulinho', 'paul'],
            'ricardo': ['ric', 'ricardinho', 'rick'],
            'roberto': ['beto', 'robertinho', 'rob'],
            'sergio': ['serg', 'serginho'],
            'vinicius': ['vini', 'vinicius'],
            'alexandre': ['alex', 'xande', 'alê'],
            'anderson': ['ander', 'andersoninho'],
            'antonio': ['toninho', 'toni', 'antonio'],
            'cristiano': ['cris', 'cristiano'],
            'daniel': ['dan', 'dani', 'danielzinho'],
            'douglas': ['doug', 'douglinhas'],
            'everton': ['ever', 'evertonzinho'],
            'flavio': ['flav', 'flavinho'],
            'igor': ['igorzinho', 'ig'],
            'jonas': ['jo', 'jonaszinho'],
            'jose': ['ze', 'zezinho', 'josé'],
            'luiz': ['lu', 'luizinho', 'luis'],
            'marcio': ['marci', 'marcinho'],
            'mauricio': ['mau', 'mauricinho'],
            'nelson': ['nel', 'nelzinho'],
            'oscar': ['osc', 'oscarzinho'],
            'renan': ['re', 'renanzinho'],
            'rogerio': ['rog', 'rogerinho'],
            'samuel': ['sam', 'samuca', 'samu'],
            'thiago': ['thi', 'thiaguinho', 'tiago'],
            'victor': ['vic', 'vitinho', 'vitor'],
            'wagner': ['wag', 'wagnerzinho'],
            'william': ['will', 'willzinho', 'uilian'],
            'adriana': ['adri', 'dri'],
            'beatriz': ['bia', 'bea', 'biazinha'],
            'camila': ['cami', 'mila', 'amilinha'],
            'carolina': ['carol', 'carolzinha', 'lina'],
            'claudia': ['clau', 'claudinha'],
            'debora': ['deb', 'debinha'],
            'elaine': ['ela', 'elainezinha'],
            'fabiana': ['fabi', 'fabizinha'],
            'gabriela': ['gabi', 'gabizinha', 'gab'],
            'helena': ['hele', 'heleninha', 'lena'],
            'isabela': ['isa', 'bela', 'isabelinha'],
            'jessica': ['jess', 'jessiquinha'],
            'juliana': ['ju', 'juli', 'julinha'],
            'larissa': ['lari', 'larissinha'],
            'leticia': ['leti', 'leticinha'],
            'luciana': ['lu', 'luci', 'lucinha'],
            'mariana': ['mari', 'marianinha'],
            'natalia': ['nat', 'nati', 'natinha'],
            'priscila': ['pri', 'priscilinha'],
            'rafaela': ['rafa', 'rafinha'],
            'renata': ['re', 'renatinha'],
            'sabrina': ['sab', 'sabrininha'],
            'tatiana': ['tati', 'tatizinha'],
            'vanessa': ['van', 'vanessinha', 'nessa'],
            'viviane': ['vivi', 'vivizinha']
          };
          if (variacoes[pn]) {
            apelidos.push(...variacoes[pn]);
          }

          todosAtendentes.push({
            id: u.id,
            nome: u.full_name,
            nomeNorm: nomeNorm,
            primeiroNome: pn,
            sobrenome: partes.slice(1).join(' '),
            partes: partes,
            apelidos: apelidos,
            email: u.email,
            setor: u.attendant_sector || 'geral',
            tipo: 'user'
          });
        }
      }
      
      for (const v of vendedores) {
        if (v.nome && !todosAtendentes.some(a => a.email === v.email)) {
          const nomeNorm = v.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const partes = nomeNorm.split(' ').filter(p => p.length >= 2);
          todosAtendentes.push({
            id: v.id,
            nome: v.nome,
            nomeNorm: nomeNorm,
            primeiroNome: partes[0] || '',
            sobrenome: partes.slice(1).join(' '),
            partes: partes,
            email: v.email,
            setor: 'vendas',
            tipo: 'vendedor'
          });
        }
      }
      console.log('[PRE-ATEND] 👥 Atendentes:', todosAtendentes.length);
    } catch (e) {
      console.log('[PRE-ATEND] ⚠️ Erro atendentes:', e?.message);
    }

    // ============================================================================
    // 🤖 PRIORIDADE 0: PERGUNTAS SOBRE O NEXUS360
    // ============================================================================
    const palavrasNexus = ['nexus360', 'nexus 360', 'nexus', 'o que e nexus', 'sobre o nexus', 'como funciona', 'quem e voce', 'quem é você', 'voce e quem', 'você é quem', 'e uma ia', 'é uma ia', 'robo', 'robô', 'bot', 'automatico', 'automático', 'inteligencia artificial', 'ia de atendimento'];
    const perguntouNexus = palavrasNexus.some(p => textoLower.includes(p));

    if (perguntouNexus) {
      console.log('[PRE-ATEND] 🤖 Pergunta sobre Nexus360 detectada!');

      const mensagemNexus = `🤖 Sou a *Nexus360*, sua IA de atendimento!

      Analiso sua necessidade e direciono ao especialista certo, de forma rápida e inteligente. ✨

      Para qual setor posso te ajudar?

      ${opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n')}`;

      await enviarMensagem(mensagemNexus);

      // Manter pré-atendimento ativo para próxima resposta
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        variables: { ...execucao.variables, perguntou_nexus: true }
      });

      return { success: true, nexus_info_sent: true };
    }

    // ============================================================================
    // 🚨 PRIORIDADE 1: PEDIDO DIRETO DE ATENDENTE HUMANO
    // ============================================================================
    const pedidosHumano = ['atendente', 'humano', 'pessoa', 'falar com alguem', 'quero falar', 'preciso falar', 'me ajuda', 'ajuda', 'atender', 'atendimento', 'falar com voce', 'voces'];
    const querHumano = pedidosHumano.some(p => textoLower.includes(p));
    
    if (querHumano) {
      console.log('[PRE-ATEND] 🚨 PRIORIDADE 1: Pedido de atendente humano');
      
      // Determinar melhor setor baseado no contexto
      let setorDestino = 'geral';
      if (setorDominante[1] > 0) {
        setorDestino = setorDominante[0];
      } else if (contexto.ultimoSetor) {
        setorDestino = contexto.ultimoSetor;
      }
      
      // Buscar atendente fidelizado
      const camposFid = {
        vendas: 'atendente_fidelizado_vendas',
        assistencia: 'atendente_fidelizado_assistencia',
        financeiro: 'atendente_fidelizado_financeiro',
        fornecedor: 'atendente_fidelizado_fornecedor',
        geral: 'atendente_fidelizado_vendas'
      };
      
      let atendenteAtribuir = null;
      if (contato[camposFid[setorDestino]]) {
        try { atendenteAtribuir = await base44.asServiceRole.entities.User.get(contato[camposFid[setorDestino]]); } catch (e) {}
      }
      
      // Se não tem fidelizado, tentar o último atendente da conversa
      if (!atendenteAtribuir && thread?.assigned_user_id) {
        try { atendenteAtribuir = await base44.asServiceRole.entities.User.get(thread.assigned_user_id); } catch (e) {}
      }

      const threadUpdate = {
        sector_id: setorDestino,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      };

      let msg;
      if (atendenteAtribuir) {
        threadUpdate.assigned_user_id = atendenteAtribuir.id;
        threadUpdate.assigned_user_name = atendenteAtribuir.full_name;
        msg = `✅ Certo! Vou direcionar você para *${atendenteAtribuir.full_name}*. Aguarde um momento!`;
      } else {
        msg = `✅ Sem problemas! Um atendente entrará em contato em breve!`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, setor_escolhido: setorDestino, motivo: 'pediu_atendente' }
      });

      await enviarMensagem(msg);
      return { success: true, setor_escolhido: setorDestino, motivo: 'pediu_atendente' };
    }

    // ============================================================================
    // 🔍 PRIORIDADE 2: BUSCA POR NOME DE ATENDENTE (com tolerância a erros)
    // ============================================================================
    let melhorMatch = null;
    let melhorScore = 0;

    for (const atend of todosAtendentes) {
      let score = 0;
      
      // Verificar cada palavra do texto contra o nome do atendente
      for (const palavra of palavrasTexto) {
        if (palavra.length < 2) continue;
        
        // Match exato do primeiro nome
        if (palavra === atend.primeiroNome) {
          score = Math.max(score, 100);
          console.log('[PRE-ATEND] 👤 Match EXATO:', palavra, '=', atend.primeiroNome);
        }
        // Match exato com apelido/variação
        else if (atend.apelidos && atend.apelidos.includes(palavra)) {
          score = Math.max(score, 98);
          console.log('[PRE-ATEND] 👤 Match APELIDO:', palavra, '->', atend.primeiroNome);
        }
        // Similaridade alta com primeiro nome (tolera erros como "tais" -> "thais", "grabiel" -> "gabriel")
        else if (similaridade(palavra, atend.primeiroNome) >= 0.75) {
          score = Math.max(score, 95);
          console.log('[PRE-ATEND] 👤 Similaridade nome:', palavra, '~', atend.primeiroNome, '=', similaridade(palavra, atend.primeiroNome).toFixed(2));
        }
        // Similaridade com apelidos
        else if (atend.apelidos) {
          for (const apelido of atend.apelidos) {
            if (similaridade(palavra, apelido) >= 0.8) {
              score = Math.max(score, 90);
              console.log('[PRE-ATEND] 👤 Similaridade apelido:', palavra, '~', apelido);
              break;
            }
          }
        }
        // Primeiro nome começa com a palavra (ex: "tha" -> "thais")
        if (score < 85 && atend.primeiroNome.startsWith(palavra) && palavra.length >= 3) {
          score = Math.max(score, 85);
        }
        // Palavra começa com o primeiro nome (ex: "thaisxxx" -> "thais")
        else if (score < 80 && palavra.startsWith(atend.primeiroNome) && atend.primeiroNome.length >= 3) {
          score = Math.max(score, 80);
        }
        // Similaridade média com qualquer parte do nome
        else if (score < 70) {
          for (const parte of atend.partes) {
            if (parte.length >= 3) {
              const sim = similaridade(palavra, parte);
              if (sim >= 0.7) {
                score = Math.max(score, 70);
              }
            }
          }
        }
      }
      
      // Também verificar se o texto completo contém o nome
      if (score === 0 && atend.primeiroNome.length >= 3 && textoLower.includes(atend.primeiroNome)) {
        score = 85;
      }

      // Bonus: nome mencionado no histórico
      if (score > 0 && historicoMensagens.some(m => (m.content || '').toLowerCase().includes(atend.primeiroNome))) {
        score += 10;
      }
      
      // Bonus: é o atendente anterior da conversa
      if (score > 0 && thread?.assigned_user_id === atend.id) {
        score += 15;
      }

      if (score > melhorScore) {
        melhorScore = score;
        melhorMatch = atend;
        console.log('[PRE-ATEND] 👤 Candidato:', atend.nome, '| Score:', score);
      }
    }

    if (melhorMatch && melhorScore >= 50) {
      console.log('[PRE-ATEND] 👤 Atendente encontrado:', melhorMatch.nome, '| Score:', melhorScore, '| Setor:', melhorMatch.setor);
      
      let userId = melhorMatch.id;
      let userNome = melhorMatch.nome;
      let setorAtendente = melhorMatch.setor || 'geral';
      
      if (melhorMatch.tipo === 'vendedor' && melhorMatch.email) {
        try {
          const userMatch = await base44.asServiceRole.entities.User.filter({ email: melhorMatch.email }, '-created_date', 1);
          if (userMatch.length > 0) {
            userId = userMatch[0].id;
            userNome = userMatch[0].full_name;
            setorAtendente = userMatch[0].attendant_sector || melhorMatch.setor || 'geral';
          }
        } catch (e) {}
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        assigned_user_id: userId,
        assigned_user_name: userNome,
        sector_id: setorAtendente,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      });
      
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, atendente_escolhido: userNome, match_score: melhorScore, setor: setorAtendente }
      });

      const setorLabel = { vendas: 'Vendas', assistencia: 'Suporte Técnico', financeiro: 'Financeiro', fornecedor: 'Fornecedores', geral: '' }[setorAtendente] || '';
      const msgSetor = setorLabel ? ` do setor de *${setorLabel}*` : '';
      await enviarMensagem(`✅ Perfeito! Vou direcionar você para *${userNome}*${msgSetor}. Aguarde um momento!`);
      return { success: true, atendente_escolhido: userId, score: melhorScore, setor: setorAtendente };
    }

    // ============================================================================
    // 💰 PRIORIDADE 3: DETECTAR INTENÇÃO POR CONTEXTO
    // ============================================================================
    
    // 3A: Pagamento/Financeiro (pix, boleto, baixou, etc)
    if (contexto.intencoes.pagamento >= 3 || intencaoDominante[0] === 'pagamento') {
      console.log('[PRE-ATEND] 💰 Intenção: PAGAMENTO/FINANCEIRO');

      let atendente = null;

      // 1. Tentar atendente fidelizado
      if (contato.atendente_fidelizado_financeiro) {
        try { atendente = await base44.asServiceRole.entities.User.get(contato.atendente_fidelizado_financeiro); } catch (e) {}
      }

      // 2. Se não tem fidelizado, buscar atendente do setor financeiro
      if (!atendente) {
        try {
          const atendentesSetor = await base44.asServiceRole.entities.User.filter({
            attendant_sector: 'financeiro'
          }, '-created_date', 10);
          if (atendentesSetor.length > 0) {
            // Pegar o primeiro disponível
            atendente = atendentesSetor[0];
            console.log('[PRE-ATEND] 👤 Atendente do setor encontrado:', atendente.full_name);
          }
        } catch (e) {
          console.log('[PRE-ATEND] ⚠️ Erro ao buscar atendentes do setor:', e?.message);
        }
      }

      const threadUpdate = {
        sector_id: 'financeiro',
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED',
        categorias: ['pagamento']
      };

      let msg;
      if (atendente) {
        threadUpdate.assigned_user_id = atendente.id;
        threadUpdate.assigned_user_name = atendente.full_name;
        msg = `💰 Certo! Vou te conectar com *${atendente.full_name}* do Financeiro. Aguarde um instante! 😊`;
      } else {
        msg = `💰 Certo! Estou direcionando você para o setor *Financeiro*. Em breve um especialista vai te atender! 😊`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, intencao: 'pagamento', setor_escolhido: 'financeiro' }
      });

      await enviarMensagem(msg);
      return { success: true, intencao: 'pagamento', setor_escolhido: 'financeiro' };
    }

    // 3B: Cotação/Orçamento/Compra
    if (contexto.intencoes.cotacao >= 3 || intencaoDominante[0] === 'cotacao' || contexto.setores.vendas > 5) {
      console.log('[PRE-ATEND] 🛒 Intenção: COTAÇÃO/VENDAS');

      let atendente = null;

      // 1. Tentar atendente fidelizado
      if (contato.atendente_fidelizado_vendas) {
        try { atendente = await base44.asServiceRole.entities.User.get(contato.atendente_fidelizado_vendas); } catch (e) {}
      }

      // 2. Se não tem fidelizado, buscar atendente do setor vendas
      if (!atendente) {
        try {
          const atendentesSetor = await base44.asServiceRole.entities.User.filter({
            attendant_sector: 'vendas'
          }, '-created_date', 10);
          if (atendentesSetor.length > 0) {
            atendente = atendentesSetor[0];
            console.log('[PRE-ATEND] 👤 Atendente do setor encontrado:', atendente.full_name);
          }
        } catch (e) {
          console.log('[PRE-ATEND] ⚠️ Erro ao buscar atendentes do setor:', e?.message);
        }
      }

      const threadUpdate = {
        sector_id: 'vendas',
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED',
        categorias: ['cotacao']
      };

      let msg;
      if (atendente) {
        threadUpdate.assigned_user_id = atendente.id;
        threadUpdate.assigned_user_name = atendente.full_name;
        msg = `🛒 Perfeito! Vou te conectar com *${atendente.full_name}* de Vendas. Aguarde um instante! 😊`;
      } else {
        msg = `🛒 Perfeito! Estou direcionando você para o setor de *Vendas*. Um consultor vai te atender em breve! 😊`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, intencao: 'cotacao', setor_escolhido: 'vendas' }
      });

      await enviarMensagem(msg);
      return { success: true, intencao: 'cotacao', setor_escolhido: 'vendas' };
    }

    // 3C: Suporte/Assistência
    if (contexto.intencoes.suporte >= 3 || contexto.setores.assistencia > 5) {
      console.log('[PRE-ATEND] 🔧 Intenção: SUPORTE/ASSISTÊNCIA');

      let atendente = null;

      // 1. Tentar atendente fidelizado
      if (contato.atendente_fidelizado_assistencia) {
        try { atendente = await base44.asServiceRole.entities.User.get(contato.atendente_fidelizado_assistencia); } catch (e) {}
      }

      // 2. Se não tem fidelizado, buscar atendente do setor assistência
      if (!atendente) {
        try {
          const atendentesSetor = await base44.asServiceRole.entities.User.filter({
            attendant_sector: 'assistencia'
          }, '-created_date', 10);
          if (atendentesSetor.length > 0) {
            atendente = atendentesSetor[0];
            console.log('[PRE-ATEND] 👤 Atendente do setor encontrado:', atendente.full_name);
          }
        } catch (e) {
          console.log('[PRE-ATEND] ⚠️ Erro ao buscar atendentes do setor:', e?.message);
        }
      }

      const threadUpdate = {
        sector_id: 'assistencia',
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED',
        categorias: ['suporte']
      };

      let msg;
      if (atendente) {
        threadUpdate.assigned_user_id = atendente.id;
        threadUpdate.assigned_user_name = atendente.full_name;
        msg = `🔧 Certo! Vou te conectar com *${atendente.full_name}* da Assistência Técnica. Aguarde um instante! 😊`;
      } else {
        msg = `🔧 Certo! Estou direcionando você para a *Assistência Técnica*. Um técnico vai te atender em breve! 😊`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, intencao: 'suporte', setor_escolhido: 'assistencia' }
      });

      await enviarMensagem(msg);
      return { success: true, intencao: 'suporte', setor_escolhido: 'assistencia' };
    }

    // ============================================================================
    // 📋 PRIORIDADE 4: SELEÇÃO DE SETOR POR NÚMERO/NOME
    // ============================================================================
    let setorEscolhido = mapearSetorDeResposta(resposta_usuario, opcoesSetor);
    
    if (setorEscolhido) {
      console.log('[PRE-ATEND] 📋 Setor selecionado pelo menu:', setorEscolhido);
      
      const campoFidelizado = {
        vendas: 'atendente_fidelizado_vendas',
        assistencia: 'atendente_fidelizado_assistencia',
        financeiro: 'atendente_fidelizado_financeiro',
        fornecedor: 'atendente_fidelizado_fornecedor'
      };
      
      let atendenteFidelizado = null;
      const campo = campoFidelizado[setorEscolhido];
      if (campo && contato[campo]) {
        try { atendenteFidelizado = await base44.asServiceRole.entities.User.get(contato[campo]); } catch (e) {}
      }

      const threadUpdate = {
        sector_id: setorEscolhido,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      };

      let msg;
      if (atendenteFidelizado) {
        threadUpdate.assigned_user_id = atendenteFidelizado.id;
        threadUpdate.assigned_user_name = atendenteFidelizado.full_name;
        msg = `✅ Perfeito! *${atendenteFidelizado.full_name}* do setor de *${setorEscolhido}* irá atendê-lo. Aguarde!`;
      } else {
        msg = `✅ Entendido! Sua conversa foi direcionada para *${setorEscolhido}*. Um atendente entrará em contato em breve.`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, setor_escolhido: setorEscolhido }
      });

      await enviarMensagem(msg);
      return { success: true, setor_escolhido: setorEscolhido };
    }

    // ============================================================================
    // 🧠 PRIORIDADE 5: INFERIR PELO CONTEXTO DOMINANTE
    // ============================================================================
    if (setorDominante[1] >= 3 || contexto.mensagemEhContinuacao) {
      const setorInferido = setorDominante[1] >= 3 ? setorDominante[0] : (contexto.ultimoSetor || 'geral');
      console.log('[PRE-ATEND] 🧠 Setor inferido do contexto:', setorInferido);
      
      const camposFid = {
        vendas: 'atendente_fidelizado_vendas',
        assistencia: 'atendente_fidelizado_assistencia',
        financeiro: 'atendente_fidelizado_financeiro',
        fornecedor: 'atendente_fidelizado_fornecedor',
        geral: 'atendente_fidelizado_vendas'
      };
      
      let atendente = null;
      if (contato[camposFid[setorInferido]]) {
        try { atendente = await base44.asServiceRole.entities.User.get(contato[camposFid[setorInferido]]); } catch (e) {}
      }
      if (!atendente && thread?.assigned_user_id) {
        try { atendente = await base44.asServiceRole.entities.User.get(thread.assigned_user_id); } catch (e) {}
      }

      const threadUpdate = {
        sector_id: setorInferido,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      };

      let msg;
      if (atendente) {
        threadUpdate.assigned_user_id = atendente.id;
        threadUpdate.assigned_user_name = atendente.full_name;
        msg = `✅ Entendido! *${atendente.full_name}* irá continuar seu atendimento. Aguarde um momento!`;
      } else {
        msg = `✅ Entendido! Um atendente do setor de *${setorInferido}* entrará em contato em breve!`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, setor_escolhido: setorInferido, motivo: 'contexto_inferido' }
      });

      await enviarMensagem(msg);
      return { success: true, setor_escolhido: setorInferido, motivo: 'contexto_inferido' };
    }

    // ============================================================================
    // ❓ FALLBACK: NÃO ENTENDEU
    // ============================================================================
    console.log('[PRE-ATEND] ❓ Não identificado:', textoLower.substring(0, 50));
    
    const novasTentativas = tentativas + 1;
    await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
      variables: { ...execucao.variables, tentativas_nao_entendidas: novasTentativas, ultima_resposta: textoOriginal }
    });
    
    // Após 2 tentativas OU se cliente é fidelizado, direciona direto
    if (novasTentativas >= 2 || isFidelizado || tipoContato === 'cliente') {
      console.log('[PRE-ATEND] ⏩ Direcionando automaticamente (tentativas:', novasTentativas, '| fidelizado:', isFidelizado, ')');
      
      let setorFallback = contexto.ultimoSetor || 'geral';
      if (setorDominante[1] > 0) setorFallback = setorDominante[0];
      
      let atendente = null;
      if (thread?.assigned_user_id) {
        try { atendente = await base44.asServiceRole.entities.User.get(thread.assigned_user_id); } catch (e) {}
      }
      
      const threadUpdate = {
        sector_id: setorFallback,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      };
      
      if (atendente) {
        threadUpdate.assigned_user_id = atendente.id;
        threadUpdate.assigned_user_name = atendente.full_name;
      }
      
      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, setor_escolhido: setorFallback, motivo: 'fallback_automatico' }
      });
      
      const nomeAtend = atendente ? ` *${atendente.full_name}*` : ' um atendente';
      await enviarMensagem(`👋 Sem problemas! Vou encaminhar você para${nomeAtend}. Aguarde um momento!`);
      return { success: true, setor_escolhido: setorFallback, motivo: 'fallback_automatico' };
    }
    
    // Primeira tentativa - mensagem mais clara
    const nomesDisponiveis = todosAtendentes.slice(0, 3).map(a => a.primeiroNome.charAt(0).toUpperCase() + a.primeiroNome.slice(1));
    
    let msgNaoEntendi = `🤔 Não consegui identificar sua solicitação.\n\n`;
    msgNaoEntendi += `*Escolha uma opção:*\n`;
    msgNaoEntendi += opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n');
    msgNaoEntendi += `\n\n💡 Você também pode:\n`;
    msgNaoEntendi += `• Digitar *"atendente"* para falar com alguém\n`;
    if (nomesDisponiveis.length > 0) {
      msgNaoEntendi += `• Digitar o nome (ex: *${nomesDisponiveis[0]}*)\n`;
    }
    msgNaoEntendi += `• Descrever o que precisa`;
    
    await enviarMensagem(msgNaoEntendi);
    return { success: true, understood: false, tentativas: novasTentativas };
  }

  return { success: false, error: 'acao_invalida' };
}