import { Button } from "@/components/ui/button";
import { ShoppingCart, Edit, Brain, History, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export default function ProdutoTable({
  produtos,
  onEdit,
  onAddToCart,
  onSugerirPreco,
  analisandoIA,
  selectedProductIds,
  onSelectProduct,
  onSelectAllProducts,
  allProductsSelected,
  columnVisibility
}) {

  const calculateMargin = (venda, custo) => {
    if (!venda || venda === 0) return 0;
    return ((venda - custo) / venda * 100).toFixed(1);
  };

  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden h-full flex flex-col">
      <ScrollArea className="flex-1">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10 border-b-2 border-slate-200">
            <tr>
              <th className="px-3 py-2 text-center w-10">
                <Checkbox
                  checked={allProductsSelected}
                  onCheckedChange={onSelectAllProducts}
                  className="h-3.5 w-3.5" />
              </th>
              {columnVisibility.produto &&
                <th className="px-3 py-2 text-left text-[12px] font-bold text-slate-700 uppercase w-[35%]">
                  Produto
                </th>
              }
              {columnVisibility.marca &&
                <th className="px-3 py-2 text-left text-[12px] font-bold text-slate-700 uppercase w-[25%]">
                  Tipo/Marca/Modelo
                </th>
              }
              {columnVisibility.precoVenda &&
                <th className="px-3 py-2 text-right text-[12px] font-bold text-slate-700 uppercase w-[15%]">
                  Preço Venda
                </th>
              }
              <th className="px-2 py-2 w-6"></th>
              {columnVisibility.acoes &&
                <th className="px-3 py-2 text-center text-[12px] font-bold text-slate-700 uppercase w-[20%]">
                  Ações
                </th>
              }
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {produtos.map((produto) => {
              const margemReal = calculateMargin(produto.preco_venda, produto.preco_custo);

              // Extrair configuração das observações
              let configuracao = '';
              if (produto.observacoes && produto.observacoes.includes('Configuração:')) {
                configuracao = produto.observacoes.
                split('Configuração:')[1]?.
                split('.')[0]?.
                replace('N/A', '').
                trim() || '';
              }

              return (
                <tr key={produto.id} className="hover:bg-orange-50/30 transition-colors">
                  {/* CHECKBOX */}
                  <td className="px-3 py-2 text-center align-top">
                    <Checkbox
                      checked={selectedProductIds.includes(produto.id)}
                      onCheckedChange={() => onSelectProduct(produto.id)}
                      className="h-3.5 w-3.5" />
                  </td>
                  
                  {/* COLUNA PRODUTO - FONTE 12px */}
                  {columnVisibility.produto &&
                    <td className="px-3 py-2 align-top">
                      <div className="max-w-md">
                        <div className="text-slate-900 text-[12px] font-semibold leading-tight">
                          {produto.nome}
                        </div>
                        {configuracao &&
                          <div className="text-[12px] text-blue-600 leading-tight mt-0.5">
                            {configuracao}
                          </div>
                        }
                        {produto.codigo &&
                          <div className="text-[12px] text-slate-400 mt-0.5 font-mono">
                            ({produto.codigo})
                          </div>
                        }
                      </div>
                    </td>
                  }
                  
                  {/* COLUNA TIPO/MARCA/MODELO - FONTE 12px */}
                  {columnVisibility.marca &&
                    <td className="px-3 py-2 align-top">
                      <div className="space-y-0.5">
                        <div className="text-[12px] font-bold text-purple-700 uppercase tracking-wide">
                          {produto.categoria || 'N/A'}
                        </div>
                        <div className="text-[12px] text-slate-800 font-medium">
                          {produto.marca || 'N/A'}
                        </div>
                        <div className="text-[12px] text-slate-600">
                          {produto.modelo || 'N/A'}
                        </div>
                      </div>
                    </td>
                  }
                  
                  {/* PREÇO VENDA - FONTE 12px */}
                  {columnVisibility.precoVenda &&
                    <td className="bg-slate-100 py-2 text-right rounded-sm align-top">
                      <div className="font-mono text-[12px] font-bold text-slate-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco_venda || 0)}
                      </div>
                    </td>
                  }
                  
                  {/* COLUNA VAZIA (separador) */}
                  <td className="px-1 py-2"></td>
                  
                  {/* AÇÕES */}
                  {columnVisibility.acoes &&
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onAddToCart(produto)}
                          className="hover:bg-blue-50 h-6 w-6"
                          title="Adicionar ao Carrinho">
                          <ShoppingCart className="w-3 h-3 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(produto)}
                          className="hover:bg-amber-50 h-6 w-6"
                          title="Editar">
                          <Edit className="w-3 h-3 text-amber-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onSugerirPreco(produto)}
                          disabled={analisandoIA}
                          className="hover:bg-purple-50 h-6 w-6"
                          title="Análise IA">
                          <Brain className="w-3 h-3 text-purple-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-slate-50 h-6 w-6"
                          title="Histórico">
                          <History className="w-3 h-3 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-red-50 h-6 w-6"
                          title="Excluir">
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  }
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {produtos.length === 0 &&
          <div className="p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-[12px]">Nenhum produto encontrado</p>
          </div>
        }
      </ScrollArea>
    </div>
  );
}