// ==========================================
// Z-API ADAPTER v4.0 - ENTERPRISE GRADE
// ==========================================
// Extrai TODOS os metadados de mensagens Z-API
// Suporta: texto, mídia, áudio PTT, quoted, location, vCard
// ==========================================

/**
 * 🎯 Extrai dados estruturados de payloads Z-API
 * @param {Object} payload - Payload bruto da Z-API
 * @returns {Object} Dados normalizados
 */
export function normalizarPayloadZAPI(payload) {
  if (!payload) return { type: 'unknown' };

  const eventoTipo = String(payload.event || payload.type || '').toLowerCase();
  const instanceId = extrairInstanceId(payload);

  // ========================================
  // 1. STATUS DE MENSAGEM (lida, entregue)
  // ========================================
  if (eventoTipo.includes('messagestatuscallback') || (payload.status && payload.ids && !payload.phone)) {
    return {
      type: 'message_update',
      instanceId,
      messageId: payload.ids ? payload.ids[0] : null,
      status: payload.status, // READ, DELIVERED, SENT
      timestamp: payload.momment || Date.now()
    };
  }

  // ========================================
  // 2. MENSAGEM RECEBIDA (ReceivedCallback)
  // ========================================
  if (payload.telefone || payload.phone) {
    const telefoneRaw = payload.phone || payload.telefone;
    const numeroLimpo = normalizarTelefone(telefoneRaw);
    
    if (!numeroLimpo) {
      console.warn('[ADAPTER] Telefone inválido:', telefoneRaw);
      return { type: 'unknown', error: 'Telefone inválido' };
    }

    // 🔹 MENSAGEM DE TEXTO SIMPLES
    if (payload.text?.message) {
      return construirMensagemTexto(payload, numeroLimpo, instanceId);
    }

    // 🔹 IMAGEM
    if (payload.image) {
      return construirMensagemImagem(payload, numeroLimpo, instanceId);
    }

    // 🔹 VÍDEO
    if (payload.video) {
      return construirMensagemVideo(payload, numeroLimpo, instanceId);
    }

    // 🔹 ÁUDIO / PTT
    if (payload.audio) {
      return construirMensagemAudio(payload, numeroLimpo, instanceId);
    }

    // 🔹 DOCUMENTO
    if (payload.document || payload.documentMessage) {
      return construirMensagemDocumento(payload, numeroLimpo, instanceId);
    }

    // 🔹 LOCALIZAÇÃO
    if (payload.location || payload.lat) {
      return construirMensagemLocalizacao(payload, numeroLimpo, instanceId);
    }

    // 🔹 vCARD (Contato Compartilhado)
    if (payload.vcard || payload.contactMessage) {
      return construirMensagemVCard(payload, numeroLimpo, instanceId);
    }

    // 🔹 BOTÃO RESPONDIDO
    if (payload.buttonsResponseMessage) {
      return construirMensagemBotao(payload, numeroLimpo, instanceId);
    }

    // 🔹 STICKER
    if (payload.sticker || payload.stickerMessage) {
      return construirMensagemSticker(payload, numeroLimpo, instanceId);
    }

    // 🔹 FALLBACK - Mensagem Desconhecida
    console.warn('[ADAPTER] Tipo de mensagem não reconhecido:', Object.keys(payload));
    return {
      type: 'message',
      instanceId,
      messageId: payload.messageId,
      from: numeroLimpo,
      content: '[Mensagem não suportada]',
      mediaType: 'unknown',
      timestamp: payload.momment || Date.now(),
      isFromMe: payload.fromMe || false,
      pushName: payload.senderName || payload.chatName || null,
      rawPayload: payload
    };
  }

  // ========================================
  // 3. QR CODE UPDATE
  // ========================================
  if (eventoTipo.includes('qrcode')) {
    return {
      type: 'qrcode',
      instanceId,
      qrCodeUrl: payload.qrcode || payload.qr || null
    };
  }

  // ========================================
  // 4. CONNECTION STATUS
  // ========================================
  if (eventoTipo.includes('connection')) {
    return {
      type: 'connection',
      instanceId,
      status: payload.connected ? 'conectado' : 'desconectado'
    };
  }

  return { type: 'unknown' };
}

