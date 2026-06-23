import React from "react";
import BrutalCard from "./BrutalCard";

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Cartão de atingimento de meta de um vendedor (estilo neo-brutalista).
export default function MetaVendedorCard({ nome, realizado, meta }) {
  const pct = meta > 0 ? Math.round((realizado / meta) * 100) : 0;
  const pctBar = Math.min(pct, 100);

  // cor chapada conforme atingimento
  let barColor = "bg-red-500";
  let badgeColor = "bg-red-400";
  if (pct >= 100) { barColor = "bg-green-500"; badgeColor = "bg-green-400"; }
  else if (pct >= 70) { barColor = "bg-yellow-400"; badgeColor = "bg-yellow-300"; }
  else if (pct >= 40) { barColor = "bg-orange-400"; badgeColor = "bg-orange-300"; }

  return (
    <BrutalCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-lg uppercase truncate pr-2">{nome}</h3>
        <span className={`${badgeColor} border-2 border-black px-2 py-0.5 font-black text-sm whitespace-nowrap`}>
          {pct}%
        </span>
      </div>

      {/* Barra de progresso brutalista */}
      <div className="border-4 border-black h-7 bg-white relative">
        <div className={`${barColor} h-full`} style={{ width: `${pctBar}%` }} />
      </div>

      <div className="flex items-center justify-between mt-3 font-bold text-sm">
        <div>
          <p className="text-[10px] uppercase text-black/60">Realizado</p>
          <p className="font-black">{fmt(realizado)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-black/60">Meta</p>
          <p className="font-black">{fmt(meta)}</p>
        </div>
      </div>
    </BrutalCard>
  );
}