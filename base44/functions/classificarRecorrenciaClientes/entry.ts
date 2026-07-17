import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';

const norm = (s) => (s || '')
  .toString().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\bS[\/.]?A\b/g, '').replace(/\bLTDA\b/g, '').replace(/\bME\b/g, '').replace(/\bEPP\b/g, '')
  .replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * classificarRecorrenciaClientes — Recalcula e PERSISTE a etiqueta de recorrência
 * mensal em cada Cliente (etiqueta_recorrencia: ouro | prata | risco | none).
 *
 * Mesmos critérios do getFaturamentoPorCliente (fonte de verdade):
 *  - ouro:  comprou (NF válida) em TODOS os 3 últimos meses
 *  - prata: comprou em 1 ou 2 dos 3 últimos meses
 *  - risco: já comprou, mas nada nos últimos 3 meses
 *  - none:  nunca teve NF vinculada
 *
 * Executado por automação agendada (diária) ou manualmente por admin.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores' }, { status: 403 });
    }
    if (!user && !(await base44.auth.isAuthenticated().catch(() => false))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!apiKey) return Response.json({ error: 'NEURAL_FIN_API_KEY nao configurada' }, { status: 500 });

    // 1) Buscar NFes válidas (mesmo critério auditado do getFaturamentoPorCliente)
    const url = `https://app.base44.com/api/apps/${EXTERNAL_APP_ID}/entities/NotaFiscal?sort=-data_emissao&limit=1000`;
    const resp = await fetch(url, { headers: { api_key: apiKey, 'Content-Type': 'application/json' } });
    if (!resp.ok) {
      const errText = await resp.text();
      return Response.json({ error: `Erro ${resp.status} ao buscar NFes: ${errText.substring(0, 150)}` }, { status: resp.status });
    }
    const todasNotas = await resp.json();
    const STATUS_INVALIDOS = ['anulada', 'cancelado', 'cancelada'];
    const notas = todasNotas.filter((n) => !n.is_espelho_ci && !STATUS_INVALIDOS.includes(n.status));

    // 2) Índice de clientes (nome normalizado -> id)
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

    // 3) Agregar meses de compra por cliente
    const porCliente = {};
    for (const n of notas) {
      const nome = (n.cliente || '').trim();
      if (!nome) continue;
      const clienteId = acharClienteId(nome);
      if (!clienteId) continue;
      if (!porCliente[clienteId]) porCliente[clienteId] = { meses: {}, qtdNotas: 0, ultimaEmissao: '' };
      const reg = porCliente[clienteId];
      reg.qtdNotas++;
      const emissao = n.data_emissao || '';
      if (emissao > reg.ultimaEmissao) reg.ultimaEmissao = emissao;
      if (emissao.length >= 7) reg.meses[emissao.substring(0, 7)] = true;
    }

    // 4) Calcular etiqueta (3 últimos meses) e montar updates apenas do que mudou
    const agora = new Date();
    const ultimos3Meses = [0, 1, 2].map((i) => {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    });
    const nowIso = agora.toISOString();
    const updates = [];
    const contagem = { ouro: 0, prata: 0, risco: 0, none: 0 };

    for (const c of clientes) {
      const reg = porCliente[c.id];
      let etiqueta = 'none';
      if (reg) {
        const mesesRecentes = ultimos3Meses.filter((m) => reg.meses[m]).length;
        etiqueta = mesesRecentes === 3 ? 'ouro' : mesesRecentes >= 1 ? 'prata' : 'risco';
      }
      contagem[etiqueta]++;
      const ultimaCompra = reg ? (reg.ultimaEmissao || '').substring(0, 10) : '';
      const qtdNotas = reg ? reg.qtdNotas : 0;

      const mudou = c.etiqueta_recorrencia !== etiqueta
        || (c.recorrencia_qtd_notas || 0) !== qtdNotas
        || (c.recorrencia_ultima_compra || '') !== ultimaCompra;
      if (mudou) {
        updates.push({
          id: c.id,
          etiqueta_recorrencia: etiqueta,
          recorrencia_qtd_notas: qtdNotas,
          recorrencia_ultima_compra: ultimaCompra,
          recorrencia_atualizada_em: nowIso
        });
      }
    }

    // 5) Persistir em lotes de 500 (limite do bulkUpdate)
    let atualizados = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const lote = updates.slice(i, i + 500);
      await base44.asServiceRole.entities.Cliente.bulkUpdate(lote);
      atualizados += lote.length;
    }

    return Response.json({
      success: true,
      totalClientes: clientes.length,
      notasConsideradas: notas.length,
      atualizados,
      semMudanca: clientes.length - atualizados,
      contagem,
      mesesReferencia: ultimos3Meses
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});