// ==========================================
// CONSTRUTORES DE MENSAGEM POR TIPO
// ==========================================

function construirMensagemTexto(payload, numeroLimpo, instanceId) {
  const conteudo = payload.text.message;
  
  // ✅ Detectar se é RESPOSTA a outra mensagem
  const quotedInfo = extrairMensagemRespondida(payload);
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: conteudo,
    mediaType: 'none',
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo, // ✨ NOVO - Mensagem respondida
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

function construirMensagemImagem(payload, numeroLimpo, instanceId) {
  const quotedInfo = extrairMensagemRespondida(payload);
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: payload.image.caption || '[Imagem]', // ✨ LEGENDA
    mediaType: 'image',
    mediaTempUrl: payload.image.imageUrl,
    mediaCaption: payload.image.caption || null,
    mediaMimeType: payload.image.mimetype || 'image/jpeg',
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo,
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

function construirMensagemVideo(payload, numeroLimpo, instanceId) {
  const quotedInfo = extrairMensagemRespondida(payload);
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: payload.video.caption || '[Vídeo]',
    mediaType: 'video',
    mediaTempUrl: payload.video.videoUrl,
    mediaCaption: payload.video.caption || null,
    mediaMimeType: payload.video.mimetype || 'video/mp4',
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo,
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

function construirMensagemAudio(payload, numeroLimpo, instanceId) {
  const quotedInfo = extrairMensagemRespondida(payload);
  
  // ✨ DIFERENCIA ÁUDIO PTT (voz) de ÁUDIO ENCAMINHADO
  const isPTT = payload.audio.ptt === true || payload.mediaType === 'ptt';
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: isPTT ? '[Áudio de voz]' : '[Áudio]',
    mediaType: isPTT ? 'ptt' : 'audio', // ✨ NOVO - Diferenciação
    mediaTempUrl: payload.audio.audioUrl,
    mediaMimeType: payload.audio.mimetype || 'audio/ogg',
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo,
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

function construirMensagemDocumento(payload, numeroLimpo, instanceId) {
  const quotedInfo = extrairMensagemRespondida(payload);
  const doc = payload.document || payload.documentMessage || {};
  
  // ✨ EXTRAI NOME DO ARQUIVO
  const fileName = doc.fileName || doc.title || 'documento.pdf';
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: `[Documento: ${fileName}]`, // ✨ NOME DO ARQUIVO
    mediaType: 'document',
    mediaTempUrl: doc.documentUrl || doc.url,
    mediaCaption: doc.caption || null,
    mediaFileName: fileName, // ✨ NOVO
    mediaMimeType: doc.mimetype || 'application/pdf',
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo,
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

function construirMensagemLocalizacao(payload, numeroLimpo, instanceId) {
  const quotedInfo = extrairMensagemRespondida(payload);
  const loc = payload.location || {};
  
  const lat = loc.latitude || payload.lat || loc.degreesLatitude;
  const lng = loc.longitude || payload.lng || loc.degreesLongitude;
  const address = loc.address || loc.name || 'Localização';
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: `📍 ${address}`,
    mediaType: 'location',
    location: {
      latitude: lat,
      longitude: lng,
      address: address,
      googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}` // ✨ LINK DIRETO
    },
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo,
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

function construirMensagemVCard(payload, numeroLimpo, instanceId) {
  const quotedInfo = extrairMensagemRespondida(payload);
  const vcard = payload.vcard || payload.contactMessage?.vcard || '';
  
  // ✨ EXTRAI NOME E TELEFONE DO vCARD
  const nomeMatch = vcard.match(/FN:(.*)/);
  const telefoneMatch = vcard.match(/TEL.*:(.*)/);
  
  const nomeContato = nomeMatch ? nomeMatch[1].trim() : 'Contato';
  const telefoneContato = telefoneMatch ? telefoneMatch[1].trim() : '';
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: `👤 Contato: ${nomeContato}`,
    mediaType: 'vcard',
    vcard: {
      name: nomeContato,
      phone: telefoneContato,
      rawVCard: vcard
    },
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo,
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

function construirMensagemBotao(payload, numeroLimpo, instanceId) {
  const quotedInfo = extrairMensagemRespondida(payload);
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: payload.buttonsResponseMessage?.message || '[Botão selecionado]',
    mediaType: 'button_response',
    buttonId: payload.buttonsResponseMessage?.selectedButtonId,
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo,
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

function construirMensagemSticker(payload, numeroLimpo, instanceId) {
  const quotedInfo = extrairMensagemRespondida(payload);
  const sticker = payload.sticker || payload.stickerMessage || {};
  
  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: '[Figurinha]',
    mediaType: 'sticker',
    mediaTempUrl: sticker.url || sticker.stickerUrl,
    timestamp: payload.momment || Date.now(),
    isFromMe: payload.fromMe || false,
    pushName: payload.senderName || payload.chatName || null,
    quotedMessage: quotedInfo,
    groupId: payload.chatId?.includes('@g.us') ? payload.chatId : null
  };
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * ✨ EXTRAI MENSAGEM RESPONDIDA (Quoted Message)
 * Quando o cliente responde a uma mensagem anterior
 */
function extrairMensagemRespondida(payload) {
  const contextInfo = payload.contextInfo || 
                      payload.text?.contextInfo || 
                      payload.image?.contextInfo ||
                      payload.video?.contextInfo;
  
  if (!contextInfo?.quotedMessage) return null;
  
  const quoted = contextInfo.quotedMessage;
  let quotedContent = '';
  let quotedType = 'text';
  
  if (quoted.conversation) {
    quotedContent = quoted.conversation;
  } else if (quoted.extendedTextMessage) {
    quotedContent = quoted.extendedTextMessage.text;
  } else if (quoted.imageMessage) {
    quotedContent = quoted.imageMessage.caption || '[Imagem]';
    quotedType = 'image';
  } else if (quoted.videoMessage) {
    quotedContent = quoted.videoMessage.caption || '[Vídeo]';
    quotedType = 'video';
  } else if (quoted.documentMessage) {
    quotedContent = `[Documento: ${quoted.documentMessage.title || 'arquivo'}]`;
    quotedType = 'document';
  }
  
  return {
    content: quotedContent,
    type: quotedType,
    messageId: contextInfo.stanzaId, // ID da mensagem original
    participant: contextInfo.participant // Quem enviou a mensagem original
  };
}

function extrairInstanceId(payload) {
  return payload.instance || 
         payload.instanceId || 
         payload.instance_id || 
         payload.instance_id_provider || 
         payload.instanceName || 
         'unknown';
}

function normalizarTelefone(telefone) {
  if (!telefone) return null;
  
  // Remove sufixos WhatsApp
  let limpo = String(telefone).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '');
  
  // Remove caracteres não numéricos
  limpo = limpo.replace(/\D/g, '');
  
  if (limpo.length < 10) return null;
  
  // Adiciona código Brasil se necessário
  if (limpo.length === 11 && !limpo.startsWith('55')) {
    limpo = '55' + limpo;
  } else if (limpo.length === 10 && !limpo.startsWith('55')) {
    limpo = '55' + limpo;
  }
  
  return '+' + limpo;
}

/**
 * ✅ VALIDA PAYLOAD NORMALIZADO
 */
export function validarPayloadNormalizado(payload) {
  if (!payload) return { valido: false, erro: 'Payload nulo' };
  if (payload.type === 'unknown') return { valido: false, erro: 'Tipo desconhecido' };
  if (!payload.instanceId) return { valido: false, erro: 'Instance ID ausente' };
  return { valido: true };
}