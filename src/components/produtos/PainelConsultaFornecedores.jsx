import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, RefreshCw, Search, Store, Loader2, MapPin } from "lucide-react";

const CORES_LOJA = {
  matriz: "bg-orange-100 text-orange-700 border-orange-300",
  tubarao: "bg-blue-100 text-blue-700 border-blue-300",
  garopaba: "bg-emerald-100 text-emerald-700 border-emerald-300",
  criciuma: "bg-purple-100 text-purple-700 border-purple-300",
};

const fmtBRL = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PainelConsultaFornecedores() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [margem, setMargem] = useState(1.5);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

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
    produtos.forEach((p) => map.set(p.loja_id, p.loja_nome));
    return Array.from(map, ([id, nome]) => ({ id, nome }));
  }, [produtos]);

  const filtrados = useMemo(() => {
    return produtos.filter((p) => {
      const matchBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase());
      const matchLoja = lojaFiltro === "todas" || p.loja_id === lojaFiltro;
      return matchBusca && matchLoja;
    });
  }, [produtos, busca, lojaFiltro]);

  const margemNum = parseFloat(String(margem).replace(",", ".")) || 0;

  return (
    <div className="flex flex-col h-full gap-3 p-3">
      {/* Barra de filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-white/80 border-2 border-orange-200 rounded-xl p-3 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-orange-500" />
          <h2 className="font-bold text-slate-800 whitespace-nowrap">Produtos do Fornecedor</h2>
          <Badge variant="outline" className="text-xs">{filtrados.length} itens</Badge>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto..."
            className="pl-8 h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={lojaFiltro === "todas" ? "default" : "outline"}
            className={lojaFiltro === "todas" ? "bg-orange-500 text-white h-8 text-xs" : "h-8 text-xs border-orange-300"}
            onClick={() => setLojaFiltro("todas")}
          >
            Todas as lojas
          </Button>
          {lojas.map((l) => (
            <Button
              key={l.id}
              size="sm"
              variant={lojaFiltro === l.id ? "default" : "outline"}
              className={lojaFiltro === l.id ? "bg-orange-500 text-white h-8 text-xs" : "h-8 text-xs border-orange-300"}
              onClick={() => setLojaFiltro(l.id)}
            >
              {l.nome}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <span className="text-xs text-slate-500 whitespace-nowrap">Margem %</span>
          <Input
            type="text"
            inputMode="decimal"
            value={margem}
            onChange={(e) => setMargem(e.target.value)}
            className="w-16 h-8 text-sm text-center"
          />
          <Button size="sm" variant="outline" onClick={carregar} disabled={loading} className="h-8 text-xs border-orange-300 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {erro && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-lg px-3 py-2 flex-shrink-0">
          ⚠️ {erro}
        </div>
      )}

      {/* Tabela */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border-2 border-orange-200 bg-white shadow-lg">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm">Consultando lojas do fornecedor...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Nenhum produto encontrado.
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-orange-50 z-10">
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Local</span>
                </TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead className="text-right">Preço Fornecedor</TableHead>
                <TableHead className="text-right">Venda (+{margemNum}%)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p, idx) => (
                <TableRow key={`${p.loja_id}-${idx}`} className="hover:bg-orange-50/50">
                  <TableCell>
                    {p.imagem ? (
                      <img src={p.imagem} alt={p.nome} className="w-10 h-10 rounded-md object-cover border border-slate-200" loading="lazy" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center">
                        <Store className="w-4 h-4 text-slate-300" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-slate-800 max-w-md">{p.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${CORES_LOJA[p.loja_id] || "bg-slate-100 text-slate-700"}`}>
                      {p.loja_nome}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.disponivel ? (
                      <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs">Disponível</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs">Esgotado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">{fmtBRL(p.preco_fornecedor)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-700">
                    {fmtBRL(p.preco_fornecedor * (1 + margemNum / 100))}
                  </TableCell>
                  <TableCell>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" title="Ver no site do fornecedor">
                      <ExternalLink className="w-4 h-4 text-orange-500 hover:text-orange-700" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {atualizadoEm && (
        <p className="text-[11px] text-slate-400 flex-shrink-0">
          Atualizado em {new Date(atualizadoEm).toLocaleString("pt-BR")} — dados ao vivo do site do fornecedor.
        </p>
      )}
    </div>
  );
}