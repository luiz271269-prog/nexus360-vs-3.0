import React from "react";
import { Badge } from "@/components/ui/badge";
import { Eye, ImageOff } from "lucide-react";

const CORES_LOJA = {
  matriz: "bg-orange-100 text-orange-700 border-orange-300",
  tubarao: "bg-blue-100 text-blue-700 border-blue-300",
  garopaba: "bg-emerald-100 text-emerald-700 border-emerald-300",
  criciuma: "bg-purple-100 text-purple-700 border-purple-300",
};

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CardProdutoFornecedor({ produto, margem, onAbrir, mostrarCusto = false }) {
  const precoVenda = produto.preco_fornecedor * (1 + margem / 100);

  return (
    <button
      type="button"
      onClick={() => onAbrir?.(produto)}
      className="group w-full flex flex-col text-left bg-white rounded-xl border-2 border-slate-200 hover:border-orange-400 hover:shadow-lg transition-all overflow-hidden"
    >
      <div className="relative aspect-square w-full bg-slate-50 flex items-center justify-center overflow-hidden">
        {produto.imagem ? (
          <img
            src={produto.imagem}
            alt={produto.nome}
            loading="lazy"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <ImageOff className="w-8 h-8 text-slate-300" />
        )}
        <Badge className={`absolute top-2 left-2 text-[10px] border ${CORES_LOJA[produto.loja_id] || "bg-slate-100 text-slate-700"}`}>
          {produto.loja_nome}
        </Badge>
        {!produto.disponivel && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Badge className="bg-red-500 text-white text-xs">Esgotado</Badge>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1 w-full">
        <p
          className="text-sm font-semibold text-slate-800 leading-snug group-hover:text-orange-600"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          title={produto.nome}
        >
          {produto.nome}
        </p>
        <div className="mt-auto pt-2">
          {mostrarCusto && (
            <p className="text-[11px] text-slate-400">Fornecedor: {fmtBRL(produto.preco_fornecedor)}</p>
          )}
          <p className="text-base font-bold text-emerald-700 flex items-center gap-1">
            {fmtBRL(precoVenda)}
            <Eye className="w-3.5 h-3.5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </div>
      </div>
    </button>
  );
}