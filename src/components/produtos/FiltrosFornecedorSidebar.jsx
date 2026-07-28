import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Store, Tags, DollarSign } from "lucide-react";

export default function FiltrosFornecedorSidebar({
  busca, setBusca,
  lojas, lojasSelecionadas, toggleLoja,
  somenteDisponiveis, setSomenteDisponiveis,
  margem, setMargem,
  precoMin, setPrecoMin, precoMax, setPrecoMax,
}) {
  return (
    <div className="w-full lg:w-64 flex-shrink-0 space-y-3 overflow-y-auto">
      {/* Busca rápida */}
      <div className="rounded-xl overflow-hidden border-2 border-orange-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
          <Search className="w-4 h-4" />
          <span className="text-sm font-bold">Busca Rápida</span>
        </div>
        <div className="p-3">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome do produto..."
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Lojas */}
      <div className="rounded-xl overflow-hidden border-2 border-orange-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
          <Store className="w-4 h-4" />
          <span className="text-sm font-bold">Lojas</span>
        </div>
        <div className="p-3 space-y-2">
          {lojas.map((l) => (
            <label key={l.id} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={lojasSelecionadas.includes(l.id)}
                onCheckedChange={() => toggleLoja(l.id)}
              />
              <span className="text-sm text-slate-700 flex-1 group-hover:text-orange-600">{l.nome}</span>
              <span className="text-xs text-slate-400 font-medium">{l.total}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Disponibilidade + preço */}
      <div className="rounded-xl overflow-hidden border-2 border-orange-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
          <Tags className="w-4 h-4" />
          <span className="text-sm font-bold">Filtrar por</span>
        </div>
        <div className="p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={somenteDisponiveis} onCheckedChange={setSomenteDisponiveis} />
            <span className="text-sm text-slate-700">Somente disponíveis</span>
          </label>

          <div>
            <p className="text-xs text-slate-500 mb-1.5">Preço</p>
            <div className="flex items-center gap-1.5">
              <Input value={precoMin} onChange={(e) => setPrecoMin(e.target.value)} placeholder="De" className="h-8 text-xs" />
              <Input value={precoMax} onChange={(e) => setPrecoMax(e.target.value)} placeholder="Até" className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Margem de venda (%)
            </p>
            <Input value={margem} onChange={(e) => setMargem(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}