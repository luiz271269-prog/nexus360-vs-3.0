import React from "react";
import { Button } from "@/components/ui/button";
import { Edit, User, Building, Mail, Phone, Tag, TrendingUp, AlertCircle, Award, DollarSign } from "lucide-react";

export default function ClienteCard({ cliente, onEditar }) {
  const getStatusInfo = (status) => {
    switch (status) {
      case "Ativo": return { icon: <TrendingUp className="w-4 h-4"/>, chip: "bg-green-100 text-green-700" };
      case "Inativo": return { icon: <User className="w-4 h-4"/>, chip: "bg-slate-100 text-slate-600" };
      case "Em Risco": return { icon: <AlertCircle className="w-4 h-4"/>, chip: "bg-red-100 text-red-700", border: "border-red-500/50 shadow-red-500/20" };
      case "Promotor": return { icon: <Award className="w-4 h-4"/>, chip: "bg-sky-100 text-sky-700" };
      default: return { icon: <User className="w-4 h-4"/>, chip: "bg-yellow-100 text-yellow-700" };
    }
  };
  const statusInfo = getStatusInfo(cliente.status);

  return (
    <div className={`bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-slate-200/50 shadow-lg flex flex-col h-full ${statusInfo.border || ''}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">{cliente.nome_fantasia || cliente.razao_social}</h3>
          <p className="text-sm text-slate-500">{cliente.razao_social}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${statusInfo.chip}`}>
          {statusInfo.icon} {cliente.status}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/50">
          <p className="text-xs font-semibold text-slate-500">VENDEDOR</p>
          <p className="font-medium text-slate-700">{cliente.vendedor_responsavel}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/50">
            <p className="text-xs font-semibold text-slate-500">MÉDIA MENSAL</p>
            <div className="flex items-center gap-1 font-bold text-slate-700">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span>{(cliente.valor_recorrente_mensal || 0).toLocaleString('pt-BR')}</span>
            </div>
          </div>
          <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/50">
            <p className="text-xs font-semibold text-slate-500">SEGMENTO</p>
            <p className="font-medium text-slate-700">{cliente.segmento}</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 text-sm mb-6 flex-grow">
          {cliente.email && <div className="flex items-center gap-2 text-slate-600"><Mail className="w-4 h-4 text-slate-400" /> {cliente.email}</div>}
          {cliente.telefone && <div className="flex items-center gap-2 text-slate-600"><Phone className="w-4 h-4 text-slate-400" /> {cliente.telefone}</div>}
      </div>

      <Button onClick={onEditar} className="w-full bg-sky-100 border border-sky-200 text-sky-700 hover:bg-sky-200">
        <Edit className="w-4 h-4 mr-2" /> Detalhes
      </Button>
    </div>
  );
}