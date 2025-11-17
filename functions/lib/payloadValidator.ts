/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  VALIDADOR DE PAYLOAD PARA WEBHOOKS                          ║
 * ║  Valida tamanho, estrutura e segurança                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 65536; // 64KB para texto
const ALLOWED_MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/3gpp',
  'audio/ogg', 'audio/mpeg', 'audio/mp4',
  'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

class PayloadValidator {
  
  static validateSize(payloadString) {
    const sizeInBytes = new TextEncoder().encode(payloadString).length;
    
    if (sizeInBytes > MAX_PAYLOAD_SIZE) {
      return {
        valid: false,
        error: `Payload excede o tamanho máximo permitido (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB > ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB)`
      };
    }
    
    return { valid: true, sizeInBytes };
  }

  static validateStructure(payload, provider = 'z_api') {
    if (!payload || typeof payload !== 'object') {
      return {
        valid: false,
        error: 'Payload inválido: não é um objeto JSON'
      };
    }

    // Validações específicas por provider
    if (provider === 'z_api') {
      // Z-API deve ter pelo menos um destes campos
      if (!payload.event && !payload.momment && !payload.text && !payload.instanceId) {
        return {
          valid: false,
          error: 'Payload Z-API inválido: campos obrigatórios ausentes'
        };
      }
    } else if (provider === 'evolution_api') {
      // Evolution API validações
      if (!payload.event && !payload.data) {
        return {
          valid: false,
          error: 'Payload Evolution API inválido: campos obrigatórios ausentes'
        };
      }
    }

    return { valid: true };
  }

  static validateTextContent(text) {
    if (!text) return { valid: true };
    
    if (typeof text !== 'string') {
      return {
        valid: false,
        error: 'Conteúdo de texto deve ser uma string'
      };
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return {
        valid: false,
        error: `Texto excede o tamanho máximo (${text.length} > ${MAX_TEXT_LENGTH} caracteres)`
      };
    }

    return { valid: true };
  }

  static validateMediaType(mimeType) {
    if (!mimeType) return { valid: true };
    
    if (!ALLOWED_MEDIA_TYPES.includes(mimeType)) {
      return {
        valid: false,
        error: `Tipo de mídia não permitido: ${mimeType}`
      };
    }

    return { valid: true };
  }

  static sanitizePayload(payload) {
    // Remove campos potencialmente perigosos
    const sanitized = { ...payload };
    
    // Remove scripts e HTML potencialmente perigoso
    if (sanitized.text && typeof sanitized.text === 'string') {
      sanitized.text = sanitized.text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    }

    return sanitized;
  }

  static validateComplete(payloadString, payload, provider = 'z_api') {
    // 1. Validar tamanho
    const sizeCheck = this.validateSize(payloadString);
    if (!sizeCheck.valid) {
      return sizeCheck;
    }

    // 2. Validar estrutura
    const structureCheck = this.validateStructure(payload, provider);
    if (!structureCheck.valid) {
      return structureCheck;
    }

    // 3. Validar conteúdo de texto
    const textContent = payload.text?.message || payload.text || payload.data?.message?.conversation;
    const textCheck = this.validateTextContent(textContent);
    if (!textCheck.valid) {
      return textCheck;
    }

    // 4. Validar tipo de mídia se presente
    const mediaType = payload.data?.message?.imageMessage?.mimetype || 
                      payload.data?.message?.videoMessage?.mimetype ||
                      payload.data?.message?.audioMessage?.mimetype;
    const mediaCheck = this.validateMediaType(mediaType);
    if (!mediaCheck.valid) {
      return mediaCheck;
    }

    return {
      valid: true,
      sizeInBytes: sizeCheck.sizeInBytes,
      sanitizedPayload: this.sanitizePayload(payload)
    };
  }
}

export { PayloadValidator };