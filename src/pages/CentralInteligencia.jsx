import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Brain, Gauge, Activity } from 'lucide-react';
import ControlCenter from '@/components/dashboard/ControlCenter';
import { MetricasInteligenciaConteudo } from '@/pages/InteligenciaMetricas';
import TelemetriaPreAtendimento from '@/pages/TelemetriaPreAtendimento';

const TABS_VALIDAS = ['command', 'metricas', 'telemetria'];

export default function CentralInteligencia() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(TABS_VALIDAS.includes(tabParam) ? tabParam : 'command');

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
              <TabsTrigger value="command" className="gap-2">
                <Gauge className="w-4 h-4" />
                Command Center
              </TabsTrigger>
              <TabsTrigger value="metricas" className="gap-2">
                <Brain className="w-4 h-4" />
                Métricas IA
              </TabsTrigger>
              <TabsTrigger value="telemetria" className="gap-2">
                <Activity className="w-4 h-4" />
                Telemetria Pré-Atendimento
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="command" className="mt-0">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <ControlCenter />
          </div>
        </TabsContent>

        <TabsContent value="metricas" className="mt-0">
          <MetricasInteligenciaConteudo />
        </TabsContent>

        <TabsContent value="telemetria" className="mt-0">
          <TelemetriaPreAtendimento />
        </TabsContent>
      </Tabs>
    </div>
  );
}