/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MAPEADOR CENTRALIZADO DE PROVIDERS                          ║
 * ║  Normaliza payloads de diferentes provedores                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

/**
 * Detecta o provider baseado na estrutura do payload
 */
export function detectProvider(payload, headers) {
  // Evolution API geralmente tem campo 'event' e 'data'
  if (payload.event && payload.data && payload.data.key) {
    return 'evolution_api';
  }

  // Z-API tem campos como 'momment', 'text', 'instanceId'
  if (payload.momment || (payload.text && payload.instanceId)) {
    return 'z_api';
  }

  // Verificar pelo header
  const userAgent = headers.get('user-agent') || '';
  if (userAgent.includes('Evolution')) {
    return 'evolution_api';
  }

  // Default para Z-API se tiver campos básicos
  if (payload.text || payload.phone) {
    return 'z_api';
  }

  return 'unknown';
}

/**
 * Normaliza mensagem de qualquer provider para formato padrão
 */
export function normalizarMensagem(payload, provider) {
  const normalized = {
    phone: null,
    text: null,
    mediaUrl: null,
    mediaType: 'none',
    messageId: null,
    timestamp: new Date().toISOString(),
    senderName: null,
    isFromMe: false,
    raw: payload
  };

  try {
    if (provider === 'z_api') {
      normalized.phone = extrairTelefoneZAPI(payload);
      normalized.text = extrairTextoZAPI(payload);
      normalized.mediaUrl = extrairMediaZAPI(payload);
      normalized.mediaType = detectarTipoMediaZAPI(payload);
      normalized.messageId = payload.messageId || payload.text?.messageId;
      normalized.timestamp = payload.momment || payload.timestamp || normalized.timestamp;
      normalized.senderName = payload.senderName || payload.notifyName;
      normalized.isFromMe = payload.isFromMe || false;
    } 
    else if (provider === 'evolution_api') {
      const data = payload.data || {};
      const key = data.key || {};
      const message = data.message || {};

      normalized.phone = key.remoteJid?.replace('@s.whatsapp.net', '');
      normalized.text = extrairTextoEvolution(message);
      normalized.mediaUrl = extrairMediaEvolution(message);
      normalized.mediaType = detectarTipoMediaEvolution(message);
      normalized.messageId = key.id;
      normalized.timestamp = data.messageTimestamp ? 
        new Date(parseInt(data.messageTimestamp) * 1000).toISOString() : 
        normalized.timestamp;
      normalized.senderName = data.pushName || key.pushName;
      normalized.isFromMe = key.fromMe || false;
    }

    // Sanitizar campos de texto
    if (normalized.text) {
      normalized.text = sanitizarTexto(normalized.text);
    }
    if (normalized.senderName) {
      normalized.senderName = sanitizarTexto(normalized.senderName);
    }

    // Validar telefone
    if (normalized.phone) {
      normalized.phone = normalizarTelefone(normalized.phone);
    }

  } catch (error) {
    console.error('[MAPPER] Erro ao normalizar mensagem:', error);
  }

  return normalized;
}

/**
 * Extrai telefone de payload Z-API
 */
function extrairTelefoneZAPI(payload) {
  return payload.phone || 
         payload.chatId?.replace('@s.whatsapp.net', '').replace('@c.us', '') ||
         payload.remoteJid?.replace('@s.whatsapp.net', '').replace('@c.us', '') ||
         null;
}

/**
 * Extrai texto de payload Z-API
 */
function extrairTextoZAPI(payload) {
  if (typeof payload.text === 'string') {
    return payload.text;
  }
  
  if (payload.text?.message) {
    return payload.text.message;
  }

  if (payload.body) {
    return payload.body;
  }

  if (payload.content) {
    return payload.content;
  }

  return null;
}

/**
 * Extrai mídia de payload Z-API
 */
function extrairMediaZAPI(payload) {
  return payload.image?.imageUrl ||
         payload.video?.videoUrl ||
         payload.audio?.audioUrl ||
         payload.document?.documentUrl ||
         null;
}

/**
 * Detecta tipo de mídia em payload Z-API
 */
function detectarTipoMediaZAPI(payload) {
  if (payload.image) return 'image';
  if (payload.video) return 'video';
  if (payload.audio) return 'audio';
  if (payload.document) return 'document';
  if (payload.sticker) return 'sticker';
  if (payload.location) return 'location';
  return 'none';
}

/**
 * Extrai texto de mensagem Evolution API
 */
function extrairTextoEvolution(message) {
  return message.conversation ||
         message.extendedTextMessage?.text ||
         message.imageMessage?.caption ||
         message.videoMessage?.caption ||
         message.documentMessage?.caption ||
         null;
}

/**
 * Extrai mídia de mensagem Evolution API
 */
function extrairMediaEvolution(message) {
  return message.imageMessage?.url ||
         message.videoMessage?.url ||
         message.audioMessage?.url ||
         message.documentMessage?.url ||
         null;
}

/**
 * Detecta tipo de mídia em mensagem Evolution API
 */
function detectarTipoMediaEvolution(message) {
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.documentMessage) return 'document';
  if (message.stickerMessage) return 'sticker';
  if (message.locationMessage) return 'location';
  return 'none';
}

/**
 * Sanitiza texto removendo HTML/scripts perigosos
 */
function sanitizarTexto(texto) {
  if (!texto || typeof texto !== 'string') {
    return '';
  }

  return texto
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim()
    .substring(0, 65536); // Limite de 64KB
}

/**
 * Normaliza telefone para formato internacional
 */
function normalizarTelefone(phone) {
  if (!phone) return null;

  // Remover caracteres especiais
  let cleanPhone = phone.replace(/[^\d+]/g, '');

  // Garantir que comece com +
  if (!cleanPhone.startsWith('+')) {
    cleanPhone = '+' + cleanPhone;
  }

  // Validar tamanho (10-15 dígitos após o +)
  if (cleanPhone.length < 11 || cleanPhone.length > 16) {
    console.warn('[MAPPER] Telefone com tamanho inválido:', cleanPhone);
  }

  return cleanPhone;
}

/**
 * Extrai metadados úteis para análise
 */
export function extrairMetadados(payload, provider) {
  const metadata = {
    provider,
    timestamp: new Date().toISOString(),
    eventType: null,
    hasMedia: false,
    mediaType: 'none',
    isGroup: false,
    isFromMe: false
  };

  try {
    if (provider === 'z_api') {
      metadata.eventType = payload.event || 'message';
      metadata.hasMedia = !!(payload.image || payload.video || payload.audio || payload.document);
      metadata.isGroup = payload.isGroup || false;
      metadata.isFromMe = payload.isFromMe || false;
    } 
    else if (provider === 'evolution_api') {
      metadata.eventType = payload.event;
      const message = payload.data?.message || {};
      metadata.hasMedia = !!(message.imageMessage || message.videoMessage || message.audioMessage || message.documentMessage);
      metadata.isGroup = payload.data?.key?.remoteJid?.includes('@g.us') || false;
      metadata.isFromMe = payload.data?.key?.fromMe || false;
    }

  } catch (error) {
    console.error('[MAPPER] Erro ao extrair metadados:', error);
  }

  return metadata;
}