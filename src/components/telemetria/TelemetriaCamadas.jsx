import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS = {
  ok: 'bg-green-100 text-green-800',
  skipped: 'bg-slate-100 text-slate-700',
  error: 'bg-red-100 text-red-800',
  routed_out: 'bg-blue-100 text-blue-800',
  not_executed: 'bg-slate-50 text-slate-400'
};

function StatusDot({ tipo, count, total }) {
  if (count === 0) return null;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Badge variant="outline" className={`${STATUS_COLORS[tipo]} border-0 text-[10px] font-semibold`}>
      {tipo}: {count} ({pct}%)
    </Badge>
  );
}

export default function TelemetriaCamadas({ camadas, totalPipelines }) {
  if (!Array.isArray(camadas) || camadas.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500 text-sm">
          Nenhum dado de camada para o período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Camadas do Pipeline (1 → 9)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 w-12">#</th>
                <th className="text-left px-4 py-2">Camada</th>
                <th className="text-right px-4 py-2">Execuções</th>
                <th className="text-right px-4 py-2">Média</th>
                <th className="text-right px-4 py-2">Máx</th>
                <th className="text-left px-4 py-2">Distribuição</th>
              </tr>
            </thead>
            <tbody>
              {camadas.map((c) => (
                <tr key={c.camada} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-500">{c.camada}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{c.execucoes}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {c.duracao_media_ms > 0 ? `${c.duracao_media_ms} ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {c.max_duracao_ms > 0 ? `${c.max_duracao_ms} ms` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <StatusDot tipo="ok" count={c.status_count.ok} total={totalPipelines} />
                      <StatusDot tipo="skipped" count={c.status_count.skipped} total={totalPipelines} />
                      <StatusDot tipo="routed_out" count={c.status_count.routed_out} total={totalPipelines} />
                      <StatusDot tipo="error" count={c.status_count.error} total={totalPipelines} />
                      <StatusDot tipo="not_executed" count={c.status_count.not_executed} total={totalPipelines} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}