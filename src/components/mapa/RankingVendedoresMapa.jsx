import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { corDoVendedor } from './coresVendedor';

const fmtMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// Ranking de faturamento por vendedor + suas principais regiões (cidades)
export default function RankingVendedoresMapa({ cidades, vendedores }) {
  // agrega faturamento por vendedor e regiões a partir de cidades[].porVendedor
  const porVend = {};
  (cidades || []).forEach((c) => {
    Object.entries(c.porVendedor || {}).forEach(([vend, valor]) => {
      if (!porVend[vend]) porVend[vend] = { vendedor: vend, total: 0, regioes: [] };
      porVend[vend].total += valor;
      porVend[vend].regioes.push({ cidade: c.cidade, uf: c.uf, valor });
    });
  });
  const ranking = Object.values(porVend)
    .map((v) => ({ ...v, regioes: v.regioes.sort((a, b) => b.valor - a.valor).slice(0, 3) }))
    .sort((a, b) => b.total - a.total);

  if (ranking.length === 0) {
    return <Card className="p-4"><p className="text-sm text-slate-400">Sem vendas localizadas para ranquear.</p></Card>;
  }

  return (
    <Card className="p-4">
      <h2 className="font-bold text-slate-900 mb-3">Vendedores por região</h2>
      <div className="space-y-3">
        {ranking.map((v) => (
          <div key={v.vendedor} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: corDoVendedor(v.vendedor, vendedores) }} />
                <span className="font-semibold text-slate-800 truncate">{v.vendedor}</span>
              </div>
              <Badge className="bg-emerald-600 shrink-0">{fmtMoeda(v.total)}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {v.regioes.map((r, i) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">
                  {r.cidade}/{r.uf} · {fmtMoeda(r.valor)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}