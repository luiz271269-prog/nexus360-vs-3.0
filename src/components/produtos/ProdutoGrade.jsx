import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageOff, ShoppingCart, Pencil } from "lucide-react";

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ProdutoGrade({ produtos, onEdit, onAddToCart }) {
  if (!produtos.length) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Nenhum produto encontrado.</div>;
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {produtos.map((p) => (
          <div key={p.id} className="group bg-white rounded-xl border-2 border-slate-200 hover:border-orange-400 hover:shadow-lg transition-all overflow-hidden flex flex-col">
            <div className="aspect-square w-full bg-slate-50 flex items-center justify-center overflow-hidden">
              {p.imagem_url || p.foto_url ? (
                <img src={p.imagem_url || p.foto_url} alt={p.nome} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
              ) : (
                <ImageOff className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <div className="p-3 flex flex-col gap-1 flex-1">
              <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2" title={p.nome}>{p.nome}</p>
              {p.marca && <Badge variant="outline" className="w-fit text-[10px]">{p.marca}</Badge>}
              <p className="text-base font-bold text-emerald-700 mt-auto pt-2">{fmtBRL(p.preco_venda)}</p>
              <div className="flex gap-1.5 pt-1">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => onEdit?.(p)}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
                <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600" onClick={() => onAddToCart?.(p)}>
                  <ShoppingCart className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}