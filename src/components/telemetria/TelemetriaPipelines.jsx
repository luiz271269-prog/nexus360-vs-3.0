import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';

const STATUS_COLORS = {
  ok: 'bg-green-100 text-green-700',
  skipped: 'bg-slate-100 text-slate-600',
  error: 'bg-red-100 text-red-700',
  routed_out: 'bg-blue-100 text-blue-700',
  not_executed: 'bg-slate-50 text-slate-400'
};

function CamadaInline({ camada, entry }) {
  const status = entry?.status || 'not_executed';
  const dur = entry?.duration_ms;
  return (
    <div className="flex items-center gap-1 text-[11px]">
      <span className="text-slate-400 font-mono">{camada}</span>
      <Badge variant="outline" className={`${STATUS_COLORS[status]} border-0 px-1.5 py-0`}>
        {status}{typeof dur === 'number' ? ` · ${dur}ms` : ''}
      </Badge>
    </div>
  );
}

export default function TelemetriaPipelines({ pipelines }) {
  const [expanded, setExpanded] = useState(null);

  if (!Array.isArray(pipelines) || pipelines.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500 text-sm">
          Nenhum pipeline registrado no período.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Top 10 Pipelines Mais Lentos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {pipelines.map((p) => {
            const isOpen = expanded === p.id;
            return (
              <div key={p.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 text-left"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {(p.tempo_total_ms / 1000).toFixed(2)}s
                        <span className="ml-2 text-xs text-slate-500 font-normal">
                          {new Date(p.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        thread {p.thread_id?.substring(0, 8)} · {p.status_final}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={p.resultado === 'sucesso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                    {p.resultado}
                  </Badge>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-slate-50/50">
                    <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                        <CamadaInline
                          key={n}
                          camada={n}
                          entry={p.telemetria?.[`camada_${n}`]}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}