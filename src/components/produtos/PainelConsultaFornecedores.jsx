import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ShoppingCart, SlidersHorizontal } from "lucide-react";
import ModalConfigPrecificacaoLojas from "./ModalConfigPrecificacaoLojas";
import { CHAVE_PRECIFICACAO, configDaLoja, custoEmReais, precoDeVenda } from "./precificacaoFornecedor";
import FiltrosFornecedorSidebar from "./FiltrosFornecedorSidebar";
import CardProdutoFornecedor from "./CardProdutoFornecedor";
import ModalDetalheFornecedor from "./ModalDetalheFornecedor";
import MobileDrawer from "@/components/mobile/MobileDrawer";
import ListaSelecaoProdutos from "./ListaSelecaoProdutos";
import { classificarProdutos, contarPor } from "./classificarProdutoFornecedor";

export default function PainelConsultaFornecedores({ publico = false }) {
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
  const [tiposSelecionados, setTiposSelecionados] = useState([]);
  const [marcasSelecionadas, setMarcasSelecionadas] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [configMargemId, setConfigMargemId] = useState(null);
  const [precoConfigs, setPrecoConfigs] = useState({});
  const [precoConfigId, setPrecoConfigId] = useState(null);
  const [configAberta, setConfigAberta] = useState(false);
  const [cotacaoSite, setCotacaoSite] = useState(null);
  const [selecionados, setSelecionados] = useState([]);

  const chaveProduto = (p) => `${p.loja_id}::${p.nome}`;

  const toggleSelecao = (produto, precoVenda) => {
    const chave = chaveProduto(produto);
    setSelecionados((prev) =>
      prev.some((i) => i.chave === chave)
        ? prev.filter((i) => i.chave !== chave)
        : [...prev, { chave, nome: produto.nome, imagem: produto.imagem, preco_venda: precoVenda }]
    );
  };

  // Margem padrão do sistema (somente admin edita; todos consomem)
  useEffect(() => {
    if (publico) return; // vitrine pública: preço já vem calculado do servidor
    (async () => {
      try {
        const user = await base44.auth.me();
        setIsAdmin(user?.role === 'admin');
      } catch { setIsAdmin(false); }
      try {
        const [cfg] = await base44.entities.ConfiguracaoSistema.filter({ chave: 'margem_fornecedor_padrao' });
        if (cfg) {
          setConfigMargemId(cfg.id);
          if (cfg.valor?.margem != null) setMargem(String(cfg.valor.margem));
        }
      } catch (e) { console.warn('[FORNECEDOR] margem padrão não carregada', e); }
      try {
        const [cfg] = await base44.entities.ConfiguracaoSistema.filter({ chave: CHAVE_PRECIFICACAO });
        if (cfg) {
          setPrecoConfigId(cfg.id);
          setPrecoConfigs(cfg.valor?.lojas || {});
        }
      } catch (e) { console.warn('[FORNECEDOR] precificação não carregada', e); }
    })();
  }, []);

  const salvarPrecificacao = async (lojas) => {
    setPrecoConfigs(lojas);
    if (!isAdmin) return;
    const payload = {
      valor: { lojas },
      ultima_atualizacao: new Date().toISOString(),
    };
    try {
      if (precoConfigId) {
        await base44.entities.ConfiguracaoSistema.update(precoConfigId, payload);
      } else {
        const criado = await base44.entities.ConfiguracaoSistema.create({
          chave: CHAVE_PRECIFICACAO,
          categoria: 'geral',
          descricao: 'Precificação por loja do fornecedor (dólar, frete e margem)',
          ...payload,
        });
        setPrecoConfigId(criado.id);
      }
    } catch (e) { console.warn('[FORNECEDOR] falha ao salvar precificação', e); }
  };

  const salvarMargemPadrao = async (valor) => {
    setMargem(valor);
    if (!isAdmin) return;
    const num = parseFloat(String(valor).replace(",", "."));
    if (!Number.isFinite(num)) return;
    try {
      if (configMargemId) {
        await base44.entities.ConfiguracaoSistema.update(configMargemId, {
          valor: { margem: num },
          ultima_atualizacao: new Date().toISOString()
        });
      } else {
        const criado = await base44.entities.ConfiguracaoSistema.create({
          chave: 'margem_fornecedor_padrao',
          categoria: 'geral',
          valor: { margem: num },
          descricao: 'Margem padrão (%) aplicada aos produtos do fornecedor',
          ultima_atualizacao: new Date().toISOString()
        });
        setConfigMargemId(criado.id);
      }
    } catch (e) { console.warn('[FORNECEDOR] falha ao salvar margem padrão', e); }
  };

  const carregar = async (termo = "") => {
    setLoading(true);
    setErro(null);
    try {
      const { data } = await base44.functions.invoke("buscarProdutosFornecedor", { q: termo, publico });
      const brutos = Array.isArray(data?.produtos) ? data.produtos : [];
      // Mantém marca/categoria que já vêm do site (Visão VIP) e classifica o resto
      setProdutos(classificarProdutos(brutos).map((p, i) => ({
        ...p,
        marca: brutos[i]?.marca || p.marca,
        tipo_item: brutos[i]?.tipo_item || p.tipo_item,
      })));
      setCotacaoSite(data?.cotacao_dolar_site || null);
      setAtualizadoEm(data?.atualizado_em || null);
      if (data?.erros?.length) setErro(data.erros.join(" | "));
    } catch (e) {
      setErro(e?.message || "Falha ao consultar fornecedor");
      setProdutos([]);
    }
    setLoading(false);
  };

  // Busca no site do fornecedor (debounce) — vazio volta ao catálogo geral
  useEffect(() => {
    const t = setTimeout(() => carregar(busca.trim()), busca.trim() ? 600 : 0);
    return () => clearTimeout(t);
  }, [busca]);

  const lojas = useMemo(() => {
    const map = new Map();
    produtos.forEach((p) => {
      const atual = map.get(p.loja_id) || { id: p.loja_id, nome: p.loja_nome, total: 0 };
      atual.total += 1;
      map.set(p.loja_id, atual);
    });
    return Array.from(map.values());
  }, [produtos]);

  const tipos = useMemo(() => contarPor(produtos, "tipo_item"), [produtos]);
  const marcas = useMemo(() => contarPor(produtos, "marca"), [produtos]);

  // Ao trocar o resultado (nova busca), descarta filtros que não existem mais —
  // senão a combinação antiga zera a lista (ex.: "Informática" some no resultado da Visão VIP)
  useEffect(() => {
    if (!produtos.length) return;
    const manter = (sel, lista, campo) =>
      sel.filter((v) => lista.some((x) => (campo ? x[campo] : x.valor) === v));
    setLojasSelecionadas((prev) => manter(prev, lojas, "id"));
    setTiposSelecionados((prev) => manter(prev, tipos));
    setMarcasSelecionadas((prev) => manter(prev, marcas));
  }, [produtos]);

  const margemNum = publico ? 0 : (parseFloat(String(margem).replace(",", ".")) || 0);
  const minNum = parseFloat(String(precoMin).replace(",", ".")) || 0;
  const maxNum = parseFloat(String(precoMax).replace(",", ".")) || Infinity;

  // Config de preço da loja (usa a margem geral quando a loja ainda não foi configurada)
  const cfgDe = (lojaId) => {
    if (publico) return { dolar: 1, frete: 0, margem: 0 };
    const cfg = configDaLoja(precoConfigs, lojaId);
    return precoConfigs?.[lojaId] ? cfg : { ...cfg, margem: margemNum };
  };

  const filtrados = useMemo(() => {
    return produtos.filter((p) => {
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      if (lojasSelecionadas.length && !lojasSelecionadas.includes(p.loja_id)) return false;
      if (tiposSelecionados.length && !tiposSelecionados.includes(p.tipo_item)) return false;
      if (marcasSelecionadas.length && !marcasSelecionadas.includes(p.marca)) return false;
      if (somenteDisponiveis && !p.disponivel) return false;
      const custo = custoEmReais(p, configDaLoja(precoConfigs, p.loja_id));
      if (custo < minNum || custo > maxNum) return false;
      return true;
    });
  }, [produtos, busca, lojasSelecionadas, tiposSelecionados, marcasSelecionadas, somenteDisponiveis, minNum, maxNum, precoConfigs]);

  const criarToggle = (setter) => (valor) =>
    setter((prev) => (prev.includes(valor) ? prev.filter((x) => x !== valor) : [...prev, valor]));

  const toggleLoja = criarToggle(setLojasSelecionadas);
  const toggleTipo = criarToggle(setTiposSelecionados);
  const toggleMarca = criarToggle(setMarcasSelecionadas);

  const filtrosEl = (
    <FiltrosFornecedorSidebar
      busca={busca} setBusca={setBusca}
      lojas={publico ? [] : lojas} lojasSelecionadas={lojasSelecionadas} toggleLoja={toggleLoja}
      tipos={tipos} tiposSelecionados={tiposSelecionados} toggleTipo={toggleTipo}
      marcas={marcas} marcasSelecionadas={marcasSelecionadas} toggleMarca={toggleMarca}
      somenteDisponiveis={somenteDisponiveis} setSomenteDisponiveis={setSomenteDisponiveis}
      margem={margem} setMargem={salvarMargemPadrao} podeEditarMargem={isAdmin}
      precoMin={precoMin} setPrecoMin={setPrecoMin}
      precoMax={precoMax} setPrecoMax={setPrecoMax}
    />
  );

  return (
    <div className="flex flex-col lg:flex-row gap-3 p-2 md:p-3 h-full">
      <div className="hidden md:block flex-shrink-0">{filtrosEl}</div>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl px-4 py-3 shadow-sm flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-bold text-orange-600 leading-tight truncate">{publico ? "Catálogo de Produtos" : "Catálogo do Fornecedor"}</h2>
            <p className="text-xs text-slate-500">{filtrados.length} produtos{isAdmin ? ` · margem +${margemNum}%` : ""}</p>
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setConfigAberta(true)} className="border-orange-300 gap-1.5 px-2 md:px-3">
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden md:inline">Precificação</span>
            </Button>
          )}
          <MobileDrawer triggerLabel="Filtros" className="bg-gradient-to-br from-amber-50 to-orange-50">
            {filtrosEl}
          </MobileDrawer>
          <Button size="sm" variant="outline" onClick={() => carregar(busca.trim())} disabled={loading} className="border-orange-300 gap-1.5 px-2 md:px-3">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Atualizar</span>
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
                <CardProdutoFornecedor
                  key={`${p.loja_id}-${idx}`}
                  produto={p}
                  margem={margemNum}
                  mostrarCusto={isAdmin}
                  selecionado={selecionados.some((i) => i.chave === chaveProduto(p))}
                  onToggleSelecao={(prod) => toggleSelecao(prod, precoDeVenda(prod, cfgDe(prod.loja_id)))}
                  precoVenda={precoDeVenda(p, cfgDe(p.loja_id))}
                  precoCusto={custoEmReais(p, cfgDe(p.loja_id))}
                  onAbrir={(prod) => {
                    // Admin (e produtos da Visão VIP) abrem direto no site do fornecedor
                    if (!publico && (isAdmin || prod.loja_id === "visaovip") && prod.url) window.open(prod.url, "_blank", "noopener");
                    else setProdutoAberto(prod);
                  }}
                />
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

      <ListaSelecaoProdutos
        itens={selecionados}
        onRemover={(chave) => setSelecionados((prev) => prev.filter((i) => i.chave !== chave))}
        onLimpar={() => setSelecionados([])}
      />

      <ModalConfigPrecificacaoLojas
        aberto={configAberta}
        configs={precoConfigs}
        cotacaoSite={cotacaoSite}
        onSalvar={salvarPrecificacao}
        onClose={() => setConfigAberta(false)}
      />

      <ModalDetalheFornecedor
        produto={produtoAberto}
        margem={margemNum}
        mostrarCusto={isAdmin}
        onClose={() => setProdutoAberto(null)}
      />
    </div>
  );
}