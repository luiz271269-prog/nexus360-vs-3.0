/**
 * 🔍 Utilitários de Busca Fuzzy e Similaridade
 * Algoritmos para buscar e ranquear resultados por relevância
 */

/**
 * Calcula a distância de Levenshtein entre duas strings
 * (quantidade mínima de edições para transformar uma string em outra)
 */
export function levenshteinDistance(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

/**
 * Calcula percentual de similaridade entre duas strings (0-100)
 * 100 = idênticas, 0 = completamente diferentes
 */
export function calcularSimilaridade(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 100;
  
  const distance = levenshteinDistance(s1, s2);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

/**
 * Normaliza string para busca (remove acentos, pontuação, espaços extras)
 */
export function normalizarParaBusca(texto) {
  if (!texto) return '';
  
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ' ') // Remove pontuação
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .trim();
}

/**
 * Divide string em palavras únicas
 */
export function extrairPalavras(texto) {
  const normalizado = normalizarParaBusca(texto);
  return normalizado.split(' ').filter(p => p.length > 0);
}

/**
 * Verifica se todas as palavras de busca estão presentes no texto alvo
 */
export function contemTodasPalavras(textoBusca, textoAlvo) {
  const palavrasBusca = extrairPalavras(textoBusca);
  const textoAlvoNormalizado = normalizarParaBusca(textoAlvo);
  
  return palavrasBusca.every(palavra => textoAlvoNormalizado.includes(palavra));
}

/**
 * Busca fuzzy em lista de objetos com ranqueamento por similaridade
 * @param {Array} items - Lista de objetos
 * @param {String} termoBusca - Termo digitado pelo usuário
 * @param {String|Array} campos - Campo(s) do objeto para buscar (ex: 'nome' ou ['nome', 'empresa'])
 * @returns {Array} Lista ordenada por relevância com score de similaridade
 */
export function buscarComSimilaridade(items, termoBusca, campos) {
  if (!termoBusca || termoBusca.trim() === '') {
    return items.map(item => ({ ...item, _searchScore: 100 }));
  }

  const camposArray = Array.isArray(campos) ? campos : [campos];
  const termoNormalizado = normalizarParaBusca(termoBusca);
  const palavrasBusca = extrairPalavras(termoBusca);
  
  const resultados = items
    .map(item => {
      let melhorScore = 0;
      let matchExato = false;
      let contemTodas = false;

      // Verificar cada campo
      for (const campo of camposArray) {
        const valorCampo = item[campo] || '';
        const valorNormalizado = normalizarParaBusca(valorCampo);

        // 1. Match exato = 100 pontos
        if (valorNormalizado === termoNormalizado) {
          matchExato = true;
          melhorScore = 100;
          break;
        }

        // 2. Contém todas as palavras = bom score
        if (contemTodasPalavras(termoBusca, valorCampo)) {
          contemTodas = true;
          
          // Calcular similaridade com Levenshtein
          const similaridade = calcularSimilaridade(termoBusca, valorCampo);
          
          // Bonificar se o termo está no início do campo
          let bonus = 0;
          if (valorNormalizado.startsWith(termoNormalizado)) {
            bonus = 20;
          } else if (valorNormalizado.includes(termoNormalizado)) {
            bonus = 10;
          }
          
          const scoreTotal = Math.min(100, similaridade + bonus);
          melhorScore = Math.max(melhorScore, scoreTotal);
        }

        // 3. Contém alguma palavra = score médio
        const algumaPalavraPresente = palavrasBusca.some(p => valorNormalizado.includes(p));
        if (algumaPalavraPresente && melhorScore < 40) {
          const qtdPalavrasPresentes = palavrasBusca.filter(p => valorNormalizado.includes(p)).length;
          const scoreParcial = (qtdPalavrasPresentes / palavrasBusca.length) * 40;
          melhorScore = Math.max(melhorScore, scoreParcial);
        }
      }

      return {
        ...item,
        _searchScore: melhorScore,
        _matchExato: matchExato,
        _contemTodas: contemTodas
      };
    })
    .filter(item => item._searchScore > 0) // Apenas resultados com alguma relevância
    .sort((a, b) => {
      // Ordenar por: match exato > contém todas > score > alfabético
      if (a._matchExato !== b._matchExato) return b._matchExato - a._matchExato;
      if (a._contemTodas !== b._contemTodas) return b._contemTodas - a._contemTodas;
      if (Math.abs(a._searchScore - b._searchScore) > 5) return b._searchScore - a._searchScore;
      
      // Se scores muito próximos, ordenar alfabeticamente
      const nomeA = a[camposArray[0]] || '';
      const nomeB = b[camposArray[0]] || '';
      return nomeA.localeCompare(nomeB);
    });

  return resultados;
}