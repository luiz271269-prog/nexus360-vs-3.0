import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!apiKey) return Response.json({ error: 'NEURAL_FIN_API_KEY nao configurada' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    // mes: 'YYYY-MM' | 'all' (default = mês atual BRT)
    const agora = new Date(Date.now() - 3 * 3600 * 1000);
    const mesRef = body.mes || (agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0'));
    const todos = mesRef === 'all';

    const baseUrl = 'https://app.base44.com/api/apps/' + EXTERNAL_APP_ID + '/entities';
    const headers = { 'api_key': apiKey, 'Content-Type': 'application/json' };

    const fetchEntity = async (name, sort) => {
      const resp = await fetch(baseUrl + '/' + name + '?sort=' + encodeURIComponent(sort) + '&limit=1000', { headers });
      if (!resp.ok) {
        console.warn('[NeuralFin] ' + name + ' HTTP ' + resp.status);
        return [];
      }
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    };

    const [lancamentos, notas, titulos] = await Promise.all([
      fetchEntity('LancamentoBancario', '-data'),
      fetchEntity('NotaFiscal', '-data_emissao'),
      fetchEntity('TituloCobranca', '-data_vencimento')
    ]);

    const r2 = (v) => Math.round(v * 100) / 100;
    const noMes = (d) => todos || String(d || '').startsWith(mesRef);
    const sum = (arr, f) => arr.reduce((s, x) => s + Number(f(x) || 0), 0);

    // ── POSIÇÃO BANCÁRIA (LancamentoBancario) ────────
    const lancMes = lancamentos.filter(l => noMes(l.data));
    const entradas = sum(lancMes.filter(l => Number(l.valor) > 0), l => l.valor);
    const saidas = sum(lancMes.filter(l => Number(l.valor) < 0), l => Math.abs(Number(l.valor)));
    // Saldo atual por conta = saldo_apos do lançamento mais recente de cada conta
    const saldosPorConta = {};
    for (const l of lancamentos) {
      const conta = l.conta_bancaria || 'Conta principal';
      if (!(conta in saldosPorConta) && l.saldo_apos !== undefined && l.saldo_apos !== null) {
        saldosPorConta[conta] = { saldo: r2(Number(l.saldo_apos)), data: l.data };
      }
    }
    const posicaoBancaria = {
      contas: Object.entries(saldosPorConta).map(([conta, v]) => ({ conta, ...v })),
      saldo_total: r2(Object.values(saldosPorConta).reduce((s, v) => s + v.saldo, 0)),
      entradas: r2(entradas),
      saidas: r2(saidas)
    };

    // ── FATURAMENTO (NotaFiscal — padrão de auditoria) ──
    const STATUS_INVALIDOS = ['anulada', 'cancelado', 'cancelada'];
    const nfsMes = notas.filter(n => noMes(n.data_emissao));
    const validas = nfsMes.filter(n => !n.is_espelho_ci && !STATUS_INVALIDOS.includes(n.status));
    const porVendedor = {};
    validas.forEach(n => {
      const v = n.vendedor || 'Sem vendedor';
      porVendedor[v] = r2((porVendedor[v] || 0) + Number(n.valor_total || 0));
    });
    const faturamento = {
      total_faturado: r2(sum(validas, n => n.valor_total)),
      a_receber: r2(sum(validas, n => n.valor_aberto)),
      recebido: r2(sum(validas, n => n.valor_recebido)),
      qtd_nfs: validas.length,
      por_vendedor: Object.entries(porVendedor).sort((a, b) => b[1] - a[1])
        .map(([vendedor, valor]) => ({ vendedor, valor }))
    };

    // ── COBRANÇAS SICREDI (TituloCobranca) ───────────
    const titMes = titulos.filter(t => noMes(t.data_vencimento) || noMes(t.data_pagamento));
    const emitido = sum(titMes, t => t.valor_titulo);
    const recebido = sum(titMes.filter(t => t.data_pagamento || t.status === 'pago'), t => t.valor_pago || t.valor_titulo);
    const abertos = titMes.filter(t => !t.data_pagamento && t.status !== 'pago' && !STATUS_INVALIDOS.includes(t.status));
    const hojeStr = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const vencidos = abertos.filter(t => String(t.data_vencimento || '') < hojeStr);
    const cobrancas = {
      total_emitido: r2(emitido),
      recebido: r2(recebido),
      em_aberto: r2(sum(abertos, t => t.valor_titulo)),
      vencido: r2(sum(vencidos, t => t.valor_titulo)),
      qtd_vencidos: vencidos.length,
      taxa_recebimento: emitido > 0 ? r2((recebido / emitido) * 100) : 0
    };

    return Response.json({
      success: true,
      mes: mesRef,
      posicao_bancaria: posicaoBancaria,
      faturamento,
      cobrancas_sicredi: cobrancas
    });
  } catch (error) {
    console.error('[NeuralFin] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});