import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Package,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CarrinhoCotacoes({ carrinho = [], onRemove, onClear }) {
  const navigate = useNavigate();

  const [itensCarrinho, setItensCarrinho] = React.useState([]);

  React.useEffect(() => {
    if (Array.isArray(carrinho)) {
      const novosItens = carrinho.map(produto => ({
        ...produto,
        quantidade: 1,
        is_opcional: false
      }));
      setItensCarrinho(novosItens);
    }
  }, [carrinho]);

  const handleQuantidadeChange = (produtoId, novaQuantidade) => {
    if (novaQuantidade < 1) return;
    setItensCarrinho(prev => prev.map(item =>
      item.id === produtoId ? { ...item, quantidade: parseInt(novaQuantidade) || 1 } : item
    ));
  };

  const handleToggleOpcional = (produtoId) => {
    setItensCarrinho(prev => prev.map(item =>
      item.id === produtoId ? { ...item, is_opcional: !item.is_opcional } : item
    ));
  };

  const calcularTotal = () => {
    return itensCarrinho
      .filter(item => !item.is_opcional)
      .reduce((acc, item) => acc + (item.quantidade * (item.preco_venda || 0)), 0);
  };

  const handleCriarOrcamento = () => {
    if (itensCarrinho.length === 0) {
      toast.error("Adicione pelo menos um produto ao carrinho.");
      return;
    }

    // Codificar dados do carrinho para passar via URL
    const carrinhoParam = encodeURIComponent(JSON.stringify(itensCarrinho));
    navigate(createPageUrl(`OrcamentoDetalhes?carrinho=${carrinhoParam}`));
    toast.success("Redirecionando para criação do orçamento...");
  };

  if (!Array.isArray(carrinho) || carrinho.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <ShoppingCart className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold text-slate-300 mb-2">Carrinho Vazio</h3>
        <p className="text-slate-500 mb-4">
          Adicione produtos ao carrinho para criar orçamentos rapidamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-slate-200">
      {/* Header com Botão de Criar Orçamento */}
      <div className="p-4 border-b border-slate-700 bg-slate-900/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-slate-400" />
            <span className="font-semibold text-slate-200">
              {itensCarrinho.length} {itensCarrinho.length === 1 ? 'Produto' : 'Produtos'}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClear}
            className="text-red-400 hover:bg-red-500/20 border-red-500/50"
          >
            Limpar Tudo
          </Button>
        </div>

        {/* Botão DESTACADO - Criar Orçamento */}
        <div className="relative">
          {/* Efeito de brilho pulsante */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-lg blur-md opacity-50 animate-pulse"></div>
          
          <Button 
            onClick={handleCriarOrcamento}
            className="relative w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white font-bold py-3 text-base shadow-2xl transform hover:scale-105 transition-all duration-300 border-2 border-amber-400/50"
          >
            <Sparkles className="w-5 h-5 mr-2 animate-pulse" />
            Criar Orçamento Agora
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        {/* Resumo de Total */}
        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">Total ({itensCarrinho.filter(i => !i.is_opcional).length} itens):</span>
            <span className="text-xl font-bold text-green-400">
              R$ {calcularTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Itens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {itensCarrinho.map((produto) => (
          <Card key={produto.id} className="border border-slate-700 bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-100 mb-1">
                    {produto.nome}
                  </h4>
                  {produto.descricao && (
                    <p className="text-sm text-slate-400 mb-2">
                      {produto.descricao}
                    </p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-400">Qtd:</label>
                      <div className="flex items-center border border-slate-600 rounded">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-300 hover:bg-slate-700"
                          onClick={() => handleQuantidadeChange(produto.id, produto.quantidade - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={produto.quantidade}
                          onChange={(e) => handleQuantidadeChange(produto.id, e.target.value)}
                          className="w-16 h-8 text-center border-0 focus-visible:ring-0 bg-transparent text-white"
                        />
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-300 hover:bg-slate-700"
                          onClick={() => handleQuantidadeChange(produto.id, produto.quantidade + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id={`opcional-${produto.id}`}
                        checked={produto.is_opcional}
                        onChange={() => handleToggleOpcional(produto.id)}
                        className="w-4 h-4 bg-slate-700 border-slate-600 rounded"
                      />
                      <label htmlFor={`opcional-${produto.id}`} className="text-sm text-slate-400">
                        Opcional
                      </label>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-amber-300">
                    R$ {((produto.preco_venda || 0) * produto.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-slate-500">
                    Unit: R$ {(produto.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 text-red-500 hover:bg-red-500/20"
                    onClick={() => onRemove(produto.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {produto.is_opcional && (
                <Badge variant="outline" className="mt-2 text-amber-300 border-amber-500/50 bg-amber-900/30">
                  Item Opcional
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer Simplificado */}
      <div className="border-t border-slate-700 bg-slate-900/50 p-3">
        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <Package className="w-3 h-3" />
          Transforme seus produtos em um orçamento profissional
        </p>
      </div>
    </div>
  );
}