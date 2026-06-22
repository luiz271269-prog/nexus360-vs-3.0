import { useMemo } from "react";
import { DollarSign, Users, ShoppingBag, TrendingUp, Award } from "lucide-react";

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// Métricas de VENDAS derivadas das Notas Fiscais reais do Neural Fin Flow (conexão online).
// Não faz nenhuma chamada nova — consome as notas já filtradas pelo período no Dashboard.
export default function MetricasVendasNF({ notas = [], modoAnual = false }) {
  const m = useMemo(() => {
    const faturado = notas.reduce((s, n) => s + (n.valor_total || 0), 0);
    const recebido = notas.reduce((s, n) => s + (n.valor_recebido || 0), 0);
    const qtdVendas = notas.length;
    const ticketMedio = qtdVendas > 0 ? faturado / qtdVendas : 0;

    // Clientes ativos = clientes distintos com NF no período
    const clientesSet = new Set(
      notas.map(n => (n.cliente || '').trim().toLowerCase()).filter(Boolean)
    );
    const clientesAtivos = clientesSet.size;

    // Ranking por vendedor
    const porVendedor = {};
    notas.forEach(n => {
      const v = (n.vendedor || n.vendedor_nome || 'Sem vendedor').trim() || 'Sem vendedor';
      if (!porVendedor[v]) porVendedor[v] = { vendedor: v, faturado: 0, qtd: 0 };
      porVendedor[v].faturado += n.valor_total || 0;
      porVendedor[v].qtd++;
    });
    const ranking = Object.values(porVendedor).sort((a, b) => b.faturado - a.faturado);

    return { faturado, recebido, qtdVendas, ticketMedio, clientesAtivos, ranking };
  }, [notas]);

  const cards = [
    { titulo: 'Vendas (NFs)', valor: m.qtdVendas, sub: modoAnual ? 'no ano' : 'no mês', cor: 'from-orange-700 to-orange-600', icon: ShoppingBag },
    { titulo: 'Faturamento', valor: fmt(m.faturado), sub: `${fmt(m.recebido)} recebido`, cor: 'from-emerald-800 to-emerald-700', icon: DollarSign },
    { titulo: 'Ticket Médio', valor: fmt(m.ticketMedio), sub: 'por venda', cor: 'from-indigo-800 to-indigo-700', icon: TrendingUp },
    { titulo: 'Clientes Ativos', valor: m.clientesAtivos, sub: 'com NF no período', cor: 'from-purple-800 to-purple-700', icon: Users },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700">
      <h2 className="text-base font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-amber-400" />
        Métricas de Vendas — Neural Fin Flow
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.cor} rounded-xl p-4 text-white`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs opacity-80">{c.titulo}</span>
              <c.icon className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-xl font-bold">{c.valor}</p>
            <p className="text-xs opacity-70 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Ranking por vendedor */}
      {m.ranking.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-400" /> Faturamento por vendedor
          </p>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {m.ranking.map((r, i) => (
              <div key={r.vendedor} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>{i + 1}º</span>
                  <span className="text-slate-200 truncate">{r.vendedor}</span>
                  <span className="text-slate-500 text-xs">({r.qtd})</span>
                </div>
                <span className="text-emerald-400 font-semibold flex-shrink-0">{fmt(r.faturado)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}