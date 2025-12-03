import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, AlertTriangle, Package } from 'lucide-react';

export default function ProdutoCard({ produto, onEdit }) {
  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getCategoryColor = (categoria) => {
    const colors = {
      "Hardware": "bg-blue-100 text-blue-800",
      "Software": "bg-purple-100 text-purple-800",
      "Serviço": "bg-green-100 text-green-800",
      "Consultoria": "bg-amber-100 text-amber-800",
      "Manutenção": "bg-red-100 text-red-800",
      "Outros": "bg-gray-100 text-gray-800"
    };
    return colors[categoria] || colors["Outros"];
  };

  const isEstoqueBaixo = produto.estoque_atual <= produto.estoque_minimo;

  return (
    <Card className="h-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-slate-800 line-clamp-2">
              {produto.nome}
            </CardTitle>
            <p className="text-sm text-slate-500 font-mono mt-1">{produto.codigo}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(produto)}>
                <Edit className="w-4 h-4 mr-2" /> Editar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Categoria e Status */}
        <div className="flex gap-2 flex-wrap">
          <Badge className={getCategoryColor(produto.categoria)}>
            {produto.categoria}
          </Badge>
          {!produto.ativo && (
            <Badge variant="secondary">Inativo</Badge>
          )}
          {isEstoqueBaixo && produto.estoque_atual >= 0 && (
            <Badge className="bg-red-100 text-red-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Estoque Baixo
            </Badge>
          )}
        </div>

        {/* Preços */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Preço de Venda:</span>
            <span className="font-semibold text-slate-800">
              {formatCurrency(produto.preco_venda)}
            </span>
          </div>
          {produto.preco_custo > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Custo:</span>
              <span className="text-sm text-slate-600">
                {formatCurrency(produto.preco_custo)}
              </span>
            </div>
          )}
        </div>

        {/* Estoque */}
        {produto.estoque_atual >= 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 flex items-center gap-1">
              <Package className="w-4 h-4" />
              Estoque:
            </span>
            <span className={`font-medium ${isEstoqueBaixo ? 'text-red-600' : 'text-slate-800'}`}>
              {produto.estoque_atual} {produto.unidade_medida}
            </span>
          </div>
        )}

        {/* Descrição */}
        {produto.descricao && (
          <p className="text-sm text-slate-600 line-clamp-2">
            {produto.descricao}
          </p>
        )}
      </CardContent>
    </Card>
  );
}