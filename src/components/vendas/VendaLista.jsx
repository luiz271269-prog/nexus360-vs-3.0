import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, User, ShoppingCart, CheckCircle, Clock, XCircle, Truck, Eye, Package } from "lucide-react";

export default function VendaLista({ vendas, loading, onEditar }) {
  const getStatusInfo = (status) => {
    switch (status) {
      case "Entregue": return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" };
      case "Faturado": return { icon: Truck, color: "text-sky-600", bg: "bg-sky-100" };
      case "Pendente": return { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" };
      case "Cancelado": return { icon: XCircle, color: "text-red-600", bg: "bg-red-100" };
      default: return { icon: ShoppingCart, color: "text-slate-600", bg: "bg-slate-100" };
    }
  };

  // Função para renderizar resumo dos produtos de forma segura
  const renderResumoProdutos = (venda) => {
    if (venda.produtos && Array.isArray(venda.produtos) && venda.produtos.length > 0) {
      const totalItens = venda.produtos.reduce((acc, p) => acc + (p.quantidade || 0), 0);
      return (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Package className="w-3 h-3" />
          <span>{totalItens} item(s)</span>
        </div>
      );
    } else if (venda.descricao_produtos) {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Package className="w-3 h-3" />
          <span className="truncate max-w-[100px]">{venda.descricao_produtos}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Package className="w-3 h-3" />
        <span>-</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="space-y-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-slate-100 rounded-lg h-16 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 shadow-lg overflow-hidden">
      {/* Header da Tabela */}
      <div className="bg-slate-50/80 border-b border-slate-200/50 p-4">
        <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-600">
          <div className="col-span-2">Nº Pedido</div>
          <div className="col-span-2">Cliente</div>
          <div className="col-span-2">Vendedor</div>
          <div className="col-span-1">Data</div>
          <div className="col-span-2">Valor</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Ações</div>
        </div>
      </div>

      {/* Linhas da Tabela */}
      <div className="max-h-96 overflow-y-auto">
        {vendas.map((venda) => {
          const statusInfo = getStatusInfo(venda.status);
          return (
            <div key={venda.id} className="border-b border-slate-200/30 hover:bg-slate-50/50 transition-colors">
              <div className="grid grid-cols-12 gap-4 p-4 text-sm items-center">
                <div className="col-span-2">
                  <div className="font-semibold text-slate-800">{venda.numero_pedido}</div>
                  {renderResumoProdutos(venda)}
                </div>
                
                <div className="col-span-2">
                  <div className="font-medium text-slate-700 truncate">{venda.cliente_nome}</div>
                  {venda.condicao_pagamento && (
                    <div className="text-xs text-slate-500 truncate">{venda.condicao_pagamento}</div>
                  )}
                </div>
                
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 truncate">{venda.vendedor}</span>
                  </div>
                </div>
                
                <div className="col-span-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 text-xs">
                      {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="font-bold text-green-600">
                      R$ {(venda.valor_total || 0).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
                
                <div className="col-span-2">
                  <Badge className={`${statusInfo.bg} ${statusInfo.color} font-medium`}>
                    <statusInfo.icon className="w-3 h-3 mr-1" />
                    {venda.status}
                  </Badge>
                </div>
                
                <div className="col-span-1">
                  <Button
                    onClick={() => onEditar(venda)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}