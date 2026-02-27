// ============================================================================
// ESTE ARQUIVO É UM WRAPPER - A FONTE DE VERDADE É phoneNormalizer.js
// ============================================================================
export { normalizarTelefone, isSamePhone as compararTelefones, formatarTelefoneExibicao, gerarVariacoesTelefone } from './phoneNormalizer.js';

export function extrairTelefoneDeJID(jid) {
  const { normalizarTelefone } = await import('./phoneNormalizer.js');
  return normalizarTelefone(jid);
}