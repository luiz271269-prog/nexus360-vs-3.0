import React from 'react';
import { Trophy, Award, Medal, DollarSign } from 'lucide-react';

export default function RankingClientes({ clientes }) {
  const ranking = [...clientes]
    .sort((a, b) => (b.valor_recorrente_mensal || 0) - (a.valor_recorrente_mensal || 0))
    .slice(0, 5);

  const getRankInfo = (index) => {
    if (index === 0) return { icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-100" };
    if (index === 1) return { icon: Award, color: "text-slate-500", bg: "bg-slate-100" };
    if (index === 2) return { icon: Medal, color: "text-orange-500", bg: "bg-orange-100" };
    return { icon: null, color: "text-slate-400", bg: "bg-slate-50" };
  };

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-slate-200/50 shadow-lg h-full">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Ranking de Clientes</h2>
      
      {ranking.length > 0 ? (
        <div className="space-y-4">
          {ranking.map((cliente, index) => {
            const { icon: RankIcon, color: rankColor, bg: rankBg } = getRankInfo(index);
            return (
              <div key={cliente.id} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/50 flex items-center gap-4">
                <div className={`w-10 h-10 ${rankBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  {RankIcon ? <RankIcon className={`w-6 h-6 ${rankColor}`} /> : <span className={`font-bold text-lg ${rankColor}`}>{index + 1}</span>}
                </div>
                <div className="flex-grow overflow-hidden">
                  <p className="font-bold text-slate-800 truncate">{cliente.nome_fantasia || cliente.razao_social}</p>
                  <div className="text-sm text-slate-600 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-green-600"/>
                    <span>R$ {(cliente.valor_recorrente_mensal || 0).toLocaleString('pt-BR')} /mês</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          Não há dados suficientes para gerar um ranking.
        </div>
      )}
    </div>
  );
}