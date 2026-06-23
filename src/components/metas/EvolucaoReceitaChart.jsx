import React from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from "recharts";
import BrutalCard from "./BrutalCard";

const fmtCompacto = (v) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
};

// Gráfico de barras da evolução de receita mensal (neo-brutalista).
export default function EvolucaoReceitaChart({ dados = [] }) {
  return (
    <BrutalCard className="p-4 bg-white">
      <h2 className="font-black text-xl uppercase mb-4 bg-black text-white inline-block px-3 py-1">
        Evolução da Receita
      </h2>
      {dados.length === 0 ? (
        <p className="font-bold text-black/50 py-12 text-center">Sem dados de receita no período.</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="mes"
                tick={{ fontWeight: 900, fontSize: 12, fill: "#000" }}
                axisLine={{ stroke: "#000", strokeWidth: 3 }}
                tickLine={false}
              />
              <YAxis hide />
              <Bar dataKey="receita" stroke="#000" strokeWidth={3} isAnimationActive={false}>
                {dados.map((_, i) => (
                  <Cell key={i} fill="#f97316" />
                ))}
                <LabelList
                  dataKey="receita"
                  position="top"
                  formatter={fmtCompacto}
                  style={{ fontWeight: 900, fontSize: 11, fill: "#000" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </BrutalCard>
  );
}