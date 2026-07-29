import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2 } from "lucide-react";

/**
 * Busca a imagem real do item nos sites dos fornecedores (sob demanda, 1 produto por clique).
 * Não roda em lote e não consulta o banco em massa.
 */
export default function BotaoBuscarImagemProduto({ produto, onAtualizado }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  const buscar = async (e) => {
    e.stopPropagation();
    setCarregando(true);
    setErro(false);
    try {
      const nome = (produto.nome || "").replace(/[^\w\s.]/g, " ").replace(/\s+/g, " ").trim();
      const palavras = nome.split(" ");
      // Vai do termo mais específico para o mais genérico até achar resultado
      const termos = [
        nome,
        palavras.slice(0, 4).join(" "),
        [produto.marca, palavras.find((w) => /\d/.test(w))].filter(Boolean).join(" "),
        [produto.marca, palavras[0]].filter(Boolean).join(" "),
      ].filter((t, i, arr) => t && t.length > 2 && arr.indexOf(t) === i);

      let url = null;
      for (const termo of termos) {
        const { data } = await base44.functions.buscarProdutosFornecedor({ q: termo });
        const lista = (data?.produtos || []).filter((p) => p.imagem);
        if (!lista.length) continue;
        // escolhe o item com maior sobreposição de palavras com o nome do produto
        const chaves = palavras.filter((w) => w.length > 2).map((w) => w.toLowerCase());
        const melhor = lista
          .map((p) => ({ p, score: chaves.filter((k) => (p.nome || "").toLowerCase().includes(k)).length }))
          .sort((a, b) => b.score - a.score)[0];
        url = melhor?.p?.imagem;
        if (url) break;
      }
      if (!url) { setErro(true); return; }
      await base44.entities.Produto.update(produto.id, { imagem_url: url });
      onAtualizado?.(produto.id, url);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={buscar}
      disabled={carregando}
      className={`h-7 text-[11px] gap-1 ${erro ? "border-red-300 text-red-600" : ""}`}
      title="Buscar imagem real nos sites dos fornecedores"
    >
      {carregando ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
      {carregando ? "Buscando..." : erro ? "Não achei" : "Buscar imagem"}
    </Button>
  );
}