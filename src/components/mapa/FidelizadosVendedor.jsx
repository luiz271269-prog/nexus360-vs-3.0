import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Activity } from 'lucide-react';

// Contatos fidelizados de vendas por vendedor: total, ativos (verde) e parados (vermelho)
export default function FidelizadosVendedor({ ranking }) {
  if (!ranking || ranking.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-slate-400">Nenhum contato fidelizado de vendas encontrado.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck className="w-5 h-5 text-indigo-600" />
        <h2 className="font-bold text-slate-900">Contatos fidelizados por vendedor</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
        <Activity className="w-3 h-3" /> Ativo = interagiu nos últimos 7 dias · Parado = sem interação há mais de 7 dias
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ranking.map((v) => (
          <div key={v.vendedor} className="border rounded-lg p-3 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-800 truncate">{v.vendedor}</span>
              <Badge variant="outline" className="font-bold">{v.total}</Badge>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-green-100 text-green-700 rounded px-2 py-1 text-center">
                <div className="text-lg font-bold">{v.ativos}</div>
                <div className="text-[10px] uppercase tracking-wide">Ativos</div>
              </div>
              <div className="flex-1 bg-red-100 text-red-700 rounded px-2 py-1 text-center">
                <div className="text-lg font-bold">{v.parados}</div>
                <div className="text-[10px] uppercase tracking-wide">Parados</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}