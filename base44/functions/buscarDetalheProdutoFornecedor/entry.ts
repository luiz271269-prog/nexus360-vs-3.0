import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MARGEM_PADRAO = 1.5;

// Somente domínios de fornecedores conhecidos podem ser lidos (evita SSRF via `url`)
const DOMINIOS_PERMITIDOS = [
  'asvezestem.com.br',
  'asvezestemtubarao.com.br',
  'asvezestemgaropaba.com.br',
  'asvezestemcriciuma.com.br',
  'visaovip.com',
];

function dominioPermitido(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return DOMINIOS_PERMITIDOS.some((d) => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // A sessão do servidor decide o que sai na resposta.
  // Sem sessão válida = visitante da vitrine: modo público forçado (sem custo, sem origem).
  let user = null;
  try { user = await base44.auth.me(); } catch { /* visitante */ }
  const publico = !user;

  const { url, margem } = await req.json().catch(() => ({}));
  if (!url || !String(url).startsWith('http')) {
    return new Response(JSON.stringify({ error: 'URL do produto é obrigatória' }), { status: 400 });
  }
  if (!dominioPermitido(String(url))) {
    return new Response(JSON.stringify({ error: 'Origem não permitida' }), { status: 403 });
  }

  // Visitante nunca define a margem: ela vem sempre da configuração do sistema
  let margemPct = typeof margem === 'number' ? margem : MARGEM_PADRAO;
  if (publico) {
    margemPct = MARGEM_PADRAO;
    try {
      const [cfg] = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ chave: 'precificacao_fornecedores' });
      const lojas = cfg?.valor?.lojas || {};
      const host = new URL(String(url)).hostname;
      const chaveLoja = Object.keys(lojas).find((k) => host.includes(k));
      if (chaveLoja && typeof lojas[chaveLoja]?.margem === 'number') margemPct = lojas[chaveLoja].margem;
    } catch { /* usa padrão */ }
  }

  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `Loja respondeu ${resp.status}` }), { status: 502 });
  }
  const html = await resp.text();

  // Nome — LS.product usa escapes \u0020 / \u00E3
  const nomeRaw = html.match(/LS\.product\s*=\s*\{[\s\S]{0,200}?name\s*:\s*'([^']*)'/);
  const nome = nomeRaw
    ? nomeRaw[1].replace(/\\u([0-9A-Fa-f]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    : (html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || 'Produto');

  // Variantes (preço real, estoque, imagem em alta)
  const varMatch = html.match(/LS\.variants\s*=\s*(\[[\s\S]*?\]);/);
  let variantes: any[] = [];
  try {
    variantes = varMatch ? JSON.parse(varMatch[1]) : [];
  } catch { variantes = []; }

  const imagens = Array.from(new Set(
    variantes.map((v) => v?.image_url).filter(Boolean).map((u: string) => (u.startsWith('//') ? 'https:' + u : u))
  ));
  if (!imagens.length) {
    const og = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
    if (og) imagens.push(og.replace(/^http:/, 'https:'));
  }

  const opcoes = variantes.map((v) => {
    const preco = Number(v?.promotional_price_number || v?.price_number || 0);
    return {
      id: v?.id,
      titulo: [v?.option0, v?.option1, v?.option2].filter(Boolean).join(' / ') || null,
      sku: v?.sku || null,
      preco_fornecedor: preco,
      preco_venda: Math.round(preco * (1 + margemPct / 100) * 100) / 100,
      estoque: typeof v?.stock === 'number' ? v.stock : null,
      disponivel: v?.available !== false,
      imagem: v?.image_url ? (v.image_url.startsWith('//') ? 'https:' + v.image_url : v.image_url) : null,
    };
  });

  const precoBase = opcoes[0]?.preco_fornecedor || 0;
  const precoVendaBase = Math.round(precoBase * (1 + margemPct / 100) * 100) / 100;

  // ── Vitrine pública: entrega só o que a vitrine precisa mostrar ──
  // Sem url de origem, sem custo do fornecedor, sem sku e sem estoque interno.
  if (publico) {
    return new Response(JSON.stringify({
      nome,
      imagens,
      preco_venda: precoVendaBase,
      preco_fornecedor: precoVendaBase,
      disponivel: opcoes.some((o) => o.disponivel),
      variantes: opcoes
        .filter((o) => o.disponivel)
        .map((o) => ({
          id: o.id,
          titulo: o.titulo,
          preco_venda: o.preco_venda,
          preco_fornecedor: o.preco_venda,
          disponivel: true,
          imagem: o.imagem,
        })),
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    nome,
    url,
    imagens,
    preco_fornecedor: precoBase,
    preco_venda: precoVendaBase,
    disponivel: opcoes.some((o) => o.disponivel),
    estoque_total: opcoes.reduce((s, o) => s + (o.estoque || 0), 0),
    variantes: opcoes,
  }), { headers: { 'Content-Type': 'application/json' } });
});