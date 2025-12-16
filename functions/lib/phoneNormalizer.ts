// ============================================================================
// NORMALIZADOR ÚNICO DE TELEFONE - E.164
// ============================================================================
// Usar em TODOS os pontos: webhooks, importação, busca, criação manual
// Garante formato único: +55XXXXXXXXXXX
// ============================================================================

/**
 * Normaliza telefone para formato E.164 canônico
 * @param {string} telefone - Telefone em qualquer formato
 * @param {string} defaultCountryCode - Código do país padrão (default: '55')
 * @returns {string|null} - Telefone normalizado (+55XXXXXXXXXXX) ou null se inválido
 */
export function normalizePhone(telefone, defaultCountryCode = '55') {
  if (!telefone) return null;
  
  // Remove tudo que não é número
  let apenasNumeros = String(telefone)
    .split('@')[0] // Remove @s.whatsapp.net
    .replace(/\D/g, ''); // Remove não-dígitos
  
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  
  // Remove leading zeros (alguns sistemas enviam 0XX...)
  apenasNumeros = apenasNumeros.replace(/^0+/, '');
  
  // Se já começa com código do país, mantém
  if (apenasNumeros.startsWith(defaultCountryCode)) {
    // Valida comprimento (BR: 13 dígitos com DDI)
    if (apenasNumeros.length === 12 || apenasNumeros.length === 13) {
      return '+' + apenasNumeros;
    }
    return null;
  }
  
  // Se não tem DDI, adiciona
  if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
    return '+' + defaultCountryCode + apenasNumeros;
  }
  
  // Caso especial: 12 dígitos sem DDI (improvável, mas cobre)
  if (apenasNumeros.length === 12) {
    return '+' + apenasNumeros;
  }
  
  return null;
}

/**
 * Compara se dois telefones são o mesmo (após normalização)
 */
export function isSamePhone(phone1, phone2) {
  const normalized1 = normalizePhone(phone1);
  const normalized2 = normalizePhone(phone2);
  
  if (!normalized1 || !normalized2) return false;
  return normalized1 === normalized2;
}

/**
 * Extrai informações do telefone normalizado
 */
export function parsePhone(telefone) {
  const normalized = normalizePhone(telefone);
  if (!normalized) return null;
  
  const digits = normalized.replace('+', '');
  
  // Brasil: +55 (DDD) NÚMERO
  if (digits.startsWith('55') && digits.length === 13) {
    return {
      e164: normalized,
      countryCode: '55',
      areaCode: digits.substring(2, 4),
      number: digits.substring(4),
      formatted: `+55 (${digits.substring(2, 4)}) ${digits.substring(4, 9)}-${digits.substring(9)}`
    };
  }
  
  if (digits.startsWith('55') && digits.length === 12) {
    return {
      e164: normalized,
      countryCode: '55',
      areaCode: digits.substring(2, 4),
      number: digits.substring(4),
      formatted: `+55 (${digits.substring(2, 4)}) ${digits.substring(4, 8)}-${digits.substring(8)}`
    };
  }
  
  // Genérico
  return {
    e164: normalized,
    countryCode: digits.substring(0, 2),
    number: digits.substring(2)
  };
}