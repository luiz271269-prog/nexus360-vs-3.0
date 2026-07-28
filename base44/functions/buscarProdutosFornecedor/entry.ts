import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const LOJAS = [
  { id: "matriz", nome: "Matriz (Palhoça)", base: "https://asvezestem.com.br/produtos/" },
  { id: "tubarao", nome: "Tubarão", base: "https://asvezestemtubarao.com.br/produtos/" },
  { id: "garopaba", nome: "Garopaba", base: "https://asvezestemgaropaba.com.br/eletronicos/" },
  { id: "criciuma", nome: "Criciúma", base: "https://asvezestemcriciuma.com.br/eletronicos/" },
];

const PAGINAS = 8; // 12 produtos por página (?page=N) — mpage não funciona server-side
const MARGEM = 1.5; // %

function parsePreco(txt) {
  const m = txt.replace(/\./g, '').replace(',', '.').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function extrairProdutos(html, loja) {
  const produtos = [];
  const blocos = html.split(/item-product\s*"\s*data-product-type/).slice(1);

  for (const bloco of blocos) {
    const linkMatch = bloco.match(/href="(https?:\/\/[^"]+\/(?:produtos|eletronicos)\/[^"]+)"\s+title="([^"]+)"/);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const nome = linkMatch[2];

    const precosTxt = bloco.slice(0, 20000).match(/R\$\s?[\d.]+,\d{2}/g) || [];
    const precos = precosTxt.map(parsePreco).filter((p) => p > 0);
    const preco = precos.length ? Math.max(...precos) : 0;

    // Imagens são lazy-load: a URL real está em data-srcset (src é um GIF base64 placeholder)
    const srcset = bloco.match(/data-srcset="([^"]+)"/);
    let imagem = null;
    if (srcset) {
      const candidatos = srcset[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
      imagem = candidatos.find((c) => c.includes('-480-')) || candidatos[candidatos.length - 1] || null;
    }
    if (!imagem) {
      const imgMatch = bloco.match(/(?:data-src|src)="((?:\/\/|https?:\/\/)[^"\s]+\.(?:webp|jpg|jpeg|png)[^"\s]*)"/);
      imagem = imgMatch ? imgMatch[1] : null;
    }
    if (imagem && imagem.startsWith('//')) imagem = 'https:' + imagem;

    // Rótulo "Esgotado" existe em todos os cards; produto está esgotado quando NÃO tem display:none
    const stockTag = bloco.slice(0, 20000).match(/js-stock-label[^>]*>/);
    const semEstoque = stockTag ? !/display:\s*none/.test(stockTag[0]) : false;

    produtos.push({
      nome: nome.trim(),
      url,
      imagem,
      preco_fornecedor: preco,
      preco_venda: Math.round(preco * (1 + MARGEM / 100) * 100) / 100,
      disponivel: !semEstoque,
      loja_id: loja.id,
      loja_nome: loja.nome,
    });
  }
  return produtos;
}

async function buscarLoja(loja, termo = '') {
  const urls = [];
  if (termo) {
    // Busca no próprio site do fornecedor (pega itens fora das primeiras páginas do catálogo)
    const origem = new URL(loja.base).origin;
    for (let p = 1; p <= PAGINAS; p++) {
      urls.push(`${origem}/search/?q=${encodeURIComponent(termo)}&page=${p}`);
    }
  } else {
    for (let p = 1; p <= PAGINAS; p++) {
      urls.push(p === 1 ? loja.base : `${loja.base}?page=${p}`);
    }
  }
  const paginas = await Promise.allSettled(
    urls.map((u) => fetch(u, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(20000),
    }).then((r) => (r.ok ? r.text() : '')))
  );

  const vistos = new Set();
  const produtos = [];
  for (const pg of paginas) {
    if (pg.status !== 'fulfilled' || !pg.value) continue;
    for (const prod of extrairProdutos(pg.value, loja)) {
      if (vistos.has(prod.url)) continue;
      vistos.add(prod.url);
      produtos.push(prod);
    }
  }
  return produtos;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let termo = '';
    try {
      const body = await req.json();
      termo = (body?.q || '').toString().trim();
    } catch { /* sem body */ }

    const resultados = await Promise.allSettled(LOJAS.map((l) => buscarLoja(l, termo)));

    const produtos = [];
    const erros = [];
    resultados.forEach((r, i) => {
      // Sempre retornar apenas itens com estoque disponível
      if (r.status === 'fulfilled') produtos.push(...r.value.filter((p) => p.disponivel));
      else erros.push(`${LOJAS[i].nome}: ${r.reason?.message || 'falha'}`);
    });

    return Response.json({
      produtos,
      total: produtos.length,
      margem_aplicada: MARGEM,
      erros,
      atualizado_em: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});