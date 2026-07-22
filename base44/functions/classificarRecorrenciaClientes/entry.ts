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

    // 2b) Pipeline de orçamentos por cliente: potencial (aberto) x perdas (rejeitado/vencido) x ganhos (aprovado)
    const orcamentos = await base44.asServiceRole.entities.Orcamento.list('-updated_date', 2000);
    const STATUS_PERDIDO = ['rejeitado', 'vencido'];
    const STATUS_GANHO = ['aprovado'];
    const pipelinePorCliente = {};
    for (const o of orcamentos) {
      if (!o.cliente_id) continue;
      if (!pipelinePorCliente[o.cliente_id]) {
        pipelinePorCliente[o.cliente_id] = { potencialValor: 0, potencialQtd: 0, perdidoValor: 0, perdidoQtd: 0, ganhoValor: 0, ganhoQtd: 0 };
      }
      const p = pipelinePorCliente[o.cliente_id];
      const v = Number(o.valor_total) || 0;
      if (STATUS_PERDIDO.includes(o.status)) { p.perdidoValor += v; p.perdidoQtd++; }
      else if (STATUS_GANHO.includes(o.status)) { p.ganhoValor += v; p.ganhoQtd++; }
      else { p.potencialValor += v; p.potencialQtd++; }
    }

    // 3) Agregar meses de compra por cliente
    const porCliente = {};
    for (const n of notas) {
      const nome = (n.cliente || '').trim();
      if (!nome) continue;
      const clienteId = acharClienteId(nome);
      if (!clienteId) continue;
      if (!porCliente[clienteId]) porCliente[clienteId] = { meses: {}, valorPorMes: {}, qtdNotas: 0, ultimaEmissao: '' };
      const reg = porCliente[clienteId];
      reg.qtdNotas++;
      const emissao = n.data_emissao || '';
      const valor = Number(n.valor_total) || 0;
      if (emissao > reg.ultimaEmissao) reg.ultimaEmissao = emissao;
      if (emissao.length >= 7) {
        const mes = emissao.substring(0, 7);
        reg.meses[mes] = true;
        reg.valorPorMes[mes] = (reg.valorPorMes[mes] || 0) + valor;
      }
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
    const contagemFaixa = { diamante: 0, alto: 0, medio: 0, baixo: 0, none: 0 };

    // Faixas de faturamento mensal (média dos últimos 3 meses)
    const calcularFaixa = (media) => {
      if (media >= 20000) return 'diamante';
      if (media >= 5000) return 'alto';
      if (media >= 1000) return 'medio';
      if (media > 0) return 'baixo';
      return 'baixo'; // já comprou (tem NF) mas sem valor nos 3 últimos meses
    };

    for (const c of clientes) {
      const reg = porCliente[c.id];
      let etiqueta = 'none';
      let faixa = 'none';
      let mediaMensal = 0;
      if (reg) {
        const mesesRecentes = ultimos3Meses.filter((m) => reg.meses[m]).length;
        etiqueta = mesesRecentes === 3 ? 'ouro' : mesesRecentes >= 1 ? 'prata' : 'risco';
        const totalUlt3 = ultimos3Meses.reduce((soma, m) => soma + (reg.valorPorMes[m] || 0), 0);
        mediaMensal = Math.round((totalUlt3 / 3) * 100) / 100;
        faixa = calcularFaixa(mediaMensal);
      }
      contagem[etiqueta]++;
      contagemFaixa[faixa]++;
      const ultimaCompra = reg ? (reg.ultimaEmissao || '').substring(0, 10) : '';
      const qtdNotas = reg ? reg.qtdNotas : 0;
      const pipe = pipelinePorCliente[c.id] || { potencialValor: 0, potencialQtd: 0, perdidoValor: 0, perdidoQtd: 0, ganhoValor: 0, ganhoQtd: 0 };
      const potencialValor = Math.round(pipe.potencialValor * 100) / 100;
      const perdidoValor = Math.round(pipe.perdidoValor * 100) / 100;
      const ganhoValor = Math.round(pipe.ganhoValor * 100) / 100;

      const mudou = c.etiqueta_recorrencia !== etiqueta
        || (c.faixa_faturamento || 'none') !== faixa
        || (c.valor_recorrente_mensal || 0) !== mediaMensal
        || (c.recorrencia_qtd_notas || 0) !== qtdNotas
        || (c.recorrencia_ultima_compra || '') !== ultimaCompra
        || (c.pipeline_potencial_valor || 0) !== potencialValor
        || (c.pipeline_perdido_valor || 0) !== perdidoValor
        || (c.pipeline_ganho_valor || 0) !== ganhoValor
        || (c.pipeline_potencial_qtd || 0) !== pipe.potencialQtd
        || (c.pipeline_perdido_qtd || 0) !== pipe.perdidoQtd
        || (c.pipeline_ganho_qtd || 0) !== pipe.ganhoQtd;
      if (mudou) {
        updates.push({
          id: c.id,
          etiqueta_recorrencia: etiqueta,
          faixa_faturamento: faixa,
          valor_recorrente_mensal: mediaMensal,
          recorrencia_qtd_notas: qtdNotas,
          recorrencia_ultima_compra: ultimaCompra,
          recorrencia_atualizada_em: nowIso,
          pipeline_potencial_valor: potencialValor,
          pipeline_potencial_qtd: pipe.potencialQtd,
          pipeline_perdido_valor: perdidoValor,
          pipeline_perdido_qtd: pipe.perdidoQtd,
          pipeline_ganho_valor: ganhoValor,
          pipeline_ganho_qtd: pipe.ganhoQtd
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
      contagemFaixa,
      orcamentosConsiderados: orcamentos.length,
      mesesReferencia: ultimos3Meses
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});