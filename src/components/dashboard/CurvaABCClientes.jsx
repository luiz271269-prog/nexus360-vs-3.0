import React from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, Award, AlertTriangle, Eye } from "lucide-react";

export default function CurvaABCClientes({ clientesABC, onViewDetails }) {
  const getCurvaInfo = (curva) => {
    switch (curva) {
      case 'A': return { icon: Award, color: "text-green-600", bg: "bg-green-100", label: "Alto Valor" };
      case 'B': return { icon: TrendingUp, color: "text-yellow-600", bg: "bg-yellow-100", label: "Médio Valor" };
      case 'C': return { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100", label: "Baixo Valor" };
      default: return { icon: TrendingUp, color: "text-slate-600", bg: "bg-slate-100", label: "N/A" };
    }
  };

  const top10Clientes = clientesABC.slice(0, 10);

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-slate-200/50 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Curva ABC - Top Clientes</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetails}
          className="bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          <Eye className="w-4 h-4 mr-2" />
          Ver Todos
        </Button>
      </div>
      
      <div className="space-y-3">
        {top10Clientes.map((cliente, index) => {
          const curvaInfo = getCurvaInfo(cliente.curva);
          return (
            <div key={cliente.id} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-lg border border-slate-200/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-500">#{index + 1}</span>
                <div className={`w-8 h-8 ${curvaInfo.bg} rounded-lg flex items-center justify-center`}>
                  <curvaInfo.icon className={`w-4 h-4 ${curvaInfo.color}`} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{cliente.razao_social}</p>
                  <p className="text-xs text-slate-500">{cliente.vendedor_responsavel}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">R$ {(cliente.valor_recorrente_mensal || 0).toLocaleString('pt-BR')}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${curvaInfo.bg} ${curvaInfo.color}`}>
                    {cliente.curva}
                  </span>
                  <span className="text-xs text-slate-500">{cliente.percentualAcumulado?.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}