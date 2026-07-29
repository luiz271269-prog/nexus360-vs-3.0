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
      const termo = [produto.marca, produto.modelo || produto.nome].filter(Boolean).join(" ");
      const { data } = await base44.functions.buscarProdutosFornecedor({ q: termo });
      const achado = (data?.produtos || []).find((p) => p.imagem || p.imagem_url);
      const url = achado?.imagem || achado?.imagem_url;
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