import React from "react";
import PainelConsultaFornecedores from "@/components/produtos/PainelConsultaFornecedores";

export default function VitrinePublica() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/40 to-red-50/20">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 shadow-lg">
        <h1 className="text-white font-bold text-base md:text-lg">NeuralTec — Vitrine de Produtos</h1>
        <p className="text-slate-300 text-xs">Busque, filtre e confira a disponibilidade em tempo real.</p>
      </header>
      <div className="h-[calc(100vh-64px)]">
        <PainelConsultaFornecedores publico />
      </div>
    </div>
  );
}