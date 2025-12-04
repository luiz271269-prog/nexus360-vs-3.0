
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Upload, ShoppingCart, Loader2, Calculator, DollarSign, X, CheckCircle, ListFilter, Columns, FileDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import ProdutoFiltros from "../components/produtos/ProdutoFiltros";
import ProdutoTable from "../components/produtos/ProdutoTable";
import CarrinhoCotacoes from "../components/produtos/CarrinhoCotacoes";
import ProdutoFormModal from "../components/produtos/ProdutoFormModal";
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';
import LembretesIAContextualizados from '../components/global/LembretesIAContextualizados';
import PainelAlertasQualidade from '../components/global/PainelAlertasQualidade';

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [produtosComAnalise, setProdutosComAnalise] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [produtoEdit, setProdutoEdit] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const navigate = useNavigate();

  const [filtros, setFiltros] = useState({
    busca: "",
    categorias: [],
    marcas: [],
    fornecedor: 'todos', // Changed from fornecedores: [] to fornecedor: 'todos'
    modelos: [],
    periodoAtualizacao: 'todos'
  });

  const [insightsIA, setInsightsIA] = useState(null);
  const [alertasQualidade, setAlertasQualidade] = useState([]);
  const [lembretesIA, setLembretesIA] = useState([]);
  const [modoCorrecao, setModoCorrecao] = useState(false);
  const [modalInsightsAberto, setModalInsightsAberto] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({
    produto: true,
    marca: true,
    modelo: true,
    fornecedor: true,
    precoVenda: true,
    acoes: true,
  });

  useEffect(() => {
    carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Produto.list('-created_date');
      setProdutos(Array.isArray(data) ? data : []);
      await analisarQualidadeRAG(Array.isArray(data) ? data : []);
      await analisarPrecificacao(Array.isArray(data) ? data : []);
      await gerarLembretesProdutos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      setProdutos([]);
    }
    setLoading(false);
  };

  const analisarQualidadeRAG = async (produtos) => {
    const alertas = [];
    const produtosComAnalise = produtos.map((produto) => {
      let scoreQualidade = 0;
      const problemas = [];

      if (produto.nome) scoreQualidade += 20;
      if (produto.descricao && produto.descricao.length > 50) {
        scoreQualidade += 30;
      } else if (produto.descricao) {
        scoreQualidade += 10;
        problemas.push('Descrição muito curta (recomendado: 50+ caracteres)');
      } else {
        problemas.push('Descrição ausente - crítico para IA');
      }

      if (produto.categoria) {
        scoreQualidade += 15;
      } else {
        problemas.push('Categoria não definida');
      }

      if (produto.marca) scoreQualidade += 10;
      if (produto.modelo) scoreQualidade += 10;
      if (produto.preco_custo && produto.preco_venda) {
        scoreQualidade += 15;
      } else {
        problemas.push('Dados de precificação incompletos');
      }

      let nivelQualidade = 'baixo';
      if (scoreQualidade >= 80) nivelQualidade = 'excelente';
      else if (scoreQualidade >= 60) nivelQualidade = 'bom';
      else if (scoreQualidade >= 40) nivelQualidade = 'medio';

      if (scoreQualidade < 60) {
        alertas.push({
          produto: produto.nome,
          produtoId: produto.id,
          score: scoreQualidade,
          problemas: problemas
        });
      }

      return {
        ...produto,
        qualidade_rag: {
          score: scoreQualidade,
          nivel: nivelQualidade,
          problemas: problemas
        }
      };
    });

    setProdutosComAnalise(produtosComAnalise);
    setAlertasQualidade(alertas);
  };

  const analisarPrecificacao = async (produtos) => {
    if (produtos.length === 0) return;

    setAnalisandoIA(true);
    try {
      const produtosComPreco = produtos.filter((p) => p.preco_venda && p.preco_custo);
      if (produtosComPreco.length === 0) {
        setAnalisandoIA(false);
        return;
      }

      const contexto = {
        total_produtos: produtos.length,
        produtos_com_precificacao: produtosComPreco.length,
        ticket_medio: produtosComPreco.reduce((sum, p) => sum + (p.preco_venda || 0), 0) / produtosComPreco.length,
        margem_media: produtosComPreco.reduce((sum, p) => {
          const margem = (p.preco_venda - p.preco_custo) / p.preco_venda * 100;
          return sum + margem;
        }, 0) / produtosComPreco.length,
      };

      const analise = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta estrutura de produtos e precificação, fornecendo insights estratégicos:

DADOS:
${JSON.stringify(contexto, null, 2)}

Forneça insights sobre margem, oportunidades de bundling e estratégias de precificação.`,
        response_json_schema: {
          type: "object",
          properties: {
            analise_margem: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["saudavel", "atencao", "critico"] },
                comentario: { type: "string" }
              }
            },
            oportunidades_bundling: {
              type: "array",
              items: { type: "string" }
            },
            produtos_sugeridos: {
              type: "array",
              items: { type: "string" }
            },
            estrategia_geral: { type: "string" }
          }
        }
      });

      setInsightsIA(analise);
    } catch (error) {
      console.error("Erro ao analisar precificação:", error);
    }
    setAnalisandoIA(false);
  };

  const gerarLembretesProdutos = async (produtos) => {
    const lembretes = [];
    const produtosSemPreco = produtos.filter((p) => !p.preco_venda || !p.preco_custo);
    if (produtosSemPreco.length > 0) {
      lembretes.push({
        id: 'produtos_sem_preco',
        prioridade: 'alta',
        titulo: `${produtosSemPreco.length} produto(s) sem precificação`,
        descricao: 'Produtos cadastrados mas sem preço definido',
        acao_sugerida: 'Revisar e adicionar preços',
        metadata: { quantidade: produtosSemPreco.length },
        onAcao: () => toast.info('💡 Filtrando produtos sem preço...')
      });
    }

    const produtosSemDescricao = produtos.filter((p) => !p.descricao || p.descricao.length < 20);
    if (produtosSemDescricao.length > 5) {
      lembretes.push({
        id: 'produtos_sem_descricao',
        prioridade: 'media',
        titulo: `${produtosSemDescricao.length} produto(s) precisam de descrição`,
        descricao: 'Descrições ausentes ou muito curtas prejudicam a IA',
        acao_sugerida: 'Enriquecer descrições',
        metadata: { quantidade: produtosSemDescricao.length },
        onAcao: () => toast.info('📝 A descrição dos produtos melhora a qualidade da IA')
      });
    }

    setLembretesIA(lembretes);
  };

  const handleQualidadeClick = () => {
    setModoCorrecao(true);
    toast.success('🔍 Filtrando produtos que precisam de correção');
  };

  const handleInsightsClick = () => {
    setModalInsightsAberto(true);
  };

  const handleSugerirPreco = async (produto) => {
    toast.info('Funcionalidade de sugestão de preço será implementada em breve');
  };

  const handleSave = async (data) => {
    try {
      if (produtoEdit) {
        await base44.entities.Produto.update(produtoEdit.id, data);
      } else {
        await base44.entities.Produto.create(data);
      }
      setShowFormModal(false);
      setProdutoEdit(null);
      carregarProdutos();
      toast.success("Produto salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      toast.error("Erro ao salvar produto.");
    }
  };

  const handleNew = () => {
    setProdutoEdit(null);
    setShowFormModal(true);
  };

  const handleEdit = (produto) => {
    setProdutoEdit(produto);
    setShowFormModal(true);
  };

  const handleFiltrosChange = (novosFiltros) => {
    setFiltros({
      busca: novosFiltros.busca || "",
      categorias: Array.isArray(novosFiltros.categorias) ? novosFiltros.categorias : [],
      marcas: Array.isArray(novosFiltros.marcas) ? novosFiltros.marcas : [],
      fornecedor: novosFiltros.fornecedor || 'todos', // Changed from fornecedores: Array.isArray(novosFiltros.fornecedores) ? novosFiltros.fornecedores : [],
      modelos: Array.isArray(novosFiltros.modelos) ? novosFiltros.modelos : [],
      periodoAtualizacao: novosFiltros.periodoAtualizacao || 'todos'
    });
  };

  const handleSelectProduct = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAllProducts = (checked) => {
    if (checked) {
      setSelectedProductIds(produtosFiltrados.map((p) => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleExcludeSelected = async () => {
    if (selectedProductIds.length === 0) {
      toast.info("Selecione produtos para excluir.");
      return;
    }
    if (!confirm(`Tem certeza que deseja excluir ${selectedProductIds.length} produto(s)?`)) {
      return;
    }

    setLoading(true);
    try {
      for (const id of selectedProductIds) {
        await base44.entities.Produto.delete(id);
      }
      toast.success(`${selectedProductIds.length} produto(s) excluído(s)!`);
      setSelectedProductIds([]);
      carregarProdutos();
    } catch (error) {
      console.error("Erro ao excluir produtos selecionados:", error);
      toast.error("Erro ao excluir produtos.");
    } finally {
      setLoading(false);
    }
  };

  const handleCotarSelected = () => {
    if (selectedProductIds.length === 0) {
      toast.info("Selecione produtos para cotar.");
      return;
    }
    const produtosParaCotar = produtos.filter(p => selectedProductIds.includes(p.id));
    produtosParaCotar.forEach(p => handleAddToCart(p));
    toast.success(`${produtosParaCotar.length} produto(s) adicionado(s) ao carrinho para cotação.`);
    setSelectedProductIds([]);
  };

  const produtosFiltrados = useMemo(() => {
    const produtosSeguros = Array.isArray(produtosComAnalise) ? produtosComAnalise : [];
    if (produtosSeguros.length === 0) return [];

    let produtosFinal = produtosSeguros.filter((produto) => {
      if (!produto) return false;

      const matchBusca = !filtros.busca ||
        (produto.nome && produto.nome.toLowerCase().includes(filtros.busca.toLowerCase())) ||
        (produto.codigo && produto.codigo.toLowerCase().includes(filtros.busca.toLowerCase())) ||
        (produto.fornecedor && produto.fornecedor.toLowerCase().includes(filtros.busca.toLowerCase())) ||
        (produto.marca && produto.marca.toLowerCase().includes(filtros.busca.toLowerCase())) ||
        (produto.modelo && produto.modelo.toLowerCase().includes(filtros.busca.toLowerCase()));

      const matchCategoria = !filtros.categorias || filtros.categorias.length === 0 ||
        (produto.categoria && filtros.categorias.includes(produto.categoria));

      const matchMarca = !filtros.marcas || filtros.marcas.length === 0 ||
        (produto.marca && filtros.marcas.includes(produto.marca));

      const matchFornecedor = !filtros.fornecedor || filtros.fornecedor === 'todos' ||
        (produto.fornecedor && produto.fornecedor === filtros.fornecedor);

      const matchModelo = !filtros.modelos || filtros.modelos.length === 0 ||
        (produto.modelo && filtros.modelos.includes(produto.modelo));

      const matchPeriodoAtualizacao = (() => {
        if (!filtros.periodoAtualizacao || filtros.periodoAtualizacao === 'todos') return true;
        if (!produto.data_ultima_cotacao) return false;

        const dataCotacao = new Date(produto.data_ultima_cotacao);
        const hoje = new Date();
        let limiteData;

        switch (filtros.periodoAtualizacao) {
          case 'ultimos_7_dias':
            limiteData = new Date(hoje);
            limiteData.setDate(hoje.getDate() - 7);
            return dataCotacao >= limiteData;
          case 'ultimos_30_dias':
            limiteData = new Date(hoje);
            limiteData.setDate(hoje.getDate() - 30);
            return dataCotacao >= limiteData;
          case 'ultimos_90_dias':
            limiteData = new Date(hoje);
            limiteData.setDate(hoje.getDate() - 90);
            return dataCotacao >= limiteData;
          case 'mais_de_90_dias':
            limiteData = new Date(hoje);
            limiteData.setDate(hoje.getDate() - 90);
            return dataCotacao < limiteData;
          default:
            return true;
        }
      })();

      return matchBusca && matchCategoria && matchMarca && matchFornecedor && matchModelo && matchPeriodoAtualizacao;
    });

    if (modoCorrecao) {
      produtosFinal = produtosFinal.filter((p) =>
        p.qualidade_rag && (p.qualidade_rag.nivel === 'baixo' || p.qualidade_rag.nivel === 'medio')
      );
    }

    return produtosFinal;
  }, [produtosComAnalise, filtros, modoCorrecao]);

  const handleAddToCart = (produto) => {
    if (!produto || !produto.id) {
      toast.error("Produto inválido.");
      return;
    }

    if (carrinho.some((item) => item.id === produto.id)) {
      toast.info("Este produto já está no carrinho.");
      return;
    }
    setCarrinho((prev) => [...prev, produto]);
    toast.success(`${produto.nome} adicionado ao carrinho!`);
  };

  const handleRemoveFromCart = (produtoId) => {
    setCarrinho((prev) => prev.filter((p) => p.id !== produtoId));
  };

  const handleClearCart = () => {
    setCarrinho([]);
  };

  const statsQualidade = useMemo(() => {
    if (produtosComAnalise.length === 0) return null;

    const excelente = produtosComAnalise.filter((p) => p.qualidade_rag?.nivel === 'excelente').length;
    const bom = produtosComAnalise.filter((p) => p.qualidade_rag?.nivel === 'bom').length;
    const medio = produtosComAnalise.filter((p) => p.qualidade_rag?.nivel === 'medio').length;
    const baixo = produtosComAnalise.filter((p) => p.qualidade_rag?.nivel === 'baixo').length;
    const scoreGeral = produtosComAnalise.reduce((sum, p) => sum + (p.qualidade_rag?.score || 0), 0) / produtosComAnalise.length;

    return {
      excelente,
      bom,
      medio,
      baixo,
      scoreGeral: Math.round(scoreGeral),
      total: produtosComAnalise.length
    };
  }, [produtosComAnalise]);

  return (
    <div className="flex h-screen bg-transparent">
      <aside className="bg-gradient-to-br from-amber-100 via-orange-100 to-red-100 backdrop-blur-lg w-[280px] min-w-[280px] max-w-[280px] border-r border-orange-200/50 shadow-lg overflow-hidden">
        <div className="h-full flex flex-col">
          <ProdutoFiltros
            produtos={produtos}
            filtros={filtros}
            onFiltrosChange={handleFiltrosChange}
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
          {/* HEADER COMPACTO NO TOPO */}
          <div className="bg-gradient-to-br from-amber-400/20 via-orange-400/20 to-red-500/20 rounded-xl shadow-xl border-2 border-orange-300 backdrop-blur-sm relative overflow-hidden p-3 flex-shrink-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-400/20 to-orange-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-orange-400/20 to-red-500/20 rounded-full blur-3xl"></div>
            
            <div className="flex items-center justify-between relative z-10">
              {/* TÍTULO COMPACTO */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/50">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
                    Catálogo de Produtos
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm text-slate-600">{produtosFiltrados.length} produtos</p>
                    {modoCorrecao && (
                      <Badge className="bg-orange-500 text-white font-bold text-xs">
                        Modo Correção
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              {/* BOTÕES COMPACTOS LADO A LADO */}
              <div className="flex gap-2 flex-wrap">
                {modoCorrecao && (
                  <Button
                    onClick={() => setModoCorrecao(false)}
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-slate-100 border-2 border-slate-300 h-9 text-xs"
                  >
                    Sair Correção
                  </Button>
                )}
                
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-white hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 border-2 border-orange-300 hover:border-orange-500 h-9 text-xs">
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                      Carrinho ({carrinho.length})
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[500px] sm:max-w-[500px] bg-gradient-to-br from-slate-900 to-slate-800 p-0 border-l-slate-700">
                    <SheetHeader className="p-6 bg-slate-900/50">
                      <SheetTitle className="text-xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent">
                        Carrinho de Cotações
                      </SheetTitle>
                    </SheetHeader>
                    <CarrinhoCotacoes
                      carrinho={carrinho}
                      onRemove={handleRemoveFromCart}
                      onClear={handleClearCart}
                    />
                  </SheetContent>
                </Sheet>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 border-2 border-orange-300 hover:border-orange-500 h-9 text-xs"
                    >
                      <Columns className="mr-1.5 h-3.5 w-3.5" />
                      Colunas
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 bg-white p-4 shadow-lg rounded-lg">
                    <div className="grid gap-2">
                      {Object.keys(columnVisibility).map((key) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={key}
                            checked={columnVisibility[key]}
                            onCheckedChange={(checked) =>
                              setColumnVisibility((prev) => ({ ...prev, [key]: checked }))
                            }
                          />
                          <label htmlFor={key} className="text-sm font-medium leading-none">
                            {key === 'precoVenda' && 'Preço Venda'}
                            {key === 'acoes' && 'Ações'}
                            {key === 'produto' && 'Produto'}
                            {key === 'marca' && 'Marca'}
                            {key === 'modelo' && 'Modelo'}
                            {key === 'fornecedor' && 'Fornecedor'}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={() => navigate(createPageUrl('Precificacao'))}
                  variant="outline"
                  size="sm"
                  className="bg-white hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 border-2 border-orange-300 hover:border-orange-500 h-9 text-xs"
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Importar (IA)
                </Button>
                
                <Button
                  onClick={handleNew}
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white font-semibold shadow-lg shadow-orange-500/50 transition-all transform hover:scale-105 h-9 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Novo
                </Button>
              </div>
            </div>

            {selectedProductIds.length > 0 && (
              <div className="flex justify-end gap-2 mt-3">
                <Button
                  onClick={handleExcludeSelected}
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                >
                  <X className="w-3.5 h-3.5" /> Excluir ({selectedProductIds.length})
                </Button>
                <Button
                  onClick={handleCotarSelected}
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                >
                  <DollarSign className="w-3.5 h-3.5" /> Cotar ({selectedProductIds.length})
                </Button>
              </div>
            )}
          </div>

          <BotaoNexusFlutuante
            contadorLembretes={lembretesIA.length + alertasQualidade.length}
            onClick={() => {
              if (alertasQualidade.length > 0) {
                toast.info(`📊 ${alertasQualidade.length} produtos precisam de atenção`);
              }
            }}
          />

          <LembretesIAContextualizados
            lembretes={lembretesIA}
            statsQualidade={statsQualidade}
            insightsIA={insightsIA}
            onQualidadeClick={handleQualidadeClick}
            onInsightsClick={handleInsightsClick}
            onAcaoExecutada={(lembrete) => {
              if (lembrete.id === 'fechar_tudo') {
                setLembretesIA([]);
                return;
              }
              setLembretesIA((prev) => prev.filter((l) => l.id !== lembrete.id));
            }}
          />

          {analisandoIA && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                <div>
                  <p className="font-semibold text-purple-900 text-sm">IA Analisando...</p>
                  <p className="text-xs text-purple-700">Gerando insights de precificação</p>
                </div>
              </div>
            </div>
          )}

          {/* GRADE COM ALTURA TOTAL */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : (
              <ProdutoTable
                produtos={produtosFiltrados}
                onEdit={handleEdit}
                onAddToCart={handleAddToCart}
                onSugerirPreco={handleSugerirPreco}
                analisandoIA={analisandoIA}
                selectedProductIds={selectedProductIds}
                onSelectProduct={handleSelectProduct}
                onSelectAllProducts={handleSelectAllProducts}
                allProductsSelected={selectedProductIds.length === produtosFiltrados.length && produtosFiltrados.length > 0}
                columnVisibility={columnVisibility}
              />
            )}
          </div>
        </div>
      </main>

      {showFormModal && (
        <ProdutoFormModal
          produto={produtoEdit}
          onSave={handleSave}
          onClose={() => {
            setShowFormModal(false);
            setProdutoEdit(null);
          }}
        />
      )}

      {modalInsightsAberto && insightsIA && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-white" />
                <h2 className="text-2xl font-bold text-white">Insights de Precificação IA</h2>
              </div>
              <Button
                onClick={() => setModalInsightsAberto(false)}
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)] space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  📊 Análise da Margem
                  <Badge className={
                    insightsIA.analise_margem?.status === 'saudavel' ? 'bg-green-500' :
                    insightsIA.analise_margem?.status === 'critico' ? 'bg-red-500' :
                    'bg-orange-500'
                  }>
                    {insightsIA.analise_margem?.status === 'saudavel' ? 'Saudável' :
                    insightsIA.analise_margem?.status === 'critico' ? 'Crítico' : 'Atenção'}
                  </Badge>
                </h3>
                <p className="text-slate-700">{insightsIA.analise_margem?.comentario}</p>
              </div>

              {insightsIA.oportunidades_bundling && insightsIA.oportunidades_bundling.length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
                  <h3 className="font-bold text-lg mb-3">💡 Oportunidades de Bundling</h3>
                  <ul className="space-y-2">
                    {insightsIA.oportunidades_bundling.map((oportunidade, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-700">{oportunidade}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insightsIA.produtos_sugeridos && insightsIA.produtos_sugeridos.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200">
                  <h3 className="font-bold text-lg mb-3">🎯 Produtos Sugeridos</h3>
                  <ul className="space-y-2">
                    {insightsIA.produtos_sugeridos.map((produto, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Plus className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-700">{produto}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl border-2 border-amber-200">
                <h3 className="font-bold text-lg mb-2">🎯 Estratégia Geral</h3>
                <p className="text-slate-700 italic">{insightsIA.estrategia_geral}</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
