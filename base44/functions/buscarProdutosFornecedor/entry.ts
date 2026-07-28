import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const LOJAS = [
  { id: "matriz", nome: "Matriz (Palhoça)", base: "https://asvezestem.com.br/produtos/" },
  { id: "tubarao", nome: "Tubarão", base: "https://asvezestemtubarao.com.br/produtos/" },
  { id: "garopaba", nome: "Garopaba", base: "https://asvezestemgaropaba.com.br/eletronicos/" },
  { id: "criciuma", nome: "Criciúma", base: "https://asvezestemcriciuma.com.br/eletronicos/" },
];

const PAGINAS = 8; // 12 produtos por página (?page=N) — mpage não funciona server-side
const MARGEM = 1.5; // %
const VISAOVIP = { id: "visaovip", nome: "Visão VIP (PY)" };
const VISAOVIP_PAGINAS = 3; // 24 produtos por página

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
      moeda: 'BRL',
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

/* ───────────── Visão VIP (Paraguai) ─────────────
   O site é protegido por Cloudflare e renderiza por JavaScript.
   Por isso a leitura passa por um leitor com navegador (r.jina.ai). */

function tituloDeSlug(slug) {
  return slug.split('-').map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function extrairVisaoVip(md) {
  const produtos = [];
  const re = /!\[Image[^\]]*\]\((https:\/\/(?:cdn\.visaovip\.com|www\.visaovip\.com\/sem-imagem)[^)\s]*)\)([^[]*?)\]\((https:\/\/www\.visaovip\.com\/prod\/([^/]+)\/[^)]+)\)/g;
  let m;
  while ((m = re.exec(md))) {
    const imagem = m[1];
    const texto = m[2].replace(/\\/g, ' ').replace(/\s+/g, ' ').trim();
    const url = m[3];
    const categoria = tituloDeSlug(m[4]);

    const precos = [...texto.matchAll(/U\$\s?([\d.]+,\d{2})/g)].map((x) => parsePreco(x[1]));
    if (!precos.length) continue;
    const preco = precos[precos.length - 1]; // último = preço promocional quando há oferta

    let head = texto.split(/U\$/)[0].trim();
    // Marca vem no final, sempre em caixa alta
    const marcaMatch = head.match(/\s([A-Z0-9][A-Z0-9\s&.\-]{1,24})$/);
    const marca = marcaMatch ? marcaMatch[1].trim() : '';
    if (marca) head = head.slice(0, head.length - marca.length).trim();
    // Categoria também aparece no fim do texto — remove para sobrar só o nome
    if (categoria && head.toLowerCase().endsWith(categoria.toLowerCase())) {
      head = head.slice(0, head.length - categoria.length).trim();
    }

    produtos.push({
      nome: head || texto.slice(0, 120),
      url,
      imagem,
      moeda: 'USD',
      preco_fornecedor: preco,
      preco_venda: preco,
      disponivel: true,
      marca,
      tipo_item: categoria,
      codigo: (texto.match(/C[óo]digo:\s*(\d+)/) || [])[1] || null,
      loja_id: VISAOVIP.id,
      loja_nome: VISAOVIP.nome,
    });
  }
  return produtos;
}

async function lerComNavegador(url) {
  const chave = Deno.env.get('JINA_API_KEY');
  const headers: Record<string, string> = { 'x-engine': 'browser', 'Accept': 'text/plain' };
  if (chave) headers['Authorization'] = `Bearer ${chave}`;

  const r = await fetch('https://r.jina.ai/' + url, { headers, signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error(`leitor ${r.status}`);
  return await r.text();
}

async function buscarVisaoVip(termo = '') {
  const alvo = termo
    ? `https://www.visaovip.com/busca/termo/${encodeURIComponent(termo)}/`
    : 'https://www.visaovip.com/busca/promocoes/';

  const urls = [];
  for (let p = 1; p <= VISAOVIP_PAGINAS; p++) urls.push(p === 1 ? alvo : `${alvo}?page=${p}`);

  const paginas = await Promise.allSettled(urls.map(lerComNavegador));
  const falhas = paginas.filter((p) => p.status === 'rejected').map((p: any) => p.reason?.message);

  let cotacao = null;
  const vistos = new Set();
  const produtos = [];
  for (const pg of paginas) {
    if (pg.status !== 'fulfilled' || !pg.value) continue;
    if (!cotacao) {
      const c = pg.value.match(/R\$\s?([\d.,]+)/);
      if (c) cotacao = parsePreco(c[1]);
    }
    for (const prod of extrairVisaoVip(pg.value)) {
      if (vistos.has(prod.url)) continue;
      vistos.add(prod.url);
      produtos.push(prod);
    }
  }
  return {
    produtos,
    cotacao,
    erro: produtos.length === 0 && falhas.length ? `leitura bloqueada (${falhas[0]})` : null,
  };
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

    const [resultados, visao] = await Promise.all([
      Promise.allSettled(LOJAS.map((l) => buscarLoja(l, termo))),
      buscarVisaoVip(termo).catch((e) => ({ produtos: [], cotacao: null, erro: e.message })),
    ]);

    const produtos = [];
    const erros = [];
    resultados.forEach((r, i) => {
      // Sempre retornar apenas itens com estoque disponível
      if (r.status === 'fulfilled') produtos.push(...r.value.filter((p) => p.disponivel));
      else erros.push(`${LOJAS[i].nome}: ${r.reason?.message || 'falha'}`);
    });

    if (visao?.erro) erros.push(`${VISAOVIP.nome}: ${visao.erro}`);
    produtos.push(...(visao?.produtos || []));

    return Response.json({
      total: produtos.length,
      total_por_loja: produtos.reduce((acc, p) => ({ ...acc, [p.loja_id]: (acc[p.loja_id] || 0) + 1 }), {}),
      erros,
      produtos,
      margem_aplicada: MARGEM,
      cotacao_dolar_site: visao?.cotacao || null,
      erros,
      atualizado_em: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});