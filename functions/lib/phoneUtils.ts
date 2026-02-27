// ============================================================================
// ESTE ARQUIVO É UM REDIRECT - A FONTE DE VERDADE É phoneNormalizer.js
// ============================================================================
export { normalizarTelefone, isSamePhone as compararTelefones, formatarTelefoneExibicao, gerarVariacoesTelefone } from './phoneNormalizer.js';

export function extrairTelefoneDeJID(jid) {
  if (!jid) return null;
  const { normalizarTelefone } = require('./phoneNormalizer.js');
  return normalizarTelefone(jid);
}