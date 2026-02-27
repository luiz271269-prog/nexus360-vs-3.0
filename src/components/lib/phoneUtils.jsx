// ============================================================================
// PHONE UTILS - FRONTEND
// ============================================================================
// Fonte de verdade: functions/lib/phoneNormalizer.js (backend)
// Este arquivo expõe as mesmas regras para uso no frontend (React).
// ============================================================================

/**
 * Normaliza telefone para formato E.164: +55XXXXXXXXXXX
 * Celulares com 12 dígitos ganham dígito 9. Fixos não.
 */
export function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let apenasNumeros = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  apenasNumeros = apenasNumeros.replace(/^0+/, '');
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  // Celular BR com 12 dígitos → adiciona 9 se começa com 6,7,8,9
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    if (['6','7','8','9'].includes(apenasNumeros[4])) {
      apenasNumeros = apenasNumeros.substring(0, 4) + '9' + apenasNumeros.substring(4);
    }
  }
  return '+' + apenasNumeros;
}

/** Compara dois telefones após normalização */
export function compararTelefones(tel1, tel2) {
  const n1 = normalizarTelefone(tel1);
  const n2 = normalizarTelefone(tel2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}

/** Extrai número de JID do WhatsApp */
export function extrairTelefoneDeJID(jid) {
  return normalizarTelefone(jid);
}

/** Formata para exibição (garante +) */
export function formatarTelefoneExibicao(telefone) {
  const normalizado = normalizarTelefone(telefone);
  return normalizado || String(telefone || '');
}