// ============================================================================
// ESTE ARQUIVO É UM REDIRECT - A FONTE DE VERDADE É phoneNormalizer.js
// ============================================================================
export { normalizarTelefone, isSamePhone as compararTelefones, formatarTelefoneExibicao, gerarVariacoesTelefone } from './phoneNormalizer.js';

export function extrairTelefoneDeJID(jid) {
  if (!jid) return null;
  return jid.split('@')[0].replace(/\D/g, '');
}