/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Z-API ADAPTER - NORMALIZAÇÃO DE PAYLOADS                   ║
 * ║  Versão: 1.0 - Padronização para formato interno           ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Transforma payloads da Z-API em formato padronizado interno:
 * {
 *   instanceId: string,
 *   from: string,
 *   to: string,
 *   messageId: string,
 *   timestamp: number,
 *   content: string,
 *   mediaType: 'none' | 'image' | 'video' | 'audio' | 'document' | 'sticker',
 *   mediaTempUrl: string | null,
 *   mediaCaption: string | null,
 *   type: 'message' | 'qrcode' | 'connection',
 *   isFromMe: boolean
 * }
 */

/**
 * Identifica o instance/instanceId do payload
 */
export function extrairInstanceId(payload) {
  // Tentar no root
  if (payload.instance) return payload.instance;
  if (payload.instanceId) return payload.instanceId;
  
  // Tentar em data
  if (payload.data?.instance) return payload.data.instance;
  if (payload.data?.instanceId) return payload.data.instanceId;
  
  return null;
}

/**
 * Normaliza mensagem no formato Z-API direto (ReceivedCallback)
 */
export function normalizarMensagemZAPI(payload) {
  // Z-API usa "telefone" no ReceivedCallback
  const telefone = payload.telefone || payload.phone;
  const numeroFormatado = telefone?.startsWith('+') ? telefone : `+${telefone}`;
  
  // Extrair conteúdo
  let conteudo = '[Mensagem vazia]';
  let mediaType = 'none';
  let mediaTempUrl = null;
  let mediaCaption = null;
  
  if (payload.text?.message) {
    conteudo = payload.text.message;
  } else if (payload.image) {
    conteudo = payload.image.caption || '[Imagem]';
    mediaType = 'image';
    mediaTempUrl = payload.image.imageUrl;
    mediaCaption = payload.image.caption;
  } else if (payload.video) {
    conteudo = payload.video.caption || '[Video]';
    mediaType = 'video';
    mediaTempUrl = payload.video.videoUrl;
    mediaCaption = payload.video.caption;
  } else if (payload.audio) {
    conteudo = '[Audio]';
    mediaType = 'audio';
    mediaTempUrl = payload.audio.audioUrl;
  } else if (payload.document) {
    conteudo = payload.document.fileName || '[Documento]';
    mediaType = 'document';
    mediaTempUrl = payload.document.documentUrl;
  } else if (payload.buttonsResponseMessage) {
    conteudo = payload.buttonsResponseMessage.message || '[Resposta de Botao]';
    mediaType = 'button_reply';
  } else if (payload.listResponseMessage) {
    conteudo = payload.listResponseMessage.title || '[Resposta de Lista]';
    mediaType = 'list_reply';
  } else if (payload.interactive?.type === 'button_reply') {
    conteudo = payload.interactive.button_reply?.title || payload.interactive.button_reply?.id || '[Resposta de Botao]';
    mediaType = 'button_reply';
  } else if (payload.interactive?.type === 'list_reply') {
    conteudo = payload.interactive.list_reply?.title || payload.interactive.list_reply?.id || '[Resposta de Lista]';
    mediaType = 'list_reply';
  }
  
  return {
    instanceId: payload.instanceId,
    from: numeroFormatado,
    to: payload.connectedPhone ? `+${payload.connectedPhone}` : null,
    messageId: payload.messageId || `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: payload.momento || payload.momment || Date.now(),
    content: conteudo,
    mediaType: mediaType,
    mediaTempUrl: mediaTempUrl,
    mediaCaption: mediaCaption,
    type: 'message',
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null
  };
}

/**
 * Normaliza um evento de mensagem (messages.upsert)
 */
export function normalizarMensagem(payload) {
  const data = payload.data || payload;
  const messages = data.messages || [];
  
  if (messages.length === 0) {
    return null;
  }
  
  const mensagem = messages[0];
  const key = mensagem.key || {};
  const message = mensagem.message || {};
  
  // Extrair número (remoteJid)
  const remoteJid = key.remoteJid || '';
  const numero = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  const numeroFormatado = numero.startsWith('+') ? numero : `+${numero}`;
  
  // Extrair conteúdo e mídia
  let conteudo = '[Mensagem vazia]';
  let mediaType = 'none';
  let mediaTempUrl = null;
  let mediaCaption = null;
  
  if (message.conversation) {
    conteudo = message.conversation;
  } else if (message.extendedTextMessage?.text) {
    conteudo = message.extendedTextMessage.text;
  } else if (message.imageMessage) {
    conteudo = message.imageMessage.caption || '[Imagem]';
    mediaType = 'image';
    mediaTempUrl = message.imageMessage.url;
    mediaCaption = message.imageMessage.caption;
  } else if (message.videoMessage) {
    conteudo = message.videoMessage.caption || '[Vídeo]';
    mediaType = 'video';
    mediaTempUrl = message.videoMessage.url;
    mediaCaption = message.videoMessage.caption;
  } else if (message.audioMessage) {
    conteudo = '[Áudio]';
    mediaType = 'audio';
    mediaTempUrl = message.audioMessage.url;
  } else if (message.documentMessage) {
    conteudo = message.documentMessage.fileName || '[Documento]';
    mediaType = 'document';
    mediaTempUrl = message.documentMessage.url;
  } else if (message.stickerMessage) {
    conteudo = '[Figurinha]';
    mediaType = 'sticker';
  }
  
  // Timestamp (defensivo para segundos ou milissegundos)
  const timestamp = mensagem.messageTimestamp 
    ? (typeof mensagem.messageTimestamp === 'number' 
        ? (mensagem.messageTimestamp < 1e12 ? mensagem.messageTimestamp * 1000 : mensagem.messageTimestamp)
        : parseInt(mensagem.messageTimestamp) * 1000)
    : Date.now();
  
  return {
    instanceId: extrairInstanceId(payload),
    from: numeroFormatado,
    to: null, // Z-API não fornece o "to" explicitamente em messages.upsert
    messageId: key.id,
    timestamp: timestamp,
    content: conteudo,
    mediaType: mediaType,
    mediaTempUrl: mediaTempUrl,
    mediaCaption: mediaCaption,
    type: 'message',
    isFromMe: key.fromMe || false,
    pushName: mensagem.pushName || null
  };
}

/**
 * Normaliza um evento de QR Code (qrcode.updated)
 */
export function normalizarQRCode(payload) {
  const data = payload.data || payload;
  
  return {
    instanceId: extrairInstanceId(payload),
    type: 'qrcode',
    qrCodeUrl: data.qrcode || data.qr || null,
    timestamp: Date.now()
  };
}

/**
 * Normaliza um evento de conexão (connection.update)
 */
export function normalizarConnection(payload) {
  const data = payload.data || payload;
  
  let status = 'desconectado';
  if (data.state === 'open' || data.status === 'open') {
    status = 'conectado';
  } else if (data.state === 'connecting') {
    status = 'reconectando';
  } else if (data.state === 'close' || data.status === 'close') {
    status = 'desconectado';
  }
  
  return {
    instanceId: extrairInstanceId(payload),
    type: 'connection',
    status: status,
    timestamp: Date.now()
  };
}

/**
 * Normaliza um evento de atualização de status de mensagem (messages.update)
 */
export function normalizarMensagemUpdate(payload) {
  const data = payload.data || payload;
  
  // Tentar extrair messageId de múltiplas fontes
  const messageId = data.key?.id || payload.messageId || payload.id || data.messageId || data.id || null;
  
  // Tentar extrair status de múltiplas fontes
  const status = payload.status || data.status || null;
  
  return {
    instanceId: extrairInstanceId(payload),
    type: 'message_update',
    messageId: messageId,
    status: status, // READ, DELIVERY_ACK, etc
    timestamp: Date.now()
  };
}

/**
 * Função principal de normalização - detecta tipo de evento e normaliza
 */
export function normalizarPayloadZAPI(payload) {
  const event = payload.event;
  const type = payload.type;
  const eventType = payload.eventType;
  const eventName = payload.eventName;
  
  console.log('[ZAPI-ADAPTER] Normalizando evento');
  console.log('[ZAPI-ADAPTER] Chaves disponíveis:', Object.keys(payload));
  console.log('[ZAPI-ADAPTER] event:', event, '| type:', type, '| eventType:', eventType, '| eventName:', eventName);
  
  try {
    // NORMALIZAÇÃO DE CAMPOS - case-insensitive com trim
    const rawType = String(type || event || eventType || eventName || 'unknown').trim();
    const normalizedType = rawType.toLowerCase();
    
    console.log('[ZAPI-ADAPTER] rawType:', rawType, '| normalizedType:', normalizedType);
    
    // 1. FORMATO Z-API DIRETO (PRIORIDADE MÁXIMA - RETURN IMEDIATO)
    if (normalizedType === 'receivedcallback') {
      console.log('[ZAPI-ADAPTER] Detectado formato Z-API direto (ReceivedCallback)');
      const normalizado = normalizarMensagemZAPI(payload);
      console.log('[ZAPI-ADAPTER] Payload normalizado (ReceivedCallback):', JSON.stringify(normalizado, null, 2));
      return normalizado;
    }
    
    // 2. FORMATO EVOLUTION API (APENAS SE NÃO FOR RECEIVEDCALLBACK)
    // Usar normalizedType em vez de apenas event para cobrir todos os aliases
    const tipoEvento = event || type || eventType || eventName;
    switch (tipoEvento) {
      case 'messages.upsert':
        console.log('[ZAPI-ADAPTER] Detectado messages.upsert');
        return normalizarMensagem(payload);
      
      case 'qrcode.updated':
        console.log('[ZAPI-ADAPTER] Detectado qrcode.updated');
        return normalizarQRCode(payload);
      
      case 'connection.update':
        console.log('[ZAPI-ADAPTER] Detectado connection.update');
        return normalizarConnection(payload);
      
      case 'messages.update':
        console.log('[ZAPI-ADAPTER] Detectado messages.update');
        return normalizarMensagemUpdate(payload);
      
      case 'send.message':
        console.log('[ZAPI-ADAPTER] Detectado send.message');
        return {
          instanceId: extrairInstanceId(payload),
          type: 'send_confirmation',
          timestamp: Date.now()
        };
      
      default:
        console.log('[ZAPI-ADAPTER] AVISO: Evento não mapeado:', tipoEvento);
        console.log('[ZAPI-ADAPTER] Payload completo:', JSON.stringify(payload, null, 2));
        return {
          instanceId: extrairInstanceId(payload),
          type: 'unknown',
          event: tipoEvento,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('[ZAPI-ADAPTER] ERRO ao normalizar:', error);
    console.error('[ZAPI-ADAPTER] Stack:', error.stack);
    throw error;
  }
}

/**
 * Valida se o payload normalizado é válido
 */
export function validarPayloadNormalizado(payloadNormalizado) {
  if (!payloadNormalizado) {
    return { valido: false, erro: 'Payload normalizado é null' };
  }
  
  if (!payloadNormalizado.instanceId) {
    return { valido: false, erro: 'instanceId não identificado no payload' };
  }
  
  if (payloadNormalizado.type === 'message') {
    if (!payloadNormalizado.from) {
      return { valido: false, erro: 'Número de origem não identificado' };
    }
    if (!payloadNormalizado.messageId) {
      return { valido: false, erro: 'messageId não identificado' };
    }
  }
  
  return { valido: true };
}