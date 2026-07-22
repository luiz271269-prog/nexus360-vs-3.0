import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Análise de itens de orçamentos por família de produto:
// recorrência (nº orçamentos, clientes distintos) x perdido/aberto/ganho.
// Persiste 1 MetricSnapshot por dia (tipo analise_produtos) para série histórica.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const orcs = await base44.asServiceRole.entities.Orcamento.list('-updated_date', 2000);
    const PERDIDO = ['rejeitado', 'vencido'];
    const GANHO = ['aprovado'];

    const norm = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const familia = (nome) => {
      const t = norm(nome).split(' ').filter((w) => w.length > 2);
      return t.slice(0, 2).join(' ') || '(sem nome)';
    };

    const stats = {};
    let orcsComItens = 0, orcsSemItens = 0, totalItens = 0;
    let totPerdido = 0, totAberto = 0, totGanho = 0;

    for (const o of orcs) {
      const prods = Array.isArray(o.produtos) ? o.produtos : [];
      if (prods.length === 0) { orcsSemItens++; continue; }
      orcsComItens++;
      const bucket = PERDIDO.includes(o.status) ? 'perdido' : GANHO.includes(o.status) ? 'ganho' : 'aberto';
      for (const p of prods) {
        totalItens++;
        const f = familia(p.nome || p.descricao);
        if (!stats[f]) {
          stats[f] = {
            familia: f, orcIds: new Set(), clientes: new Set(),
            perdidoValor: 0, perdidoQtd: 0, abertoValor: 0, abertoQtd: 0, ganhoValor: 0, ganhoQtd: 0
          };
        }
        const s = stats[f];
        s.orcIds.add(o.id);
        if (o.cliente_id) s.clientes.add(o.cliente_id);
        const v = Number(p.valor_total) || 0;
        s[bucket + 'Valor'] += v;
        s[bucket + 'Qtd']++;
        if (bucket === 'perdido') totPerdido += v;
        else if (bucket === 'ganho') totGanho += v;
        else totAberto += v;
      }
    }

    const familias = Object.values(stats).map((s) => {
      const totalValor = s.perdidoValor + s.abertoValor + s.ganhoValor;
      const fechado = s.perdidoValor + s.ganhoValor;
      return {
        familia: s.familia,
        orcamentos: s.orcIds.size,
        clientesDistintos: s.clientes.size,
        perdidoValor: Math.round(s.perdidoValor),
        perdidoQtd: s.perdidoQtd,
        abertoValor: Math.round(s.abertoValor),
        abertoQtd: s.abertoQtd,
        ganhoValor: Math.round(s.ganhoValor),
        ganhoQtd: s.ganhoQtd,
        totalValor: Math.round(totalValor),
        taxaConversao: fechado > 0 ? Math.round((s.ganhoValor / fechado) * 100) : null
      };
    }).sort((a, b) => b.totalValor - a.totalValor);

    const resumo = {
      totalOrcs: orcs.length,
      orcsComItens,
      orcsSemItens,
      totalItens,
      familiasDistintas: familias.length,
      perdidoValor: Math.round(totPerdido),
      abertoValor: Math.round(totAberto),
      ganhoValor: Math.round(totGanho)
    };

    // Persistir snapshot diário (idempotente por dia)
    const hoje = new Date().toISOString().substring(0, 10);
    let snapshotCriado = false;
    try {
      const existentes = await base44.asServiceRole.entities.MetricSnapshot.filter({ tipo_metrica: 'analise_produtos' }, '-timestamp', 1);
      const jaTemHoje = existentes.length > 0 && String(existentes[0].timestamp || '').substring(0, 10) === hoje;
      if (!jaTemHoje) {
        await base44.asServiceRole.entities.MetricSnapshot.create({
          timestamp: new Date().toISOString(),
          tipo_metrica: 'analise_produtos',
          entidade_relacionada: 'Sistema',
          metricas: { receita_gerada: resumo.ganhoValor },
          periodo: { tipo: 'diario' },
          detalhe: { resumo, topFamilias: familias.slice(0, 30) }
        });
        snapshotCriado = true;
      }
    } catch (e) {
      console.warn('Snapshot não persistido:', e.message);
    }

    return Response.json({ success: true, resumo, familias: familias.slice(0, 100), snapshotCriado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});