// ============================================================================
// NORMALIZADOR DE TELEFONE - FONTE ÚNICA DA VERDADE
// ============================================================================
// Usado por contactManagerCentralized e webhooks
// Garante normalização consistente em todo o sistema
// ============================================================================

/**
 * Normaliza um número de telefone para o formato internacional brasileiro
 * @param {string} telefone - Número em qualquer formato
 * @returns {string|null} - Número normalizado (+5548999322400) ou null se inválido
 */
export function normalizePhone(telefone) {
  if (!telefone) return null;
  
  // Remover sufixos do WhatsApp (@c.us, @s.whatsapp.net, etc)
  let numeroLimpo = String(telefone).split('@')[0];
  
  // Remover tudo que não é número
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  
  // Validar comprimento mínimo
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
  
  // Retornar com + no início
  return '+' + apenasNumeros;
}