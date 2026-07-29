import React from "react";
import { Badge } from "@/components/ui/badge";
import { ImageOff, Check, Plus } from "lucide-react";

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function LinhaProdutoFornecedor({ produto, onAbrir, mostrarCusto = false, precoVenda, precoCusto, selecionado = false, onToggleSelecao }) {
  return (
    <div
      onClick={() => onAbrir?.(produto)}
      className={`flex items-center gap-3 px-3 py-2 bg-white rounded-lg border-2 cursor-pointer transition-colors ${
        selecionado ? "border-emerald-500 bg-emerald-50/40" : "border-slate-200 hover:border-orange-400"
      }`}
    >
      <div className="w-12 h-12 flex-shrink-0 bg-slate-50 rounded-md flex items-center justify-center overflow-hidden">
        {produto.imagem ? (
          <img src={produto.imagem} alt={produto.nome} loading="lazy" className="w-full h-full object-contain" />
        ) : (
          <ImageOff className="w-5 h-5 text-slate-300" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate" title={produto.nome}>{produto.nome}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px]">{produto.loja_nome}</Badge>
          {!produto.disponivel && <Badge className="bg-red-500 text-white text-[10px]">Esgotado</Badge>}
          {mostrarCusto && <span className="text-[11px] text-slate-400">Fornecedor: {fmtBRL(precoCusto)}</span>}
        </div>
      </div>

      <p className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmtBRL(precoVenda)}</p>

      {onToggleSelecao && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelecao(produto); }}
          title={selecionado ? "Remover da minha lista" : "Adicionar à minha lista"}
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            selecionado ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-orange-500 hover:text-white"
          }`}
        >
          {selecionado ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}