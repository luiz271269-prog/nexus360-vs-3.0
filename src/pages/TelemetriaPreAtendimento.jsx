import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, Loader2 } from 'lucide-react';
import TelemetriaKPIs from '@/components/telemetria/TelemetriaKPIs';
import TelemetriaCamadas from '@/components/telemetria/TelemetriaCamadas';
import TelemetriaPipelines from '@/components/telemetria/TelemetriaPipelines';
import TelemetriaEventos from '@/components/telemetria/TelemetriaEventos';

const PERIODOS = [
  { label: '1h', horas: 1 },
  { label: '6h', horas: 6 },
  { label: '24h', horas: 24 },
  { label: '7d', horas: 168 }
];

export default function TelemetriaPreAtendimento() {
  const [horas, setHoras] = useState(24);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['telemetria-pre-atend', horas],
    queryFn: async () => {
      const res = await base44.functions.invoke('getTelemetriaPreAtendimento', { horas });
      return res?.data || res;
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000
  });

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Telemetria do Pré-Atendimento</h1>
            <p className="text-xs text-slate-500">
              Observabilidade das 9 camadas da skill · {data?.desde ? `desde ${new Date(data.desde).toLocaleString('pt-BR')}` : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {PERIODOS.map(p => (
              <button
                key={p.horas}
                onClick={() => setHoras(p.horas)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  horas === p.horas
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />
            }
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Carregando telemetria...</span>
          </CardContent>
        </Card>
      ) : data?.error ? (
        <Card>
          <CardContent className="p-6 text-center text-red-600">
            Erro: {data.error}
          </CardContent>
        </Card>
      ) : (
        <>
          <TelemetriaKPIs kpis={data?.kpis} horas={horas} />
          <TelemetriaCamadas
            camadas={data?.camadas}
            totalPipelines={data?.kpis?.total_pipelines || 0}
          />
          <TelemetriaEventos eventos={data?.eventos_pre_atendimento} />
          <TelemetriaPipelines pipelines={data?.pipelines_lentos} />
        </>
      )}
    </div>
  );
}