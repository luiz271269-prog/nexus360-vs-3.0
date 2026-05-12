import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function TelemetriaKPIs({ kpis, horas }) {
  if (!kpis) return null;

  const items = [
    {
      label: `Pipelines (${horas}h)`,
      value: kpis.total_pipelines,
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      label: 'Sucesso',
      value: `${kpis.total_sucesso} (${kpis.taxa_sucesso_pct}%)`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      label: 'Erros',
      value: kpis.total_erro,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50'
    },
    {
      label: 'Tempo médio',
      value: `${(kpis.tempo_medio_ms / 1000).toFixed(2)}s`,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.label} className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${it.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${it.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{it.label}</p>
                <p className="text-xl font-bold text-slate-800">{it.value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}