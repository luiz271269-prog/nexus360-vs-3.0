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
    const textoUsuario = (resposta_usuario || '').toLowerCase().trim();
    const tentativasAtuais = execucao.variables?.tentativas || 0;

    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    
    // Buscar integração - ACEITAR QUALQUER CONEXÃO DISPONÍVEL
    let integracao = null;
    if (integration_id) {
      try { integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id); } catch (e) {}
    }
    if (!integracao && execucao.whatsapp_integration_id) {
      try { integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(execucao.whatsapp_integration_id); } catch (e) {}
    }
    if (!integracao) {
      try {
        const integracoesDisponiveis = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }, '-ultima_atividade', 1);
        if (integracoesDisponiveis.length > 0) integracao = integracoesDisponiveis[0];
      } catch (e) {}
    }
    if (!integracao) {
      console.error('[PRE-ATEND] ❌ Nenhuma integração disponível para responder');
      return { success: false, error: 'nenhuma_integracao_disponivel' };
    }

    // ============================================================================
    // 🧠 ANÁLISE INTELIGENTE DA RESPOSTA
    // ============================================================================
    
    // 1️⃣ VERIFICAR SE É NOME DE ATENDENTE
    let atendenteEncontrado = null;
    try {
      // Buscar em Vendedor
      const vendedores = await base44.asServiceRole.entities.Vendedor.filter({ status: 'ativo' }, '-created_date', 50);
      for (const v of vendedores) {
        const nomeVendedor = (v.nome || '').toLowerCase();
        const primeiroNome = nomeVendedor.split(' ')[0];
        if (textoUsuario === primeiroNome || textoUsuario === nomeVendedor || nomeVendedor.includes(textoUsuario)) {
          atendenteEncontrado = { tipo: 'vendedor', id: v.id, nome: v.nome, email: v.email };
          break;
        }
      }
      
      // Buscar em User (atendentes)
      if (!atendenteEncontrado) {
        const usuarios = await base44.asServiceRole.entities.User.filter({}, '-created_date', 50);
        for (const u of usuarios) {
          const nomeUser = (u.full_name || '').toLowerCase();
          const primeiroNome = nomeUser.split(' ')[0];
          if (textoUsuario === primeiroNome || textoUsuario === nomeUser || nomeUser.includes(textoUsuario)) {
            atendenteEncontrado = { tipo: 'user', id: u.id, nome: u.full_name, email: u.email };
            break;
          }
        }
      }
    } catch (e) {
      console.log('[PRE-ATEND] ⚠️ Erro ao buscar atendentes:', e?.message);
    }

    // Se encontrou atendente por nome
    if (atendenteEncontrado) {
      console.log('[PRE-ATEND] 👤 Atendente identificado pelo nome:', atendenteEncontrado.nome);
      
      // Verificar se contato é fidelizado para este atendente
      const isFidelizado = contato.is_cliente_fidelizado && (
        contato.atendente_fidelizado_vendas === atendenteEncontrado.id ||
        contato.atendente_fidelizado_assistencia === atendenteEncontrado.id ||
        contato.atendente_fidelizado_financeiro === atendenteEncontrado.id ||
        contato.atendente_fidelizado_fornecedor === atendenteEncontrado.id
      );

      const threadUpdate = {
        assigned_user_id: atendenteEncontrado.id,
        assigned_user_name: atendenteEncontrado.nome,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      };

      let mensagemConfirmacao;
      if (isFidelizado) {
        mensagemConfirmacao = `✅ Perfeito! Você será atendido por *${atendenteEncontrado.nome}*, seu atendente de confiança. Aguarde um momento!`;
      } else {
        mensagemConfirmacao = `✅ Certo! Vou direcionar você para *${atendenteEncontrado.nome}*. Aguarde um momento!`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, atendente_escolhido: atendenteEncontrado.nome }
      });

      await enviarMensagemUniversal(integracao, contato.telefone, mensagemConfirmacao);
      await salvarMensagemSistema(base44, thread_id, integration_id, mensagemConfirmacao);

      console.log('[PRE-ATEND] ✅ Concluído | Atendente:', atendenteEncontrado.nome);
      return { success: true, atendente_escolhido: atendenteEncontrado.nome };
    }

    // 2️⃣ VERIFICAR INTENÇÕES ESPECÍFICAS (cotação, orçamento, preço)
    const PALAVRAS_COTACAO = ['cotação', 'cotacao', 'orçamento', 'orcamento', 'preço', 'preco', 'quanto custa', 'valor', 'tabela'];
    const querCotacao = PALAVRAS_COTACAO.some(p => textoUsuario.includes(p));
    
    if (querCotacao) {
      console.log('[PRE-ATEND] 💰 Intenção de cotação detectada');
      
      // Verificar se tem atendente fidelizado de vendas
      let atendenteVendas = null;
      if (contato.atendente_fidelizado_vendas) {
        try { atendenteVendas = await base44.asServiceRole.entities.User.get(contato.atendente_fidelizado_vendas); } catch (e) {}
      }

      const threadUpdate = {
        sector_id: 'vendas',
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED',
        categorias: ['cotacao']
      };

      let mensagemConfirmacao;
      if (atendenteVendas) {
        threadUpdate.assigned_user_id = atendenteVendas.id;
        threadUpdate.assigned_user_name = atendenteVendas.full_name;
        mensagemConfirmacao = `💰 Entendido! *${atendenteVendas.full_name}* do setor de Vendas irá atendê-lo para sua cotação. Aguarde um momento!`;
      } else {
        mensagemConfirmacao = `💰 Perfeito! Vou direcionar você para o setor de *Vendas* para sua cotação. Um especialista entrará em contato em breve!`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, setor_escolhido: 'vendas', intencao: 'cotacao' }
      });

      await enviarMensagemUniversal(integracao, contato.telefone, mensagemConfirmacao);
      await salvarMensagemSistema(base44, thread_id, integration_id, mensagemConfirmacao);

      return { success: true, setor_escolhido: 'vendas', intencao: 'cotacao' };
    }

    // 3️⃣ VERIFICAR SE ESCOLHEU UM SETOR
    const setorEscolhido = mapearSetorDeResposta(resposta_usuario, opcoesSetor);
    
    if (setorEscolhido) {
      // Buscar atendente fidelizado para o setor
      const campoFidelizado = {
        'vendas': 'atendente_fidelizado_vendas',
        'assistencia': 'atendente_fidelizado_assistencia',
        'financeiro': 'atendente_fidelizado_financeiro',
        'fornecedor': 'atendente_fidelizado_fornecedor'
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

      let mensagemConfirmacao;
      if (atendenteFidelizado) {
        threadUpdate.assigned_user_id = atendenteFidelizado.id;
        threadUpdate.assigned_user_name = atendenteFidelizado.full_name;
        mensagemConfirmacao = `✅ Perfeito! Você será atendido por *${atendenteFidelizado.full_name}* do setor de *${setorEscolhido}*. Aguarde um momento!`;
      } else {
        mensagemConfirmacao = `✅ Entendido! Sua conversa foi direcionada para o setor de *${setorEscolhido}*. Um atendente entrará em contato em breve.`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, setor_escolhido: setorEscolhido }
      });

      await enviarMensagemUniversal(integracao, contato.telefone, mensagemConfirmacao);
      await salvarMensagemSistema(base44, thread_id, integration_id, mensagemConfirmacao);

      console.log('[PRE-ATEND] ✅ Concluído | Setor:', setorEscolhido, '| Fidelizado:', atendenteFidelizado?.id || 'N/A');
      return { success: true, setor_escolhido: setorEscolhido };
    }

    // 4️⃣ NÃO ENTENDEU - MENSAGEM AMIGÁVEL COM OPÇÕES
    console.log('[PRE-ATEND] ❓ Resposta não identificada:', textoUsuario);
    
    // Incrementar tentativas
    const novasTentativas = tentativasAtuais + 1;
    await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
      variables: { ...execucao.variables, tentativas: novasTentativas }
    });

    let msgAjuda;
    if (novasTentativas >= 2) {
      // Após 2 tentativas, oferecer falar com atendente direto
      msgAjuda = `🤔 Ainda não consegui entender. Como posso te ajudar?\n\n` +
                 `Você pode:\n` +
                 `• Digitar o *número* ou *nome do setor*\n` +
                 `• Digitar o *nome de um atendente* específico\n` +
                 `• Ou simplesmente dizer o que precisa (ex: "quero uma cotação")\n\n` +
                 opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n') +
                 `\n\n_Se preferir, digite "atendente" para falar diretamente com alguém._`;
    } else {
      msgAjuda = `🤔 Não consegui identificar sua escolha.\n\n` +
                 `Como posso te ajudar? Você pode:\n` +
                 `• Escolher um *setor* abaixo\n` +
                 `• Digitar o *nome de um atendente*\n` +
                 `• Ou me dizer o que você precisa\n\n` +
                 opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n');
    }

    // Verificar se pediu para falar com atendente genérico
    const querAtendente = ['atendente', 'humano', 'pessoa', 'alguem', 'alguém', 'falar com'].some(p => textoUsuario.includes(p));
    if (querAtendente) {
      // Direcionar para setor geral sem encerrar
      const threadUpdate = {
        sector_id: 'geral',
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      };

      const mensagemConfirmacao = `✅ Sem problemas! Vou direcionar você para um atendente disponível. Aguarde um momento!`;

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: { ...execucao.variables, setor_escolhido: 'geral', pediu_atendente: true }
      });

      await enviarMensagemUniversal(integracao, contato.telefone, mensagemConfirmacao);
      await salvarMensagemSistema(base44, thread_id, integration_id, mensagemConfirmacao);

      return { success: true, setor_escolhido: 'geral', pediu_atendente: true };
    }

    await enviarMensagemUniversal(integracao, contato.telefone, msgAjuda);
    await salvarMensagemSistema(base44, thread_id, integration_id, msgAjuda);

    return { success: true, understood: false, tentativas: novasTentativas };
  }

  return { success: false, error: 'acao_invalida' };
}

