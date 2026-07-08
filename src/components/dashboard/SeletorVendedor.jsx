import React from "react";
import { getNomeExibicao } from "@/components/lib/vendedorSync";
import { User } from "lucide-react";

export default function SeletorVendedor({ vendedores, valor, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <User className="w-4 h-4 text-orange-400 flex-shrink-0" />
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="p-2 border border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-700 text-white text-sm max-w-[180px]"
      >
        <option value="todos">Todos os Vendedores</option>
        {(vendedores || []).map((v) => (
          <option key={v.id} value={v.full_name || v.nome || v.email}>
            {getNomeExibicao(v)}
          </option>
        ))}
      </select>
    </div>
  );
}