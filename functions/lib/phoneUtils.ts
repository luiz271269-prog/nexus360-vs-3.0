/**
 * Normaliza números de telefone para um formato padrão
 * Exemplo: 5548999999999 -> +5548999999999
 * Exemplo: 5548999999999@s.whatsapp.net -> +5548999999999
 * Exemplo: 5548999999999@lid -> +5548999999999
 * Exemplo: 48999999999 -> +5548999999999
 */
export function normalizarTelefone(telefone) {
  if (!telefone) return null;
  
  // Remover sufixos do WhatsApp (@lid, @s.whatsapp.net, @g.us, etc.)
  let numeroLimpo = String(telefone).split('@')[0];
  
  // Remover tudo que não é número
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  
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