import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, X, Trash2, Copy, Check } from "lucide-react";

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ListaSelecaoProdutos({ itens, onRemover, onLimpar }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!itens.length) return null;

  const total = itens.reduce((s, i) => s + (i.preco_venda || 0), 0);

  const copiar = async () => {
    const linhas = itens.map((i, n) => `${n + 1}. ${i.nome}\n${fmtBRL(i.preco_venda)}`);
    const texto = [
      "*Minha lista de interesse*",
      "",
      linhas.join("\n\n"),
      "",
      `*Total: ${fmtBRL(total)}*`,
    ].join("\n");
    // Versão com imagens (cola em e-mail, Word, Docs). Onde só há texto, cai no fallback.
    const html = `<div style="font-family:sans-serif">
      <h3 style="color:#ea580c">Minha lista de interesse</h3>
      ${itens.map((i) => `<div style="display:flex;gap:12px;align-items:center;margin:10px 0">
        ${i.imagem ? `<img src="${i.imagem}" width="64" height="64" style="object-fit:contain" />` : ""}
        <div><div>${i.nome}</div><b style="color:#047857">${fmtBRL(i.preco_venda)}</b></div>
      </div>`).join("")}
      <p><b>Total: ${fmtBRL(total)}</b></p>
    </div>`;

    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([
          new window.ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([texto], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(texto);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* indisponível */ }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-xl shadow-orange-500/30 hover:scale-105 transition-transform"
      >
        <ClipboardList className="w-5 h-5" />
        <span className="text-sm">{itens.length} {itens.length === 1 ? "item selecionado" : "itens selecionados"}</span>
        <span className="text-sm font-bold bg-white/20 rounded-full px-2.5 py-0.5">{fmtBRL(total)}</span>
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-orange-600">Minha lista de interesse</DialogTitle>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100">
            {itens.map((i) => (
              <div key={i.chave} className="flex items-center gap-3 py-2.5">
                <div className="w-12 h-12 rounded-lg bg-slate-50 flex-shrink-0 overflow-hidden">
                  {i.imagem && <img src={i.imagem} alt={i.nome} className="w-full h-full object-contain" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate" title={i.nome}>{i.nome}</p>
                  <p className="text-sm font-bold text-emerald-700">{fmtBRL(i.preco_venda)}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => onRemover(i.chave)} className="text-slate-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-lg font-bold text-emerald-700">{fmtBRL(total)}</span>
          </div>

          <div className="flex gap-2">
            <Button onClick={copiar} className="flex-1 bg-orange-500 hover:bg-orange-600 gap-2">
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? "Copiado!" : "Copiar lista"}
            </Button>
            <Button variant="outline" onClick={onLimpar} className="gap-2 text-red-600 border-red-200">
              <Trash2 className="w-4 h-4" />
              Limpar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}