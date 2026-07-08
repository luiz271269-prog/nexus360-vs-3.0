import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';

const norm = (s) => (s || '')
  .toString().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\bS[\/.]?A\b/g, '').replace(/\bLTDA\b/g, '').replace(/\bME\b/g, '').replace(/\bEPP\b/g, '')
  .replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * getFaturamentoPorCliente — Cruza as Notas Fiscais emitidas (Neural Fin Flow)
 * com a entidade Cliente do CRM, agregando faturamento por cliente.
 *
 * Retorno:
 *  - faturamentoPorCliente: { [cliente_id]: { totalFaturado, totalRecebido, qtdNotas, ultimaEmissao } }
 *  - clientesNaoCadastrados: [{ nome, vendedor, totalFaturado, totalRecebido, qtdNotas, ultimaEmissao }]
 *  - resumo: { totalNotas, faturamentoTotal, clientesCadastradosComNF, clientesNaoCadastrados }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!apiKey) return Response.json({ error: 'NEURAL_FIN_API_KEY nao configurada' }, { status: 500 });

    // 1) Buscar NFes
    const url = `https://app.base44.com/api/apps/${EXTERNAL_APP_ID}/entities/NotaFiscal?sort=-data_emissao&limit=1000`;
    const resp = await fetch(url, { headers: { api_key: apiKey, 'Content-Type': 'application/json' } });
    if (!resp.ok) {
      const errText = await resp.text();
      return Response.json({ error: `Erro ${resp.status} ao buscar NFes: ${errText.substring(0, 150)}` }, { status: resp.status });
    }
    const todasNotas = await resp.json();
    // Padrão auditado (mesmo critério de analiseCruzadaClientes/buscarNotasFiscaisExternas):
    // excluir espelhos de CI (dupla contagem) e NFs anuladas/canceladas (não são receita).
    const STATUS_INVALIDOS = ['anulada', 'cancelado', 'cancelada'];
    const notas = todasNotas.filter((n) => !n.is_espelho_ci && !STATUS_INVALIDOS.includes(n.status));

    // 2) Índice de clientes cadastrados (nome normalizado -> id)
    const clientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 2000);
    const idxCliente = {};
    for (const c of clientes) {
      for (const nome of [c.razao_social, c.nome_fantasia]) {
        const k = norm(nome);
        if (k && !idxCliente[k]) idxCliente[k] = c.id;
      }
    }
    const acharClienteId = (nomeNF) => {
      const k = norm(nomeNF);
      if (idxCliente[k]) return idxCliente[k];
      for (const chave in idxCliente) {
        if (chave.length >= 6 && (k.includes(chave) || chave.includes(k))) return idxCliente[chave];
      }
      return null;
    };

    // 3) Agrega NFes por cliente cadastrado e por nome (não cadastrados)
    const faturamentoPorCliente = {};
    const naoCadastradosMap = {};
    let faturamentoTotal = 0;

    for (const n of notas) {
      const nome = (n.cliente || '').trim();
      if (!nome) continue;
      const valor = Number(n.valor_total) || 0;
      const recebido = Number(n.valor_recebido) || 0;
      const emissao = n.data_emissao || '';
      faturamentoTotal += valor;

      const clienteId = acharClienteId(nome);
      if (clienteId) {
        if (!faturamentoPorCliente[clienteId]) {
          faturamentoPorCliente[clienteId] = { totalFaturado: 0, totalRecebido: 0, qtdNotas: 0, ultimaEmissao: '', meses: {} };
        }
        const reg = faturamentoPorCliente[clienteId];
        reg.totalFaturado += valor;
        reg.totalRecebido += recebido;
        reg.qtdNotas++;
        if (emissao > reg.ultimaEmissao) reg.ultimaEmissao = emissao;
        if (emissao.length >= 7) reg.meses[emissao.substring(0, 7)] = true;
      } else {
        const k = norm(nome);
        if (!naoCadastradosMap[k]) {
          naoCadastradosMap[k] = { nome, vendedor: n.vendedor || '', totalFaturado: 0, totalRecebido: 0, qtdNotas: 0, ultimaEmissao: '' };
        }
        const reg = naoCadastradosMap[k];
        reg.totalFaturado += valor;
        reg.totalRecebido += recebido;
        reg.qtdNotas++;
        if (emissao > reg.ultimaEmissao) reg.ultimaEmissao = emissao;
      }
    }

    const clientesNaoCadastrados = Object.values(naoCadastradosMap).sort((a, b) => b.totalFaturado - a.totalFaturado);

    // 4) Etiqueta de recorrência baseada nos últimos 3 meses de compra:
    //    ouro  = comprou nos 3 últimos meses | prata = comprou em 1-2 deles | risco = já comprou, mas nada nos últimos 3 meses
    const agora = new Date();
    const ultimos3Meses = [0, 1, 2].map((i) => {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    });
    for (const id in faturamentoPorCliente) {
      const reg = faturamentoPorCliente[id];
      const mesesRecentes = ultimos3Meses.filter((m) => reg.meses[m]).length;
      reg.mesesRecentes = mesesRecentes;
      reg.etiqueta = mesesRecentes === 3 ? 'ouro' : mesesRecentes >= 1 ? 'prata' : 'risco';
      delete reg.meses;
    }

    return Response.json({
      faturamentoPorCliente,
      clientesNaoCadastrados,
      resumo: {
        totalNotas: notas.length,
        faturamentoTotal,
        clientesCadastradosComNF: Object.keys(faturamentoPorCliente).length,
        clientesNaoCadastrados: clientesNaoCadastrados.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});