import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, ImageOff } from "lucide-react";

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ModalDetalheFornecedor({ produto, margem, onClose, mostrarCusto = false }) {
  const [detalhe, setDetalhe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [imgAtiva, setImgAtiva] = useState(0);

  useEffect(() => {
    if (!produto) return;
    setLoading(true);
    setErro(null);
    setImgAtiva(0);
    base44.functions
      .invoke("buscarDetalheProdutoFornecedor", { url: produto.url, margem })
      .then(({ data }) => setDetalhe(data))
      .catch((e) => setErro(e?.message || "Não foi possível carregar o produto"))
      .finally(() => setLoading(false));
  }, [produto?.url, margem]);

  if (!produto) return null;

  const imagens = detalhe?.imagens?.length ? detalhe.imagens : (produto.imagem ? [produto.imagem] : []);
  const nome = detalhe?.nome || produto.nome;
  const precoFornecedor = detalhe?.preco_fornecedor ?? produto.preco_fornecedor;
  const precoVenda = precoFornecedor * (1 + (margem || 0) / 100);
  const disponivel = detalhe?.disponivel ?? produto.disponivel;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {loading ? (
          <div className="h-80 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
            <p className="text-sm">Carregando produto...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-0">
            {/* Galeria */}
            <div className="bg-slate-50 p-4 flex flex-col gap-3">
              <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-200">
                {imagens[imgAtiva] ? (
                  <img src={imagens[imgAtiva]} alt={nome} className="w-full h-full object-contain" />
                ) : (
                  <ImageOff className="w-10 h-10 text-slate-300" />
                )}
              </div>
              {imagens.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {imagens.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setImgAtiva(i)}
                      className={`w-14 h-14 flex-shrink-0 rounded-md border-2 overflow-hidden bg-white ${i === imgAtiva ? "border-orange-500" : "border-slate-200"}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dados para o vendedor */}
            <div className="p-5 flex flex-col gap-3">
              <Badge className="w-fit bg-orange-100 text-orange-700 border border-orange-300 text-[11px]">
                {produto.loja_nome}
              </Badge>
              <h2 className="text-xl font-bold text-slate-800 leading-snug">{nome}</h2>

              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Preço de venda</p>
                <p className="text-3xl font-bold text-emerald-700">{fmtBRL(precoVenda)}</p>
                {mostrarCusto && (
                  <p className="text-xs text-slate-500 mt-1">Custo fornecedor: {fmtBRL(precoFornecedor)} (+{margem}%)</p>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                {disponivel ? (
                  <Badge className="bg-emerald-500 text-white">Disponível</Badge>
                ) : (
                  <Badge className="bg-red-500 text-white">Esgotado</Badge>
                )}
                {typeof detalhe?.estoque_total === "number" && detalhe.estoque_total > 0 && (
                  <span className="text-slate-600 flex items-center gap-1">
                    <Package className="w-4 h-4 text-slate-400" /> {detalhe.estoque_total} em estoque
                  </span>
                )}
              </div>

              {detalhe?.variantes?.length > 1 && (
                <div className="border border-slate-200 rounded-lg divide-y">
                  {detalhe.variantes.map((v) => (
                    <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-700">{v.titulo || v.sku || "Variação"}</span>
                      <span className="font-semibold text-emerald-700">{fmtBRL(v.preco_venda)}</span>
                    </div>
                  ))}
                </div>
              )}

              {erro && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">{erro}</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}