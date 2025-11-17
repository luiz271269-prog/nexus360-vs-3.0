
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Tags, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProdutoFiltros({ produtos = [], filtros = {}, onFiltrosChange }) {
  const produtosSeguros = useMemo(() => (Array.isArray(produtos) ? produtos : []), [produtos]);

  const [localFiltros, setLocalFiltros] = useState({
    busca: filtros.busca || "",
    fornecedor: filtros.fornecedor || "todos",
    periodoAtualizacao: filtros.periodoAtualizacao || "todos",
    categorias: Array.isArray(filtros.categorias) ? filtros.categorias : [],
    marcas: Array.isArray(filtros.marcas) ? filtros.marcas : [],
    modelos: Array.isArray(filtros.modelos) ? filtros.modelos : [],
  });

  useEffect(() => {
    setLocalFiltros({
      busca: filtros.busca || "",
      fornecedor: filtros.fornecedor || "todos",
      periodoAtualizacao: filtros.periodoAtualizacao || "todos",
      categorias: Array.isArray(filtros.categorias) ? filtros.categorias : [],
      marcas: Array.isArray(filtros.marcas) ? filtros.marcas : [],
      modelos: Array.isArray(filtros.modelos) ? filtros.modelos : [],
    });
  }, [filtros]);

  const handleFiltroChange = (novosFiltros) => {
    const filtrosAtualizados = { ...localFiltros, ...novosFiltros };
    setLocalFiltros(filtrosAtualizados);
    onFiltrosChange(filtrosAtualizados);
  };
  
  const handleBuscaChange = (e) => {
    handleFiltroChange({ busca: e.target.value });
  };

  const handleFornecedorChange = (value) => {
    handleFiltroChange({ fornecedor: value });
  };

  const handlePeriodoChange = (value) => {
    handleFiltroChange({ periodoAtualizacao: value });
  };

  const handleCategoriaChange = (categoria, checked) => {
    const novasCategorias = checked
      ? [...localFiltros.categorias, categoria]
      : localFiltros.categorias.filter((c) => c !== categoria);
    handleFiltroChange({ categorias: novasCategorias });
  };

  const handleMarcaChange = (marca, checked) => {
    const novasMarcas = checked
      ? [...localFiltros.marcas, marca]
      : localFiltros.marcas.filter((m) => m !== marca);
    handleFiltroChange({ marcas: novasMarcas });
  };

  const handleModeloChange = (modelo, checked) => {
    const novosModelos = checked
      ? [...localFiltros.modelos, modelo]
      : localFiltros.modelos.filter((m) => m !== modelo);
    handleFiltroChange({ modelos: novosModelos });
  };

  const limparFiltros = () => {
    const filtrosLimpados = { 
      busca: "", 
      fornecedor: "todos",
      periodoAtualizacao: "todos",
      categorias: [], 
      marcas: [], 
      modelos: []
    };
    setLocalFiltros(filtrosLimpados);
    onFiltrosChange(filtrosLimpados);
  };

  const categoriasContador = useMemo(() => {
    return produtosSeguros.reduce((acc, produto) => {
      if (produto && produto.categoria) {
        const categoria = produto.categoria;
        acc[categoria] = (acc[categoria] || 0) + 1;
      }
      return acc;
    }, {});
  }, [produtosSeguros]);

  const marcasContador = useMemo(() => {
    return produtosSeguros.reduce((acc, produto) => {
      if (produto && produto.marca) {
        const marca = produto.marca;
        acc[marca] = (acc[marca] || 0) + 1;
      }
      return acc;
    }, {});
  }, [produtosSeguros]);

  const fornecedoresLista = useMemo(() => {
    const fornecedores = new Set();
    produtosSeguros.forEach(produto => {
      if (produto && produto.fornecedor) {
        fornecedores.add(produto.fornecedor);
      }
    });
    return Array.from(fornecedores).sort();
  }, [produtosSeguros]);

  const modelosContador = useMemo(() => {
    return produtosSeguros.reduce((acc, produto) => {
      if (produto && produto.modelo) {
        const modelo = produto.modelo;
        acc[modelo] = (acc[modelo] || 0) + 1;
      }
      return acc;
    }, {});
  }, [produtosSeguros]);

  const totalFiltrosAtivos = 
    (localFiltros.categorias || []).length + 
    (localFiltros.marcas || []).length + 
    (localFiltros.modelos || []).length +
    (localFiltros.fornecedor !== 'todos' ? 1 : 0) +
    (localFiltros.periodoAtualizacao !== 'todos' ? 1 : 0);

  return (
    <div className="space-y-4 h-full flex flex-col py-4">
      {/* BUSCA RÁPIDA UNIFICADA */}
      <Card className="shadow-sm bg-white border-2 border-orange-300">
        <CardHeader className="p-2 bg-gradient-to-r from-slate-900 via-slate-800 to-orange-600">
          <CardTitle className="text-[12px] font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4" />
            Busca Rápida
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          <Input
            placeholder="Nome, SKU, Marca, Modelo..."
            value={localFiltros.busca}
            onChange={handleBuscaChange}
            className="h-9 text-[12px] border-orange-300 focus:border-orange-500"
          />
          
          <Select value={localFiltros.fornecedor} onValueChange={handleFornecedorChange}>
            <SelectTrigger className="h-9 text-[12px] border-orange-300 focus:border-orange-500">
              <SelectValue placeholder="Todos os Fornecedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-[12px]">Todos os Fornecedores</SelectItem>
              {fornecedoresLista.map((fornecedor) => (
                <SelectItem key={fornecedor} value={fornecedor} className="text-[12px]">
                  {fornecedor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={localFiltros.periodoAtualizacao} onValueChange={handlePeriodoChange}>
            <SelectTrigger className="h-9 text-[12px] border-orange-300 focus:border-orange-500">
              <SelectValue placeholder="Todos os Períodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-[12px]">Todos os Períodos</SelectItem>
              <SelectItem value="ultimos_7_dias" className="text-[12px]">Últimos 7 dias</SelectItem>
              <SelectItem value="ultimos_30_dias" className="text-[12px]">Últimos 30 dias</SelectItem>
              <SelectItem value="ultimos_90_dias" className="text-[12px]">Últimos 90 dias</SelectItem>
              <SelectItem value="mais_de_90_dias" className="text-[12px]">Mais de 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {totalFiltrosAtivos > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border-2 border-orange-300 rounded-xl p-3 shadow-lg">
          <h3 className="text-[12px] font-semibold text-orange-800 mb-2 flex items-center gap-2">
            <Tags className="w-4 h-4" />
            Filtros Ativos ({totalFiltrosAtivos})
          </h3>
          <div className="flex flex-wrap gap-2">
            {localFiltros.categorias.map((c) => 
              <Badge key={c} className="bg-gradient-to-r from-slate-800 to-orange-600 text-white border-0 text-[12px]">
                {c}
              </Badge>
            )}
            {localFiltros.marcas.map((m) => 
              <Badge key={m} className="bg-gradient-to-r from-slate-800 to-orange-600 text-white border-0 text-[12px]">
                {m}
              </Badge>
            )}
            {localFiltros.modelos.map((m) => 
              <Badge key={m} className="bg-gradient-to-r from-slate-800 to-orange-600 text-white border-0 text-[12px]">
                {m}
              </Badge>
            )}
            {localFiltros.fornecedor !== 'todos' && (
              <Badge className="bg-gradient-to-r from-slate-800 to-orange-600 text-white border-0 text-[12px]">
                {localFiltros.fornecedor}
              </Badge>
            )}
            {localFiltros.periodoAtualizacao !== 'todos' && (
              <Badge className="bg-gradient-to-r from-slate-800 to-orange-600 text-white border-0 text-[12px]">
                {localFiltros.periodoAtualizacao === 'ultimos_7_dias' && '7 dias'}
                {localFiltros.periodoAtualizacao === 'ultimos_30_dias' && '30 dias'}
                {localFiltros.periodoAtualizacao === 'ultimos_90_dias' && '90 dias'}
                {localFiltros.periodoAtualizacao === 'mais_de_90_dias' && '+90 dias'}
              </Badge>
            )}
          </div>
          <Button onClick={limparFiltros} size="sm" variant="ghost" className="mt-3 w-full text-red-600 hover:bg-red-50 text-[12px] h-8">
            <X className="w-4 h-4 mr-2" /> Limpar Filtros
          </Button>
        </div>
      )}

      {/* CATEGORIAS - GRADIENTE PRETO/LARANJA */}
      <Card className="shadow-sm bg-white border-2 border-orange-300" style={{ height: '280px' }}>
        <CardHeader className="p-2 bg-gradient-to-r from-slate-900 via-slate-800 to-orange-600">
          <CardTitle className="text-[12px] font-bold text-white flex items-center gap-2">
            <Tags className="w-4 h-4" /> 
            Categorias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 h-[calc(100%-40px)]">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-0.5">
              {Object.entries(categoriasContador).map(([categoria, count]) => (
                <div key={categoria} className="flex items-center justify-between hover:bg-orange-50 px-2 py-1 rounded transition-all">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Checkbox
                      id={`cat-${categoria}`}
                      checked={localFiltros.categorias.includes(categoria)}
                      onCheckedChange={(checked) => handleCategoriaChange(categoria, checked)}
                      className="h-4 w-4 border-orange-400 flex-shrink-0"
                    />
                    <label htmlFor={`cat-${categoria}`} className="text-[12px] text-slate-700 cursor-pointer truncate flex-1 leading-tight">
                      {categoria}
                    </label>
                  </div>
                  <span className="text-[12px] text-slate-500 font-semibold ml-2 flex-shrink-0">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* MARCAS - GRADIENTE PRETO/LARANJA */}
      <Card className="shadow-sm bg-white border-2 border-orange-300" style={{ height: '280px' }}>
        <CardHeader className="p-2 bg-gradient-to-r from-slate-900 via-slate-800 to-orange-600">
          <CardTitle className="text-[12px] font-bold text-white flex items-center gap-2">
            <Tags className="w-4 h-4" /> 
            Marcas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 h-[calc(100%-40px)]">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-0.5">
              {Object.entries(marcasContador).map(([marca, count]) => (
                <div key={marca} className="flex items-center justify-between hover:bg-orange-50 px-2 py-1 rounded transition-all">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Checkbox
                      id={`marca-${marca}`}
                      checked={localFiltros.marcas.includes(marca)}
                      onCheckedChange={(checked) => handleMarcaChange(marca, checked)}
                      className="h-4 w-4 border-orange-400 flex-shrink-0"
                    />
                    <label htmlFor={`marca-${marca}`} className="text-[12px] text-slate-700 cursor-pointer truncate flex-1 leading-tight">
                      {marca}
                    </label>
                  </div>
                  <span className="text-[12px] text-slate-500 font-semibold ml-2 flex-shrink-0">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* MODELOS - GRADIENTE PRETO/LARANJA */}
      <Card className="shadow-sm bg-white border-2 border-orange-300" style={{ height: '280px' }}>
        <CardHeader className="p-2 bg-gradient-to-r from-slate-900 via-slate-800 to-orange-600">
          <CardTitle className="text-[12px] font-bold text-white flex items-center gap-2">
            <Tags className="w-4 h-4" /> 
            Modelos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 h-[calc(100%-40px)]">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-0.5">
              {Object.entries(modelosContador).map(([modelo, count]) => (
                <div key={modelo} className="flex items-center justify-between hover:bg-orange-50 px-2 py-1 rounded transition-all">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Checkbox
                      id={`mod-${modelo}`}
                      checked={localFiltros.modelos.includes(modelo)}
                      onCheckedChange={(checked) => handleModeloChange(modelo, checked)}
                      className="h-4 w-4 border-orange-400 flex-shrink-0"
                    />
                    <label htmlFor={`mod-${modelo}`} className="text-[12px] text-slate-700 cursor-pointer truncate flex-1 leading-tight">
                      {modelo}
                    </label>
                  </div>
                  <span className="text-[12px] text-slate-500 font-semibold ml-2 flex-shrink-0">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
