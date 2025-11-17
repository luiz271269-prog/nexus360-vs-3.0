/**
 * Normaliza números de telefone para um formato padrão
 * Exemplo: 5548999999999 -> +5548999999999
 * Exemplo: 5548999999999@s.whatsapp.net -> +5548999999999
 * Exemplo: 48999999999 -> +5548999999999
 */
export function normalizarTelefone(telefone) {
  if (!telefone) return null;
  
  // Remover tudo que não é número
  let apenasNumeros = telefone.replace(/\D/g, '');
  
  // Se não tem números, retornar null
  if (!apenasNumeros) return null;
  
  // Se tem menos de 10 dígitos, é inválido
  if (apenasNumeros.length < 10) return null;
  
  // Se não começa com código do país, assumir Brasil (+55)
  if (!apenasNumeros.startsWith('55')) {
    // Se tem 10 ou 11 dígitos, é um número brasileiro sem DDI
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  // Retornar no formato +DDI
  return '+' + apenasNumeros;
}

/**
 * Compara dois números de telefone para verificar se são iguais
 * (ignora formatação, espaços, etc.)
 */
export function telefonesIguais(tel1, tel2) {
  const norm1 = normalizarTelefone(tel1);
  const norm2 = normalizarTelefone(tel2);
  
  if (!norm1 || !norm2) return false;
  
  return norm1 === norm2;
}

/**
 * Extrai número de telefone de um JID do WhatsApp
 * Exemplo: 5548999999999@s.whatsapp.net -> +5548999999999
 */
export function extrairTelefoneDeJID(jid) {
  if (!jid) return null;
  
  // Remover sufixos do WhatsApp (@s.whatsapp.net, @g.us, etc.)
  const numeroLimpo = jid.split('@')[0];
  
  return normalizarTelefone(numeroLimpo);
}