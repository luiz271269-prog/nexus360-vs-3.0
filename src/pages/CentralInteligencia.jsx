import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Brain, Gauge } from 'lucide-react';
import ControlCenter from '@/components/dashboard/ControlCenter';
import { MetricasInteligenciaConteudo } from '@/pages/InteligenciaMetricas';
import TelemetriaPreAtendimento from '@/pages/TelemetriaPreAtendimento';

// Aliases de rotas legadas: command/telemetria → aba unificada "operacao"
const normalizarTab = (t) => {
  if (t === 'metricas') return 'metricas';
  return 'operacao';
};

export default function CentralInteligencia() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(normalizarTab(searchParams.get('tab')));

  const mudarTab = (v) => {
    setTab(v);
    setSearchParams({ tab: v }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Tabs value={tab} onValueChange={mudarTab} className="w-full">
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 md:px-6 pt-3">
          <div className="max-w-7xl mx-auto">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="operacao" className="gap-2">
                <Gauge className="w-4 h-4" />
                Visão Operacional
              </TabsTrigger>
              <TabsTrigger value="metricas" className="gap-2">
                <Brain className="w-4 h-4" />
                Métricas IA
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="operacao" className="mt-0">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <ControlCenter />
          </div>
          <TelemetriaPreAtendimento />
        </TabsContent>

        <TabsContent value="metricas" className="mt-0">
          <MetricasInteligenciaConteudo />
        </TabsContent>
      </Tabs>
    </div>
  );
}