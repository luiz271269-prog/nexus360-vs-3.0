import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';

const norm = (s) => (s || '')
  .toString().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\bS[\/.]?A\b/g, '').replace(/\bLTDA\b/g, '').replace(/\bME\b/g, '')
  .replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

// Centro das UFs — fallback quando o geocoding da cidade falha
const COORD_UF = {
  AC: [-9.02, -70.81], AL: [-9.57, -36.78], AM: [-3.42, -65.86], AP: [1.41, -51.79],
  BA: [-12.58, -41.70], CE: [-5.50, -39.32], DF: [-15.80, -47.86], ES: [-19.18, -40.31],
  GO: [-15.83, -49.84], MA: [-4.96, -45.27], MG: [-18.51, -44.55], MS: [-20.77, -54.79],
  MT: [-12.68, -56.92], PA: [-3.42, -52.22], PB: [-7.24, -36.78], PE: [-8.81, -36.95],
  PI: [-7.72, -42.73], PR: [-24.89, -51.55], RJ: [-22.91, -43.21], RN: [-5.40, -36.95],
  RO: [-10.95, -62.83], RR: [2.74, -62.08], RS: [-30.03, -51.22], SC: [-27.24, -50.22],
  SE: [-10.57, -37.39], SP: [-22.0, -48.5], TO: [-10.18, -48.30]
};

// Normaliza nome de cidade para agrupamento: maiúsculas, sem acentos, espaços únicos
const normCidade = (s) => (s || '')
  .toString().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim();

// Cache em memória do geocoding (vive enquanto a function fica quente)
const geoCache = {};

