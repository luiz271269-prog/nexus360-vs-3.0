/**
 * ═══════════════════════════════════════════════════════════
 * VALIDADOR DE PAYLOAD Z-API
 * ═══════════════════════════════════════════════════════════
 * 
 * Valida e normaliza payloads da Z-API
 */

export function validarPayloadZAPI(payload) {
  const erros = [];
  
  // Verificar estrutura básica
  if (!payload || typeof payload !== 'object') {
    erros.push('Payload inválido ou não é um objeto');
    return { valido: false, erros };
  }
  
  // Identificar tipo de evento
  const tipo = payload.tipo || payload.type;
  
  if (!tipo) {
    erros.push('Campo "tipo" ou "type" ausente');
  }
  
  // Validações específicas por tipo
  switch (tipo) {
    case 'ReceivedCallback':
      if (!payload.phone) {
        erros.push('Campo "phone" obrigatório para ReceivedCallback');
      }
      if (!payload.texto?.mensagem && !payload.image && !payload.audio && !payload.document) {
        erros.push('Nenhum conteúdo encontrado (texto, imagem, áudio ou documento)');
      }
      break;
      
    case 'MessageStatusCallback':
      if (!payload.ids || payload.ids.length === 0) {
        erros.push('Campo "ids" obrigatório para MessageStatusCallback');
      }
      if (!payload.status) {
        erros.push('Campo "status" obrigatório para MessageStatusCallback');
      }
      break;
      
    case 'PresenceChatCallback':
      if (!payload.phone) {
        erros.push('Campo "phone" obrigatório para PresenceChatCallback');
      }
      break;
  }
  
  return {
    valido: erros.length === 0,
    erros,
    tipo
  };
}

export function normalizarTelefone(telefone) {
  if (!telefone) return null;
  
  // Remover caracteres não numéricos
  let numeroLimpo = telefone.replace(/\D/g, '');
  
  // Se não tiver código do país, adicionar +55 (Brasil)
  if (numeroLimpo.length === 11 || numeroLimpo.length === 10) {
    numeroLimpo = '55' + numeroLimpo;
  }
  
  // Adicionar + no início se não tiver
  if (!numeroLimpo.startsWith('+')) {
    numeroLimpo = '+' + numeroLimpo;
  }
  
  return numeroLimpo;
}

export function extrairNomeRemetente(payload) {
  return payload.senderName || 
         payload.chatName || 
         payload.pushName || 
         payload.notifyName || 
         null;
}

export function extrairTimestamp(payload) {
  const moment = payload.momment || payload.timestamp || payload.messageTimestamp;
  
  if (!moment) {
    return new Date().toISOString();
  }
  
  // Se for timestamp em microssegundos (Z-API usa isso)
  if (moment > 10000000000000) {
    return new Date(Math.floor(moment / 1000)).toISOString();
  }
  
  // Se for milissegundos
  if (moment > 10000000000) {
    return new Date(moment).toISOString();
  }
  
  // Se for segundos
  return new Date(moment * 1000).toISOString();
}