import React from "react";
import { Button } from "@/components/ui/button";
import { Edit, DollarSign, Calendar, User, ShoppingCart, CheckCircle, Clock, XCircle, Truck, Package } from "lucide-react";

export default function VendaCard({ venda, onEditar }) {
  const getStatusInfo = (status) => {
    switch (status) {
      case "Entregue": return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" };
      case "Faturado": return { icon: Truck, color: "text-sky-600", bg: "bg-sky-100" };
      case "Pendente": return { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" };
      case "Cancelado": return { icon: XCircle, color: "text-red-600", bg: "bg-red-100" };
      default: return { icon: ShoppingCart, color: "text-slate-600", bg: "bg-slate-100" };
    }
  };

  const statusInfo = getStatusInfo(venda.status);

  // Função para renderizar produtos de forma segura
  const renderProdutos = () => {
    if (venda.produtos && Array.isArray(venda.produtos) && venda.produtos.length > 0) {
      return (
        <div className="text-xs text-slate-500 mt-2">
          <div className="flex items-center gap-1 mb-1">
            <Package className="w-3 h-3" />
            <span className="font-medium">{venda.produtos.length} item(s)</span>
          </div>
          {venda.produtos.slice(0, 2).map((produto, index) => (
            <div key={index} className="truncate">
              • {produto.nome} ({produto.quantidade}x)
            </div>
          ))}
          {venda.produtos.length > 2 && (
            <div className="text-slate-400">... e mais {venda.produtos.length - 2} item(s)</div>
          )}
        </div>
      );
    } else if (venda.descricao_produtos) {
      return (
        <div className="text-xs text-slate-500 mt-2">
          <div className="flex items-center gap-1 mb-1">
            <Package className="w-3 h-3" />
            <span className="font-medium">Produtos:</span>
          </div>
          <div className="truncate">{venda.descricao_produtos}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-slate-200/50 shadow-lg flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{venda.numero_pedido}</p>
          <h3 className="text-xl font-bold text-slate-800">{venda.cliente_nome}</h3>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
          <statusInfo.icon className="w-3 h-3" />
          <span>{venda.status}</span>
        </div>
      </div>

      <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/50 mb-4">
        <p className="text-xs font-semibold text-slate-500">VALOR TOTAL</p>
        <p className="text-2xl font-bold text-slate-800">R$ {(venda.valor_total || 0).toLocaleString('pt-BR')}</p>
        {venda.condicao_pagamento && (
          <p className="text-xs text-slate-500 mt-1">{venda.condicao_pagamento}</p>
        )}
      </div>

      <div className="space-y-3 text-sm mb-4 flex-grow">
        <div className="flex items-center gap-2 text-slate-600">
          <User className="w-4 h-4 text-slate-400" />
          Vendedor: <span className="font-medium text-slate-700">{venda.vendedor}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-4 h-4 text-slate-400" />
          Data: <span className="font-medium text-slate-700">{new Date(venda.data_venda).toLocaleDateString('pt-BR')}</span>
        </div>
        
        {renderProdutos()}
      </div>

      <Button onClick={onEditar} className="w-full bg-sky-100 border border-sky-200 text-sky-700 hover:bg-sky-200">
        <Edit className="w-4 h-4 mr-2" /> Detalhes
      </Button>
    </div>
  );
}