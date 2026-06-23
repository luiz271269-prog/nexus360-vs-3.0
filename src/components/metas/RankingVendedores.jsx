import React from "react";
import BrutalCard from "./BrutalCard";
import { Crown, Medal } from "lucide-react";

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pctDe = (r, m) => (m > 0 ? Math.round((r / m) * 100) : 0);

// Cores chapadas do pódio (1º, 2º, 3º)
const PODIO = [
  { bg: "bg-yellow-300", label: "1º", icon: Crown },
  { bg: "bg-slate-300", label: "2º", icon: Medal },
  { bg: "bg-orange-300", label: "3º", icon: Medal },
];

// Ranking de performance neo-brutalista: pódio dos 3 primeiros + tabela meta × realizado.
export default function RankingVendedores({ vendedores = [] }) {
  if (vendedores.length === 0) {
    return (
      <BrutalCard className="p-6 bg-white">
        <p className="font-bold text-black/60 text-center">
          Sem vendedores para ranquear. Configure as metas em "Metas de Vendas".
        </p>
      </BrutalCard>
    );
  }

  const top3 = vendedores.slice(0, 3);
  const restante = vendedores.slice(3);

  return (
    <div className="space-y-4">
      {/* Pódio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((v, i) => {
          const p = PODIO[i];
          const pct = pctDe(v.realizado, v.meta);
          return (
            <BrutalCard key={v.nome} className={`p-4 ${p.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="bg-black text-white font-black px-2 py-0.5 text-lg">{p.label}</span>
                <p.icon className="w-7 h-7" />
              </div>
              <h3 className="font-black text-lg uppercase truncate">{v.nome}</h3>
              <p className="font-black text-2xl mt-1">{fmt(v.realizado)}</p>
              <p className="font-bold text-xs text-black/70 mt-1">
                Meta {fmt(v.meta)} · <span className={pct >= 100 ? "text-green-700" : ""}>{pct}%</span>
              </p>
            </BrutalCard>
          );
        })}
      </div>

      {/* Tabela do restante */}
      {restante.length > 0 && (
        <BrutalCard className="p-0 bg-white overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-black text-white">
              <tr className="font-black uppercase text-xs">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Vendedor</th>
                <th className="px-4 py-2 text-right">Realizado</th>
                <th className="px-4 py-2 text-right">Meta</th>
                <th className="px-4 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {restante.map((v, i) => {
                const pct = pctDe(v.realizado, v.meta);
                return (
                  <tr key={v.nome} className="border-t-2 border-black font-bold text-sm">
                    <td className="px-4 py-2 font-black">{i + 4}º</td>
                    <td className="px-4 py-2 truncate">{v.nome}</td>
                    <td className="px-4 py-2 text-right font-black">{fmt(v.realizado)}</td>
                    <td className="px-4 py-2 text-right text-black/60">{fmt(v.meta)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`px-2 py-0.5 border-2 border-black font-black ${pct >= 100 ? "bg-green-400" : pct >= 70 ? "bg-yellow-300" : "bg-red-300"}`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </BrutalCard>
      )}
    </div>
  );
}