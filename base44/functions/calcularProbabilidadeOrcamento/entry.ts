import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Ao gravar um orçamento: calcula o % de possibilidade de fechamento
// baseado no histórico das famílias de produtos (orçamentos ganhos/perdidos + vendas efetivadas).
// Atualiza o campo `probabilidade` do orçamento e registra a métrica no historico_interno.

const norm = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const familia = (nome) => {
  const t = norm(nome).split(' ').filter((w) => w.length > 2);
  return t.slice(0, 2).join(' ') || '(sem nome)';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isService = req.headers.get('X-Workflow-Trigger') === 'true' || (await base44.auth.me().catch(() => null));
    if (!isService) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orcamentoId = body.orcamento_id || body.event?.data?.id || body.data?.id;
    if (!orcamentoId) return Response.json({ error: 'orcamento_id obrigatório' }, { status: 400 });

    const orc = await base44.asServiceRole.entities.Orcamento.get(orcamentoId);
    const prods = Array.isArray(orc?.produtos) ? orc.produtos : [];
    if (prods.length === 0) return Response.json({ success: true, skipped: 'orçamento sem itens' });

    // Histórico: orçamentos decididos + vendas efetivadas por família
    const [orcs, vendas] = await Promise.all([
      base44.asServiceRole.entities.Orcamento.list('-updated_date', 2000),
      base44.asServiceRole.entities.Venda.list('-data_venda', 2000)
    ]);
    const PERDIDO = ['rejeitado', 'vencido'];

    const hist = {}; // familia -> { ganhos, perdidos, vendas }
    const ensure = (f) => (hist[f] ||= { ganhos: 0, perdidos: 0, vendas: 0 });

    for (const o of orcs) {
      if (o.id === orcamentoId) continue;
      const bucket = PERDIDO.includes(o.status) ? 'perdidos' : o.status === 'aprovado' ? 'ganhos' : null;
      if (!bucket) continue;
      for (const p of (Array.isArray(o.produtos) ? o.produtos : [])) {
        ensure(familia(p.nome || p.descricao))[bucket]++;
      }
    }
    for (const v of vendas) {
      if (v.status === 'Cancelado') continue;
      for (const p of (Array.isArray(v.produtos) ? v.produtos : [])) {
        ensure(familia(p.nome || p.descricao)).vendas++;
      }
    }

    // Probabilidade ponderada pelo valor de cada item do orçamento
    let somaProbPonderada = 0, somaPesos = 0;
    const detalheFamilias = [];
    for (const p of prods) {
      const f = familia(p.nome || p.descricao);
      const h = hist[f];
      const fechamentos = h ? h.ganhos + h.vendas : 0;
      const decididos = h ? fechamentos + h.perdidos : 0;
      const prob = decididos > 0 ? (fechamentos / decididos) * 100 : null;
      const peso = Number(p.valor_total) || 1;
      if (prob !== null) {
        somaProbPonderada += prob * peso;
        somaPesos += peso;
      }
      detalheFamilias.push({ familia: f, probFechamento: prob === null ? null : Math.round(prob), historico: h || null });
    }

    const percentual = somaPesos > 0 ? Math.round(somaProbPonderada / somaPesos) : null;
    const probabilidade = percentual === null ? 'Média' : percentual >= 60 ? 'Alta' : percentual >= 30 ? 'Média' : 'Baixa';

    const historico = Array.isArray(orc.historico_interno) ? orc.historico_interno : [];
    const texto = percentual === null
      ? `🤖 Métrica de fechamento: sem histórico suficiente para as famílias deste orçamento — probabilidade mantida como "${probabilidade}".`
      : `🤖 Métrica de fechamento: ${percentual}% de possibilidade (base: vendas efetivadas + orçamentos decididos por família de produto) → probabilidade "${probabilidade}".`;

    await base44.asServiceRole.entities.Orcamento.update(orcamentoId, {
      probabilidade,
      probabilidade_percentual: percentual,
      historico_interno: [
        ...historico,
        { id: `prob-${Date.now()}`, autor_nome: 'Nexus IA', data: new Date().toISOString(), tipo: 'sistema', texto }
      ]
    });

    return Response.json({ success: true, orcamento_id: orcamentoId, percentual, probabilidade, familias: detalheFamilias });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});