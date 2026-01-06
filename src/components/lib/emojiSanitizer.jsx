/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧹 SANITIZADOR DE EMOJIS - Previne SyntaxError em JSX
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Substitui emojis problemáticos por alternativas seguras:
 * - ⭐ (U+2B50) → ★ (U+2605) 
 * - 💬 → Ícone de chat
 * - Outros caracteres especiais Unicode
 */

// Mapeamento de emojis problemáticos → alternativas seguras
const EMOJI_SAFE_MAP = {
  '⭐': '★',
  '✨': '*',
  '❤️': '♥',
  '❤': '♥',
  // Adicionar mais conforme necessário
};

/**
 * Sanitiza string removendo emojis problemáticos
 * @param {string} text - Texto para limpar
 * @returns {string} - Texto sanitizado
 */
export function sanitizeEmojis(text) {
  if (!text || typeof text !== 'string') return text;
  
  let sanitized = text;
  
  // Substituir emojis do mapa
  for (const [unsafe, safe] of Object.entries(EMOJI_SAFE_MAP)) {
    sanitized = sanitized.replace(new RegExp(unsafe, 'g'), safe);
  }
  
  return sanitized;
}

/**
 * Remove TODOS os emojis de uma string
 * @param {string} text - Texto para limpar
 * @returns {string} - Texto sem emojis
 */
export function removeAllEmojis(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Regex para remover a maioria dos emojis Unicode
  return text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2B55}]/gu,
    ''
  ).trim();
}

/**
 * Valida se uma string contém emojis problemáticos
 * @param {string} text - Texto para validar
 * @returns {boolean} - true se contém emojis problemáticos
 */
export function hasUnsafeEmojis(text) {
  if (!text || typeof text !== 'string') return false;
  
  for (const unsafe of Object.keys(EMOJI_SAFE_MAP)) {
    if (text.includes(unsafe)) return true;
  }
  
  return false;
}

/**
 * Trunca texto de forma segura sem quebrar emojis
 * @param {string} text - Texto para truncar
 * @param {number} maxLength - Tamanho máximo
 * @returns {string} - Texto truncado
 */
export function safeTruncate(text, maxLength = 100) {
  if (!text || typeof text !== 'string') return text;
  if (text.length <= maxLength) return text;
  
  // Converter em array de caracteres Unicode completos
  const chars = Array.from(text);
  
  if (chars.length <= maxLength) return text;
  
  return chars.slice(0, maxLength).join('') + '...';
}