async function geocodeCidade(cidade, uf) {
  if (!cidade) return COORD_UF[uf] || null;
  const key = `${cidade.toUpperCase()}|${uf}`;
  if (geoCache[key] !== undefined) return geoCache[key];
  try {
    const q = encodeURIComponent(`${cidade}, ${uf}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Nexus360-MapaClientes/1.0' } });
    if (r.ok) {
      const arr = await r.json();
      if (arr && arr[0]) {
        const coord = [parseFloat(arr[0].lat), parseFloat(arr[0].lon)];
        geoCache[key] = coord;
        return coord;
      }
    }
  } catch (_e) { /* cai no fallback */ }
  const fb = COORD_UF[uf] || null;
  geoCache[key] = fb;
  return fb;
}

/**
 * getMapaClientes — Monta o mapa de localização a partir das NOTAS FISCAIS
 * emitidas (fonte: Neural Fin Flow), que representam o volume real de vendas
 * mês a mês. Cada nota traz o nome do cliente, mas NÃO a localização — esta é
 * resolvida cruzando o nome com a entidade Cliente do CRM (cidade/UF).
 *
 * Payload opcional: { mes_referencia: "YYYY-MM" } para filtrar um mês.
 * Retorno: { meses, total, faturamento, clientesUnicos, comLocalizacao,
 *            semLocalizacao, porUF, cidades, clientesSemLocalizacao }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!apiKey) return Response.json({ error: 'NEURAL_FIN_API_KEY nao configurada' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const mesFiltro = body.mes_referencia || null;

    // 1) Buscar todas as Notas Fiscais emitidas (volume real de vendas)
    const url = `https://app.base44.com/api/apps/${EXTERNAL_APP_ID}/entities/NotaFiscal?sort=-data_emissao&limit=1000`;
    const resp = await fetch(url, { headers: { api_key: apiKey, 'Content-Type': 'application/json' } });
    if (!resp.ok) {
      const errText = await resp.text();
      return Response.json({ error: `Erro ${resp.status} ao buscar NFes: ${errText.substring(0, 150)}` }, { status: resp.status });
    }
    const notas = await resp.json();

    // 2) Índice de localização por nome do cliente (CRM)
    const clientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 2000);
    const idxLoc = {};
    const clienteById = {};
    const ufPorCidade = {}; // cidade normalizada -> UF conhecida (para preencher cadastros sem UF)
    for (const c of clientes) {
      clienteById[c.id] = c;
      const loc = { cidade: (c.cidade || '').trim(), uf: (c.uf || '').trim().toUpperCase() };
      if (!loc.cidade && !loc.uf) continue;
      if (loc.cidade && loc.uf && !ufPorCidade[normCidade(loc.cidade)]) {
        ufPorCidade[normCidade(loc.cidade)] = loc.uf;
      }
      for (const nome of [c.razao_social, c.nome_fantasia]) {
        const k = norm(nome);
        if (k && !idxLoc[k]) idxLoc[k] = loc;
      }
    }

    // 2b) Mapa de Users (id -> nome) para resolver atendente fidelizado
    const users = await base44.asServiceRole.entities.User.list();
    const nomeUser = {};
    for (const u of users) nomeUser[u.id] = u.full_name || u.display_name || u.email || 'Vendedor';
    const acharLoc = (nomeCliente) => {
      const k = norm(nomeCliente);
      if (idxLoc[k]) return idxLoc[k];
      // match por PREFIXO com fronteira de palavra: um nome deve começar com o outro completo.
      // Evita falsos positivos de palavras genéricas no meio do nome (ex: cadastro "Sistema"
      // capturava "SENIOR SISTEMAS" e jogava o cliente na cidade errada).
      for (const chave in idxLoc) {
        if (Math.min(chave.length, k.length) < 4) continue;
        if (k.startsWith(chave + ' ') || chave.startsWith(k + ' ')) return idxLoc[chave];
      }
      return null;
    };

    // 3) Meses disponíveis
    const mesesSet = {};
    for (const n of notas) {
      const m = (n.data_emissao || '').substring(0, 7);
      if (m) mesesSet[m] = (mesesSet[m] || 0) + 1;
    }
    const meses = Object.keys(mesesSet).sort().reverse();

    // 4) Filtra pelo mês (se houver) e agrega por cliente
    const notasFiltradas = mesFiltro
      ? notas.filter(n => (n.data_emissao || '').startsWith(mesFiltro))
      : notas;

    const porCliente = {};
    let faturamento = 0;
    for (const n of notasFiltradas) {
      const nome = (n.cliente || '').trim();
      if (!nome) continue;
      const valor = Number(n.valor_total) || 0;
      faturamento += valor;
      if (!porCliente[nome]) {
        porCliente[nome] = { nome, vendedor: n.vendedor || 'Sem vendedor', notas: 0, valor: 0 };
      }
      porCliente[nome].notas++;
      porCliente[nome].valor += valor;
    }

    // Lista de vendedores presentes nas NFs (para o filtro do mapa)
    const vendedoresNF = Array.from(new Set(Object.values(porCliente).map(c => c.vendedor).filter(Boolean))).sort();

    // 5) Distribui por localização
    const porUF = {};
    const cidadesMap = {};
    const semLoc = [];
    for (const nome in porCliente) {
      const c = porCliente[nome];
      const loc = acharLoc(nome);
      if (!loc) { semLoc.push(c); continue; }
      const cidadeKey = normCidade(loc.cidade);
      const ufFinal = loc.uf || ufPorCidade[cidadeKey] || '';
      if (ufFinal) porUF[ufFinal] = (porUF[ufFinal] || 0) + 1;
      const key = `${cidadeKey}|${ufFinal}`;
      if (!cidadesMap[key]) {
        cidadesMap[key] = { cidade: loc.cidade || '(sem cidade)', uf: ufFinal || '-', total: 0, valor: 0, clientes: [] };
      }
      cidadesMap[key].total++;
      cidadesMap[key].valor += c.valor;
      cidadesMap[key].clientes.push({ nome: c.nome, vendedor: c.vendedor, notas: c.notas, valor: c.valor });
      // por vendedor dentro da cidade
      cidadesMap[key].porVendedor = cidadesMap[key].porVendedor || {};
      cidadesMap[key].porVendedor[c.vendedor] = (cidadesMap[key].porVendedor[c.vendedor] || 0) + c.valor;
    }

    // 5b) Contatos fidelizados de vendas — quantidade por vendedor + tempo de atividade + localização
    const contatosFid = await base44.asServiceRole.entities.Contact.filter({ is_cliente_fidelizado: true }, '-ultima_interacao', 2000);
    const agora = Date.now();
    const fidelizadosPorVendedor = {};
    const fidelizadosCidadeMap = {};
    for (const ct of contatosFid) {
      const vendId = ct.atendente_fidelizado_vendas;
      if (!vendId) continue;
      const vendNome = nomeUser[vendId] || 'Vendedor';
      // tempo de atividade (dias desde última interação)
      const ts = ct.ultima_interacao ? new Date(ct.ultima_interacao).getTime() : null;
      const diasInativo = ts ? Math.floor((agora - ts) / 86400000) : null;
      if (!fidelizadosPorVendedor[vendNome]) {
        fidelizadosPorVendedor[vendNome] = { vendedor: vendNome, total: 0, ativos: 0, parados: 0 };
      }
      fidelizadosPorVendedor[vendNome].total++;
      if (diasInativo !== null && diasInativo <= 7) fidelizadosPorVendedor[vendNome].ativos++;
      else fidelizadosPorVendedor[vendNome].parados++;

      // localização via cliente vinculado
      const cli = ct.cliente_id ? clienteById[ct.cliente_id] : null;
      const cidade = (cli?.cidade || '').trim();
      const ufRaw = (cli?.uf || '').trim().toUpperCase();
      if (!cidade && !ufRaw) continue;
      const uf = ufRaw || ufPorCidade[normCidade(cidade)] || '';
      const k = `${normCidade(cidade)}|${uf}`;
      if (!fidelizadosCidadeMap[k]) {
        fidelizadosCidadeMap[k] = { cidade: cidade || '(sem cidade)', uf: uf || '-', total: 0, contatos: [] };
      }
      fidelizadosCidadeMap[k].total++;
      fidelizadosCidadeMap[k].contatos.push({ nome: ct.nome, vendedor: vendNome, diasInativo });
    }
    const fidelizadosRanking = Object.values(fidelizadosPorVendedor).sort((a, b) => b.total - a.total);
    const fidelizadosCidades = Object.values(fidelizadosCidadeMap).sort((a, b) => b.total - a.total);

    const cidades = Object.values(cidadesMap).sort((a, b) => b.valor - a.valor);
    cidades.forEach(c => c.clientes.sort((a, b) => b.valor - a.valor));
    semLoc.sort((a, b) => b.valor - a.valor);

    // Geocoding real por cidade (sequencial para respeitar rate-limit do Nominatim)
    for (const c of cidades) {
      c.coord = await geocodeCidade(c.cidade, c.uf);
    }
    for (const c of fidelizadosCidades) {
      c.coord = await geocodeCidade(c.cidade, c.uf);
    }

    const clientesUnicos = Object.keys(porCliente).length;

    return Response.json({
      meses,
      mesAtivo: mesFiltro,
      totalNotas: notasFiltradas.length,
      faturamento,
      clientesUnicos,
      comLocalizacao: clientesUnicos - semLoc.length,
      semLocalizacao: semLoc.length,
      porUF,
      cidades,
      clientesSemLocalizacao: semLoc,
      vendedores: vendedoresNF,
      fidelizadosRanking,
      fidelizadosCidades
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});