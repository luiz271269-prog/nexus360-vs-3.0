// ==========================================
// NORMALIZAÇÃO ÚNICA DE ETIQUETAS DE CONTATO
// ==========================================
// Fonte única de verdade para gerar o "slug" canônico de uma etiqueta.
// Usado tanto na UI (impedir criar duplicado) quanto no backend (mesclar duplicados).
// Remove acentos, baixa caixa, remove plural simples e unifica espaços/símbolos.

export function normalizarSlugEtiqueta(texto) {
  if (!texto) return '';
  let s = String(texto).trim().toLowerCase();

  // Remover acentos (NFD + strip diacríticos)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Trocar qualquer separador (espaço, hífen, ponto) por underscore
  s = s.replace(/[\s\-.]+/g, '_');

  // Remover caracteres não alfanuméricos (exceto underscore)
  s = s.replace(/[^a-z0-9_]/g, '');

  // Colapsar underscores repetidos e aparar
  s = s.replace(/_+/g, '_').replace(/^_|_$/g, '');

  // Remover plural simples no final (promocoes -> promocao? -> trata "s"/"es" no final)
  // Estratégia conservadora: remove apenas "s" final isolado (promocoes -> promocoe não ajuda),
  // então normalizamos plurais comuns por substituição direta.
  s = s
    .replace(/oes$/, 'ao')   // promocoes -> promocao, ordens? (não), informacoes -> informacao
    .replace(/aes$/, 'ao')   // alemaes -> alemao
    .replace(/ais$/, 'al')   // contratuais -> contratual
    .replace(/s$/, '');      // genérico: remove "s" final (ordens -> orden? aceitável p/ dedupe)

  return s;
}

// Compara dois textos e diz se geram a MESMA etiqueta canônica
export function mesmaEtiqueta(a, b) {
  return normalizarSlugEtiqueta(a) === normalizarSlugEtiqueta(b);
}