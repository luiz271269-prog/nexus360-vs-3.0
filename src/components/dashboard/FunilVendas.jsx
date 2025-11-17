import { Users, FileText, ShoppingCart } from "lucide-react";

export default function FunilVendas({ orcamentos, vendas }) {
  const stats = {
    orcamentos: orcamentos.length,
    vendas: vendas.length,
    prospects: orcamentos.filter(o => o.status === "Em Aberto").length,
  };

  const etapas = [
    { titulo: "Orçamentos Gerados", valor: stats.orcamentos, icon: FileText, color: "text-indigo-600" },
    { titulo: "Oportunidades", valor: stats.prospects, icon: Users, color: "text-orange-600" },
    { titulo: "Vendas Fechadas", valor: stats.vendas, icon: ShoppingCart, color: "text-green-600" }
  ];

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-slate-200/50 shadow-lg h-full">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Funil de Vendas</h2>
      <div className="space-y-4">
        {etapas.map((etapa) => (
          <div key={etapa.titulo} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-2 rounded-lg">
                <etapa.icon className={`w-5 h-5 ${etapa.color}`} />
              </div>
              <p className="font-semibold text-slate-700">{etapa.titulo}</p>
            </div>
            <p className="font-bold text-slate-800 text-lg">{etapa.valor}</p>
          </div>
        ))}
      </div>
    </div>
  );
}