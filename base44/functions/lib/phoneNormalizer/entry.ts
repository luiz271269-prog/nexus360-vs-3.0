// ============================================================================
// NORMALIZADOR ÚNICO DE TELEFONE - FONTE DE VERDADE
// ============================================================================
// REGRA: Esta é a ÚNICA função de normalização de telefone em todo o sistema.
// Todos os outros arquivos devem importar DAQUI.
// Não criar cópias inline em webhooks, funções ou componentes.
// ============================================================================

/**
 * Normaliza telefone para formato E.164 canônico: +55XXXXXXXXXXX
 * 
 * Regras:
 * - Remove @s.whatsapp.net, @lid, etc.
 * - Adiciona DDI 55 se não tiver
 * - Celulares brasileiros (12 dígitos com 55): adiciona dígito 9 se começar com 6,7,8,9
 * - Telefones fixos (começa com 2,3,4,5): NÃO adiciona o 9
 * - Retorna sempre COM + (ex: +5548999322400)
 * 
 * @param {string} telefone - Telefone em qualquer formato
 * @returns {string|null} - Telefone normalizado (+55XXXXXXXXXXX) ou null se inválido
 */
export function normalizarTelefone(telefone) {
  if (!telefone) return null;

  // Remove sufixos do WhatsApp (@s.whatsapp.net, @lid, @g.us, etc.)
  let apenasNumeros = String(telefone).split('@')[0].replace(/\D/g, '');

  if (!apenasNumeros || apenasNumeros.length < 10) return null;

  // Remove zeros à esquerda
  apenasNumeros = apenasNumeros.replace(/^0+/, '');

  // Adicionar DDI Brasil se não tiver
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }

  // Celular brasileiro com 12 dígitos (55 + DDD(2) + número(8)):
  // Verificar se é celular e adicionar o dígito 9
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const primeiroDigitoNumero = apenasNumeros[4]; // após 55 + DDD(2)
    if (['6', '7', '8', '9'].includes(primeiroDigitoNumero)) {
      // É celular - adiciona 9
      apenasNumeros = apenasNumeros.substring(0, 4) + '9' + apenasNumeros.substring(4);
    }
    // Se começa com 2,3,4,5 é telefone fixo - não adiciona 9
  }

  return '+' + apenasNumeros;
}

/**
 * Gera todas as variações possíveis de um telefone normalizado
 * para busca tolerante a erros de formato no banco de dados
 * 
 * @param {string} telefoneNormalizado - Telefone já normalizado (+55...)
 * @returns {string[]} - Array de variações únicas
 */
export function gerarVariacoesTelefone(telefoneNormalizado) {
  if (!telefoneNormalizado) return [];
  const base = telefoneNormalizado.replace(/\D/g, '');
  const variacoes = new Set([telefoneNormalizado, base]);

  if (base.startsWith('55')) {
    // 13 dígitos (com 9): adicionar versão sem o 9
    if (base.length === 13) {
      const sem9 = base.substring(0, 4) + base.substring(5);
      variacoes.add('+' + sem9);
      variacoes.add(sem9);
    }
    // 12 dígitos (sem 9): adicionar versão com o 9
    if (base.length === 12) {
      const com9 = base.substring(0, 4) + '9' + base.substring(4);
      variacoes.add('+' + com9);
      variacoes.add(com9);
    }
    // Variação explícita com +55
    variacoes.add('+55' + base.substring(2));
  }

  return [...variacoes];
}

/**
 * Compara dois telefones após normalização
 */
export function isSamePhone(phone1, phone2) {
  const n1 = normalizarTelefone(phone1);
  const n2 = normalizarTelefone(phone2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}

/**
 * Formata para exibição (garante o +)
 */
export function formatarTelefoneExibicao(telefone) {
  const normalizado = normalizarTelefone(telefone);
  return normalizado || String(telefone || '');
}