import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ShoppingCart } from "lucide-react";
import FiltrosFornecedorSidebar from "./FiltrosFornecedorSidebar";
import CardProdutoFornecedor from "./CardProdutoFornecedor";
import ModalDetalheFornecedor from "./ModalDetalheFornecedor";

export default function PainelConsultaFornecedores() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [lojasSelecionadas, setLojasSelecionadas] = useState([]);
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);
  const [margem, setMargem] = useState("1.5");
  const [precoMin, setPrecoMin] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [produtoAberto, setProdutoAberto] = useState(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data } = await base44.functions.invoke("buscarProdutosFornecedor", {});
      setProdutos(Array.isArray(data?.produtos) ? data.produtos : []);
      setAtualizadoEm(data?.atualizado_em || null);
      if (data?.erros?.length) setErro(data.erros.join(" | "));
    } catch (e) {
      setErro(e?.message || "Falha ao consultar fornecedor");
      setProdutos([]);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const lojas = useMemo(() => {
    const map = new Map();
    produtos.forEach((p) => {
      const atual = map.get(p.loja_id) || { id: p.loja_id, nome: p.loja_nome, total: 0 };
      atual.total += 1;
      map.set(p.loja_id, atual);
    });
    return Array.from(map.values());
  }, [produtos]);

  const margemNum = parseFloat(String(margem).replace(",", ".")) || 0;
  const minNum = parseFloat(String(precoMin).replace(",", ".")) || 0;
  const maxNum = parseFloat(String(precoMax).replace(",", ".")) || Infinity;

  const filtrados = useMemo(() => {
    return produtos.filter((p) => {
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      if (lojasSelecionadas.length && !lojasSelecionadas.includes(p.loja_id)) return false;
      if (somenteDisponiveis && !p.disponivel) return false;
      if (p.preco_fornecedor < minNum || p.preco_fornecedor > maxNum) return false;
      return true;
    });
  }, [produtos, busca, lojasSelecionadas, somenteDisponiveis, minNum, maxNum]);

  const toggleLoja = (id) =>
    setLojasSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="flex flex-col lg:flex-row gap-3 p-3 h-full">
      <FiltrosFornecedorSidebar
        busca={busca} setBusca={setBusca}
        lojas={lojas} lojasSelecionadas={lojasSelecionadas} toggleLoja={toggleLoja}
        somenteDisponiveis={somenteDisponiveis} setSomenteDisponiveis={setSomenteDisponiveis}
        margem={margem} setMargem={setMargem}
        precoMin={precoMin} setPrecoMin={setPrecoMin}
        precoMax={precoMax} setPrecoMax={setPrecoMax}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl px-4 py-3 shadow-sm flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-orange-600 leading-tight">Catálogo do Fornecedor</h2>
            <p className="text-xs text-slate-500">{filtrados.length} produtos · margem +{margemNum}%</p>
          </div>
          <Button size="sm" variant="outline" onClick={carregar} disabled={loading} className="border-orange-300 gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {erro && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-lg px-3 py-2 flex-shrink-0">
            ⚠️ {erro}
          </div>
        )}

        {/* Grade de produtos */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              <p className="text-sm">Consultando lojas do fornecedor...</p>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Nenhum produto encontrado com esses filtros.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtrados.map((p, idx) => (
                <CardProdutoFornecedor key={`${p.loja_id}-${idx}`} produto={p} margem={margemNum} onAbrir={setProdutoAberto} />
              ))}
            </div>
          )}
        </div>

        {atualizadoEm && (
          <p className="text-[11px] text-slate-400 flex-shrink-0">
            Atualizado em {new Date(atualizadoEm).toLocaleString("pt-BR")} — dados ao vivo do site do fornecedor.
          </p>
        )}
      </div>

      <ModalDetalheFornecedor
        produto={produtoAberto}
        margem={margemNum}
        onClose={() => setProdutoAberto(null)}
      />
    </div>
  );
}