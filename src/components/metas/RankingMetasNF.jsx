import React, { useMemo } from "react";
import BrutalCard from "./BrutalCard";
import { notaPertenceAoVendedor, normalizarNome } from "@/components/dashboard/metasNfUtils";
import { getNomeExibicao } from "@/components/lib/vendedorSync";
import { Crown, AlertTriangle, TrendingUp, Users, ShoppingBag, Repeat, UserPlus } from "lucide-react";

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Corte abaixo do qual o vendedor "precisa de reforço"
const LIMITE_REFORCO = 50;

/**
 * Ranking visual de metas 100% baseado nas Notas Fiscais (fechamento real).
 * Fonte: notas (NFs já carregadas no PainelMetas) + users vendedores.
 * periodo: 'mensal' | 'semanal' — define a janela de tempo e qual meta comparar.
 */
export default function RankingMetasNF({ notas = [], vendedores = [], periodo = 'mensal' }) {
  const linhas = useMemo(() => {
    const hoje = new Date();

    // Janela do período
    let inicio;
    if (periodo === 'semanal') {
      const diaSemana = hoje.getDay(); // 0=dom
      inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - diaSemana);
      inicio.setHours(0, 0, 0, 0);
    } else {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }

    const dentroDoPeriodo = (n) => {
      const d = new Date(n.data_emissao || n.data || n.created_date);
      return !isNaN(d) && d >= inicio && d <= hoje;
    };

    const notasPeriodo = (notas || []).filter(dentroDoPeriodo);

    return vendedores.map((v) => {
      const nome = getNomeExibicao(v) || v.full_name || v.email || 'Vendedor';
      const meta = periodo === 'semanal' ? (v.meta_semanal || 0) : (v.meta_mensal || 0);

      const notasV = notasPeriodo.filter(n => notaPertenceAoVendedor(n.vendedor || n.vendedor_nome, v, vendedores));

      const realizado = notasV.reduce((s, n) => s + (n.valor_total || 0), 0);
      const qtdVendas = notasV.length;

      // Clientes distintos com NF (ativados no período)
      const clientesSet = new Set(
        notasV.map(n => n.cliente_cnpj_cpf || normalizarNome(n.cliente_nome || n.cliente)).filter(Boolean)
      );
      const clientesAtivados = clientesSet.size;

      // Recorrência dentro do período: clientes com 2+ NFs
      const comprasPorCliente = {};
      notasV.forEach(n => {
        const chave = n.cliente_cnpj_cpf || normalizarNome(n.cliente_nome || n.cliente);
        if (!chave) return;
        comprasPorCliente[chave] = (comprasPorCliente[chave] || 0) + 1;
      });
      const clientesRecorrentes = Object.values(comprasPorCliente).filter(q => q >= 2).length;

      const pct = meta > 0 ? Math.round((realizado / meta) * 100) : 0;

      return { id: v.id, nome, meta, realizado, qtdVendas, clientesAtivados, clientesRecorrentes, pct };
    })
    .sort((a, b) => b.pct - a.pct || b.realizado - a.realizado);
  }, [notas, vendedores, periodo]);

  if (linhas.length === 0) {
    return (
      <BrutalCard className="p-6 bg-white">
        <p className="font-bold text-black/60 text-center">
          Nenhum vendedor com meta configurada. Defina as metas em "Metas de Vendas".
        </p>
      </BrutalCard>
    );
  }

  const lider = linhas[0];

  return (
    <div className="space-y-3">
      {linhas.map((r, i) => {
        const ehLider = i === 0 && r.pct > 0;
        const precisaReforco = r.pct < LIMITE_REFORCO;
        const pctBar = Math.min(r.pct, 100);

        let barColor = "bg-red-500";
        if (r.pct >= 100) barColor = "bg-green-500";
        else if (r.pct >= 70) barColor = "bg-yellow-400";
        else if (r.pct >= LIMITE_REFORCO) barColor = "bg-orange-400";

        return (
          <BrutalCard
            key={r.id}
            className={`p-4 ${ehLider ? 'bg-yellow-100' : precisaReforco ? 'bg-red-50' : 'bg-white'}`}
          >
            {/* Cabeçalho: posição + nome + selo + % */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="bg-black text-white font-black px-2 py-0.5 text-sm flex-shrink-0">{i + 1}º</span>
                <h3 className="font-black text-base uppercase truncate">{r.nome}</h3>
                {ehLider && (
                  <span className="flex items-center gap-1 bg-yellow-300 border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase flex-shrink-0">
                    <Crown className="w-3 h-3" /> Líder
                  </span>
                )}
                {precisaReforco && !ehLider && (
                  <span className="flex items-center gap-1 bg-red-300 border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" /> Reforço
                  </span>
                )}
              </div>
              <span className={`border-2 border-black px-2 py-0.5 font-black text-sm whitespace-nowrap ${
                r.pct >= 100 ? 'bg-green-400' : r.pct >= 70 ? 'bg-yellow-300' : r.pct >= LIMITE_REFORCO ? 'bg-orange-300' : 'bg-red-300'
              }`}>
                {r.pct}%
              </span>
            </div>

            {/* Barra de progresso */}
            <div className="border-4 border-black h-6 bg-white relative mb-3">
              <div className={`${barColor} h-full transition-all`} style={{ width: `${pctBar}%` }} />
            </div>

            {/* Realizado × Meta */}
            <div className="flex items-center justify-between font-bold text-sm mb-3">
              <div>
                <p className="text-[10px] uppercase text-black/60">Realizado (NF)</p>
                <p className="font-black">{fmt(r.realizado)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-black/60">Meta {periodo}</p>
                <p className="font-black">{fmt(r.meta)}</p>
              </div>
            </div>

            {/* KPIs derivados das NFs */}
            <div className="grid grid-cols-3 gap-2">
              <Kpi icon={ShoppingBag} label="Vendas (NF)" valor={r.qtdVendas} />
              <Kpi icon={UserPlus} label="Clientes" valor={r.clientesAtivados} />
              <Kpi icon={Repeat} label="Recorrentes" valor={r.clientesRecorrentes} />
            </div>
          </BrutalCard>
        );
      })}
    </div>
  );
}

function Kpi({ icon: Icon, label, valor }) {
  return (
    <div className="border-2 border-black bg-white px-2 py-1.5 text-center">
      <Icon className="w-3.5 h-3.5 mx-auto mb-0.5" />
      <p className="font-black text-lg leading-none">{valor}</p>
      <p className="text-[9px] font-bold uppercase text-black/60 leading-tight mt-0.5">{label}</p>
    </div>
  );
}