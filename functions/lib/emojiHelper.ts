// ============================================================================
// EMOJI HELPER - Processamento Seguro de Emojis UTF-8
// ============================================================================
// Garante que emojis (e outros caracteres Unicode) sejam tratados corretamente
// em todo o pipeline: webhook → normalização → banco → frontend
// ============================================================================

/**
 * Debug de emojis: loga texto + codepoints para detectar corrupção
 */
export function emojiDebug(label, s) {
  if (typeof s !== 'string') {
    console.log(`[EMOJI_DEBUG] ${label} - NOT A STRING:`, typeof s, s);
    return;
  }
  
  const safe = s ?? "";
  const chars = Array.from(safe); // Conta caracteres Unicode corretamente
  const cps = chars.map(ch => "U+" + ch.codePointAt(0).toString(16).toUpperCase());
  
  console.log(`[EMOJI_DEBUG] ${label}`);
  console.log(`  • length(js)=${safe.length} chars(unicode)=${chars.length}`);
  console.log(`  • text="${safe}"`);
  console.log(`  • codepoints=${cps.slice(0, 20).join(" ")}${cps.length > 20 ? "..." : ""}`);
  
  // Alertar se há surrogate pairs malformados
  for (let i = 0; i < safe.length; i++) {
    const code = safe.charCodeAt(i);
    // High surrogate sem low surrogate seguinte
    if (code >= 0xD800 && code <= 0xDBFF) {
      if (i + 1 >= safe.length) {
        console.warn(`  ⚠️ Surrogate pair malformado na posição ${i}`);
      } else {
        const next = safe.charCodeAt(i + 1);
        if (next < 0xDC00 || next > 0xDFFF) {
          console.warn(`  ⚠️ Surrogate pair malformado na posição ${i}`);
        }
      }
    }
  }
}

/**
 * Truncamento seguro por caracteres Unicode (não por unidades UTF-16)
 * Evita cortar no meio de emoji/surrogate pairs
 */
export function truncateUnicodeSafe(s, maxChars) {
  if (!s || typeof s !== 'string') return '';
  
  const chars = Array.from(s); // Array de caracteres Unicode
  if (chars.length <= maxChars) return s;
  
  return chars.slice(0, maxChars).join('');
}

/**
 * Sanitização segura: remove APENAS caracteres de controle problemáticos
 * Preserva TODOS os emojis e caracteres Unicode normais
 */
export function sanitizeKeepingEmojis(s) {
  if (!s || typeof s !== 'string') return '';
  
  // Remove apenas:
  // - NULL bytes (\x00)
  // - Caracteres de controle C0 (exceto \n, \r, \t)
  // - Alguns caracteres de controle C1 problemáticos
  // 
  // NÃO remove emojis nem outros caracteres Unicode válidos
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/**
 * Verifica se string contém emojis
 */
export function hasEmojis(s) {
  if (!s || typeof s !== 'string') return false;
  
  // Ranges principais de emojis Unicode
  const emojiRanges = [
    /[\u{1F300}-\u{1F5FF}]/u,  // Símbolos e pictogramas diversos
    /[\u{1F600}-\u{1F64F}]/u,  // Emoticons
    /[\u{1F680}-\u{1F6FF}]/u,  // Símbolos de transporte e mapa
    /[\u{1F700}-\u{1F77F}]/u,  // Símbolos alquímicos
    /[\u{1F780}-\u{1F7FF}]/u,  // Símbolos geométricos estendidos
    /[\u{1F800}-\u{1F8FF}]/u,  // Setas suplementares-C
    /[\u{1F900}-\u{1F9FF}]/u,  // Símbolos e pictogramas suplementares
    /[\u{1FA00}-\u{1FA6F}]/u,  // Símbolos de xadrez
    /[\u{1FA70}-\u{1FAFF}]/u,  // Símbolos e pictogramas estendidos-A
    /[\u{2600}-\u{26FF}]/u,    // Símbolos diversos
    /[\u{2700}-\u{27BF}]/u,    // Dingbats
    /[\u{FE00}-\u{FE0F}]/u,    // Seletores de variação
    /[\u{1F1E6}-\u{1F1FF}]/u,  // Bandeiras regionais
  ];
  
  return emojiRanges.some(regex => regex.test(s));
}

/**
 * Conta emojis em uma string
 */
export function countEmojis(s) {
  if (!s || typeof s !== 'string') return 0;
  
  const chars = Array.from(s);
  let count = 0;
  
  for (const char of chars) {
    const code = char.codePointAt(0);
    // Verifica se está nos ranges de emoji
    if (
      (code >= 0x1F300 && code <= 0x1F9FF) ||
      (code >= 0x2600 && code <= 0x27BF) ||
      (code >= 0x1F1E6 && code <= 0x1F1FF)
    ) {
      count++;
    }
  }
  
  return count;
}

/**
 * Normaliza texto mantendo emojis intactos
 * Remove apenas espaços extras e caracteres de controle problemáticos
 */
export function normalizeTextKeepingEmojis(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .trim()
    // Remove caracteres de controle problemáticos (mas não emojis)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Normaliza espaços múltiplos para um único
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Valida se string está corrompida (surrogate pairs quebrados)
 */
export function isTextCorrupted(s) {
  if (!s || typeof s !== 'string') return false;
  
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    
    // High surrogate sem low surrogate
    if (code >= 0xD800 && code <= 0xDBFF) {
      if (i + 1 >= s.length) return true;
      const next = s.charCodeAt(i + 1);
      if (next < 0xDC00 || next > 0xDFFF) return true;
    }
    
    // Low surrogate sem high surrogate
    if (code >= 0xDC00 && code <= 0xDFFF) {
      if (i === 0) return true;
      const prev = s.charCodeAt(i - 1);
      if (prev < 0xD800 || prev > 0xDBFF) return true;
    }
  }
  
  return false;
}

/**
 * Extrai texto de forma segura do payload (genérico)
 */
export function extractTextSafe(payload, ...paths) {
  for (const path of paths) {
    try {
      const parts = path.split('.');
      let value = payload;
      
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          value = undefined;
          break;
        }
      }
      
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    } catch (e) {
      // Continua para próximo path
    }
  }
  
  return '';
}

/**
 * Pipeline completo: extrai, sanitiza, trunca (se necessário)
 */
export function processTextWithEmojis(text, maxLength = null) {
  if (!text || typeof text !== 'string') return '';
  
  // 1. Sanitiza (remove só controle problemático)
  let processed = sanitizeKeepingEmojis(text);
  
  // 2. Normaliza espaços
  processed = normalizeTextKeepingEmojis(processed);
  
  // 3. Trunca se necessário (de forma segura)
  if (maxLength && maxLength > 0) {
    processed = truncateUnicodeSafe(processed, maxLength);
  }
  
  // 4. Valida integridade
  if (isTextCorrupted(processed)) {
    console.warn('[EMOJI_HELPER] ⚠️ Texto corrompido detectado, usando fallback');
    // Remove caracteres problemáticos como último recurso
    processed = processed.replace(/[\uD800-\uDFFF]/g, '');
  }
  
  return processed;
}

/**
 * Estatísticas de texto (útil para debug)
 */
export function getTextStats(text) {
  if (!text || typeof text !== 'string') {
    return {
      isEmpty: true,
      length: 0,
      chars: 0,
      emojis: 0,
      hasEmojis: false,
      corrupted: false
    };
  }
  
  return {
    isEmpty: text.length === 0,
    length: text.length,
    chars: Array.from(text).length,
    emojis: countEmojis(text),
    hasEmojis: hasEmojis(text),
    corrupted: isTextCorrupted(text)
  };
}