// ============================================================================
// FUNÇÕES AUXILIARES DO PRÉ-ATENDIMENTO
// ============================================================================
async function enviarMensagemUniversal(integracao, telefone, mensagem) {
  const provider = integracao.api_provider || 'z_api';
  const telefoneNumerico = telefone.replace(/\D/g, '');
  
  if (provider === 'w_api') {
    await fetch(`${integracao.base_url_provider || 'https://api.w-api.app/v1'}/${integracao.instance_id_provider}/messages/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integracao.api_key_provider}` },
      body: JSON.stringify({ phone: telefoneNumerico, message: mensagem })
    });
  } else {
    const zapiHeaders = { 'Content-Type': 'application/json' };
    if (integracao.security_client_token_header) zapiHeaders['Client-Token'] = integracao.security_client_token_header;
    await fetch(`${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`, {
      method: 'POST',
      headers: zapiHeaders,
      body: JSON.stringify({ phone: telefoneNumerico, message: mensagem })
    });
  }
}

async function salvarMensagemSistema(base44, thread_id, integration_id, conteudo) {
  await base44.asServiceRole.entities.Message.create({
    thread_id: thread_id,
    sender_id: 'system',
    sender_type: 'user',
    content: conteudo,
    channel: 'whatsapp',
    status: 'enviada',
    sent_at: new Date().toISOString(),
    metadata: { whatsapp_integration_id: integration_id, pre_atendimento: true }
  });
}