/**
 * Normaliza números de telefone para um formato padrão SEM +
 * Isso garante consistência entre diferentes provedores (Z-API, W-API)
 * 
 * Exemplo: +5548999999999 -> 5548999999999
 * Exemplo: 5548999999999@s.whatsapp.net -> 5548999999999
 * Exemplo: 5548999999999@lid -> 5548999999999
 * Exemplo: 48999999999 -> 5548999999999
 */
export function normalizarTelefone(telefone) {
  if (!telefone || telefone === null || telefone === undefined) return null;
  
  // Converter para string de forma segura
  const telefoneStr = String(telefone || '');
  if (!telefoneStr || telefoneStr.trim() === '') return null;
  
  // Remover sufixos do WhatsApp (@lid, @s.whatsapp.net, @g.us, etc.)
  let numeroLimpo = telefoneStr.split('@')[0];
  
  // Remover tudo que não é número (incluindo +)
  let apenasNumeros = (numeroLimpo || '').replace(/\D/g, '');
  
  // Se não tem números, retornar null
  if (!apenasNumeros) return null;
  
  // Se tem menos de 10 dígitos, é inválido
  if (apenasNumeros.length < 10) return null;
  
  // Se não começa com código do país, assumir Brasil (55)
  if (!apenasNumeros.startsWith('55')) {
    // Se tem 10 ou 11 dígitos, é um número brasileiro sem DDI
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  // ✅ NORMALIZAR CELULARES BRASILEIROS: adicionar 9 se faltar
  // Formato esperado: 55 + DDD(2) + 9 + número(8) = 13 dígitos
  // Se veio 55 + DDD(2) + número(8) = 12 dígitos, adiciona o 9
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const ddd = apenasNumeros.substring(2, 4);
    const numero = apenasNumeros.substring(4);
    // Se não começa com 9, adicionar (celulares brasileiros)
    if (!numero.startsWith('9')) {
      apenasNumeros = '55' + ddd + '9' + numero;
    }
  }
  
  // IMPORTANTE: Retornar SEM + para garantir consistência entre provedores
  return apenasNumeros;
}

/**
 * Compara dois números de telefone após normalização
 * Retorna true se forem o mesmo número
 */
export function compararTelefones(tel1, tel2) {
  const n1 = normalizarTelefone(tel1);
  const n2 = normalizarTelefone(tel2);
  
  if (!n1 || !n2) return false;
  return n1 === n2;
}

/**
 * Extrai o número de telefone de um JID do WhatsApp
 * @param {string} jid - JID no formato 5548999999999@s.whatsapp.net
 * @returns {string|null} - Número normalizado ou null se inválido
 */
export function extrairTelefoneDeJID(jid) {
  if (!jid) return null;
  return normalizarTelefone(jid);
}

/**
 * Formata telefone para exibição com +
 * @param {string} telefone - Telefone normalizado (apenas números)
 * @returns {string} - Telefone formatado com +
 */
export function formatarTelefoneExibicao(telefone) {
  if (!telefone || telefone === null || telefone === undefined) return '';
  const normalizado = normalizarTelefone(telefone);
  if (!normalizado) return String(telefone || '');
  return '+' + normalizado;
}