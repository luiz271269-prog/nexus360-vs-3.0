/**
 * Z-API ADAPTER - NORMALIZACAO DE PAYLOADS
 * Versao: 1.1 - Deteccao Robusta de ReceivedCallback
 * 
 * Transforma payloads da Z-API em formato padronizado interno
 */

export function extrairInstanceId(payload) {
  if (payload.instance) return payload.instance;
  if (payload.instanceId) return payload.instanceId;
  if (payload.instance_id) return payload.instance_id;
  if (payload.data?.instance) return payload.data.instance;
  if (payload.data?.instanceId) return payload.data.instanceId;
  return null;
}

/**
 * Normaliza mensagem no formato Z-API direto (ReceivedCallback)
 */
export function normalizarMensagemZAPI(payload) {
  console.log('[ZAPI-ADAPTER] Normalizando ReceivedCallback');
  
  const telefone = payload.telefone || payload.phone;
  let numeroFormatado = telefone;
  if (telefone && !telefone.startsWith('+')) {
    numeroFormatado = `+${telefone}`;
  }
  
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
  }
  
  return {
    instanceId: payload.instanceId || payload.instance || payload.instance_id,
    from: numeroFormatado,
    to: payload.connectedPhone ? `+${payload.connectedPhone}` : null,
    messageId: payload.messageId || payload.id || `MSG_${Date.now()}`,
    timestamp: payload.momment || payload.momento || Date.now(),
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
  
  if (messages.length === 0) return null;
  
  const mensagem = messages[0];
  const key = mensagem.key || {};
  const message = mensagem.message || {};
  
  const remoteJid = key.remoteJid || '';
  const numero = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  const numeroFormatado = numero.startsWith('+') ? numero : `+${numero}`;
  
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
    conteudo = message.videoMessage.caption || '[Video]';
    mediaType = 'video';
    mediaTempUrl = message.videoMessage.url;
    mediaCaption = message.videoMessage.caption;
  } else if (message.audioMessage) {
    conteudo = '[Audio]';
    mediaType = 'audio';
    mediaTempUrl = message.audioMessage.url;
  } else if (message.documentMessage) {
    conteudo = message.documentMessage.fileName || '[Documento]';
    mediaType = 'document';
    mediaTempUrl = message.documentMessage.url;
  }
  
  const timestamp = mensagem.messageTimestamp 
    ? (typeof mensagem.messageTimestamp === 'number' 
        ? (mensagem.messageTimestamp < 1e12 ? mensagem.messageTimestamp * 1000 : mensagem.messageTimestamp)
        : parseInt(mensagem.messageTimestamp) * 1000)
    : Date.now();
  
  return {
    instanceId: extrairInstanceId(payload),
    from: numeroFormatado,
    to: null,
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

export function normalizarQRCode(payload) {
  const data = payload.data || payload;
  return {
    instanceId: extrairInstanceId(payload),
    type: 'qrcode',
    qrCodeUrl: data.qrcode || data.qr || null,
    timestamp: Date.now()
  };
}

export function normalizarConnection(payload) {
  const data = payload.data || payload;
  let status = 'desconectado';
  if (data.state === 'open' || data.status === 'open') status = 'conectado';
  else if (data.state === 'connecting') status = 'reconectando';
  else if (data.state === 'close' || data.status === 'close') status = 'desconectado';
  
  return {
    instanceId: extrairInstanceId(payload),
    type: 'connection',
    status: status,
    timestamp: Date.now()
  };
}

export function normalizarMensagemUpdate(payload) {
  const data = payload.data || payload;
  const messageId = data.key?.id || payload.messageId || payload.id || data.messageId || data.id || null;
  const status = payload.status || data.status || null;
  
  return {
    instanceId: extrairInstanceId(payload),
    type: 'message_update',
    messageId: messageId,
    status: status,
    timestamp: Date.now()
  };
}

/**
 * FUNCAO PRINCIPAL - Detecta e normaliza qualquer tipo de payload
 */
export function normalizarPayloadZAPI(payload) {
  console.log('[ZAPI-ADAPTER] Iniciando normalizacao');
  console.log('[ZAPI-ADAPTER] Chaves payload:', Object.keys(payload).join(', '));
  
  try {
    // Extrair todos os possiveis campos de tipo de evento
    const event = payload.event;
    const type = payload.type;
    const eventType = payload.eventType;
    const eventName = payload.eventName;
    
    // Normalizar para lowercase
    const rawType = String(type || event || eventType || eventName || '').trim();
    const normalizedType = rawType.toLowerCase();
    
    console.log('[ZAPI-ADAPTER] Raw Type:', rawType);
    console.log('[ZAPI-ADAPTER] Normalized Type:', normalizedType);
    
    // ================================================================
    // DETECCAO PRIORIZADA: ReceivedCallback (Z-API)
    // ================================================================
    if (normalizedType === 'receivedcallback' || 
        normalizedType === 'received_callback' ||
        normalizedType === 'message_received' ||
        normalizedType.includes('received') ||
        normalizedType.includes('callback')) {
      console.log('[ZAPI-ADAPTER] DETECTADO: ReceivedCallback (Z-API)');
      const result = normalizarMensagemZAPI(payload);
      console.log('[ZAPI-ADAPTER] Resultado:', JSON.stringify(result, null, 2));
      return result;
    }
    
    // ================================================================
    // DETECCAO POR ESTRUTURA: Se tem telefone + messageId = Z-API
    // ================================================================
    if ((payload.telefone || payload.phone) && payload.messageId) {
      console.log('[ZAPI-ADAPTER] DETECTADO por estrutura: Mensagem Z-API');
      const result = normalizarMensagemZAPI(payload);
      console.log('[ZAPI-ADAPTER] Resultado:', JSON.stringify(result, null, 2));
      return result;
    }
    
    // ================================================================
    // FORMATO EVOLUTION API
    // ================================================================
    const tipoEvento = event || type || eventType || eventName;
    
    switch (tipoEvento) {
      case 'messages.upsert':
        console.log('[ZAPI-ADAPTER] DETECTADO: messages.upsert');
        return normalizarMensagem(payload);
      
      case 'qrcode.updated':
        console.log('[ZAPI-ADAPTER] DETECTADO: qrcode.updated');
        return normalizarQRCode(payload);
      
      case 'connection.update':
        console.log('[ZAPI-ADAPTER] DETECTADO: connection.update');
        return normalizarConnection(payload);
      
      case 'messages.update':
        console.log('[ZAPI-ADAPTER] DETECTADO: messages.update');
        return normalizarMensagemUpdate(payload);
      
      case 'send.message':
        console.log('[ZAPI-ADAPTER] DETECTADO: send.message');
        return {
          instanceId: extrairInstanceId(payload),
          type: 'send_confirmation',
          timestamp: Date.now()
        };
      
      default:
        console.log('[ZAPI-ADAPTER] AVISO: Evento nao mapeado');
        console.log('[ZAPI-ADAPTER] Tipo:', tipoEvento);
        console.log('[ZAPI-ADAPTER] Payload:', JSON.stringify(payload, null, 2));
        return {
          instanceId: extrairInstanceId(payload),
          type: 'unknown',
          event: tipoEvento,
          timestamp: Date.now()
        };
    }
  } catch (error) {
    console.error('[ZAPI-ADAPTER] ERRO:', error);
    console.error('[ZAPI-ADAPTER] Stack:', error.stack);
    throw error;
  }
}

export function validarPayloadNormalizado(payloadNormalizado) {
  if (!payloadNormalizado) {
    return { valido: false, erro: 'Payload normalizado e null' };
  }
  
  if (!payloadNormalizado.instanceId) {
    return { valido: false, erro: 'instanceId nao identificado' };
  }
  
  if (payloadNormalizado.type === 'message') {
    if (!payloadNormalizado.from) {
      return { valido: false, erro: 'Numero de origem nao identificado' };
    }
    if (!payloadNormalizado.messageId) {
      return { valido: false, erro: 'messageId nao identificado' };
    }
  }
  
  return { valido: true };
}