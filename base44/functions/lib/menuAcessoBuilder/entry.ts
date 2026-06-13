// ============================================================================
// MENU DE ACESSOS RÁPIDOS — construtor de menus em 3 níveis (NeuralTec)
// ============================================================================
// Nível 1: menu principal (categorias)
// Nível 2: submenu da categoria (itens)
// Nível 3: link/ação final
//
// Os itens vêm do cadastro AcessoRapido. Categorias são derivadas do campo
// `tipo` e do `titulo` de cada item:
//   - setor  → Setores (Vendas, Assistência, Financeiro, Compras)
//   - pix    → Pix
//   - link   → separado em Mídias (Instagram/LinkedIn) e Promoções/Sites
//             (Site, Promoções) pelo título.
// ============================================================================

// Classifica um item AcessoRapido numa das 4 categorias.
function categoriaDoItem(item) {
  const tipo = String(item.tipo || 'link').toLowerCase();
  if (tipo === 'setor') return 'setores';
  if (tipo === 'pix') return 'pix';
  // tipo === 'link' → decide por título
  const t = String(item.titulo || '').toLowerCase();
  if (t.includes('site') || t.includes('promo')) return 'promocoes';
  return 'midias'; // Instagram, LinkedIn, etc.
}

// Agrupa os itens nas 4 categorias, preservando a ordem do cadastro.
export function agruparPorCategoria(itens) {
  const grupos = { setores: [], midias: [], promocoes: [], pix: [] };
  for (const item of itens) {
    grupos[categoriaDoItem(item)].push(item);
  }
  return grupos;
}

const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

// Nível 1 — menu principal curto. Só mostra categorias que têm itens.
export function buildMenuPrincipal(grupos) {
  const cats = [];
  if (grupos.setores.length) cats.push({ key: 'setores', label: 'Setores' });
  if (grupos.midias.length) cats.push({ key: 'midias', label: 'Mídias' });
  if (grupos.promocoes.length) cats.push({ key: 'promocoes', label: 'Promoções' });
  if (grupos.pix.length) cats.push({ key: 'pix', label: 'Pix' });

  const linhas = cats.map((c, i) => `${NUM[i]} ${c.label}`);
  const texto = `⚡ *NEURALTEC — Acessos rápidos*\n\nComo podemos te ajudar?\nResponda com o número:\n\n${linhas.join('\n')}`;
  // mapa posição → categoria (para interpretar a resposta numérica)
  const mapa = {};
  cats.forEach((c, i) => { mapa[String(i + 1)] = c.key; });
  return { texto, mapa };
}

// Nível 2/3 — submenu de uma categoria.
// Para setores/mídias: lista numerada + um 2º passo (número → link).
// Para promoções/pix: já entrega o conteúdo direto (1 ou poucos itens).
export function buildSubmenu(categoria, grupos) {
  const itens = grupos[categoria] || [];
  if (!itens.length) return null;

  const titulosCat = {
    setores: '💬 *Setores NeuralTec*',
    midias: '🌐 *Mídias NeuralTec*',
    promocoes: '🏷️ *Promoções NeuralTec*',
    pix: '⚡ *Pix NeuralTec*'
  };

  // Pix: entrega a chave direto
  if (categoria === 'pix') {
    const pix = itens[0];
    return {
      tipo: 'final',
      texto: `${titulosCat.pix}\n\nChave Pix (copie e cole):\n${pix.url}`,
      mapa: null
    };
  }

  // Promoções com 1 item: entrega o link direto
  if (categoria === 'promocoes' && itens.length === 1) {
    const p = itens[0];
    return {
      tipo: 'final',
      texto: `${titulosCat.promocoes}\n\nAcesse:\n${p.url}`,
      mapa: null
    };
  }

  // Setores / Mídias / Promoções(>1): menu numerado + mapa para o link final
  const linhas = itens.map((it, i) => `${NUM[i]} ${it.titulo}`);
  const mapa = {};
  itens.forEach((it, i) => { mapa[String(i + 1)] = it.id; });
  return {
    tipo: 'menu',
    texto: `${titulosCat[categoria]}\n\nResponda com o número:\n\n${linhas.join('\n')}`,
    mapa
  };
}

// Texto final de um item escolhido (link ou Pix).
export function buildItemFinal(item) {
  const emoji = item.emoji || '🔗';
  if (String(item.tipo).toLowerCase() === 'pix') {
    return `${emoji} *${item.titulo}*\n\nChave Pix (copie e cole):\n${item.url}`;
  }
  return `${emoji} *${item.titulo}*\n\n${item.url}`;
}