import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Settings, BarChart3, History } from 'lucide-react';
import PainelSaudeBroadcast from './PainelSaudeBroadcast';
import PainelConfiguracaoBroadcast from './PainelConfiguracaoBroadcast';
import AnalyticsBroadcast from './AnalyticsBroadcast';
import HistoricoPromocoes from './HistoricoPromocoes';

export default function HubBroadcast() {
  const [aba, setAba] = useState('saude');

  return (
    <Tabs value={aba} onValueChange={setAba} className="w-full">
      <TabsList className="grid grid-cols-4 w-full max-w-3xl mx-auto bg-slate-100">
        <TabsTrigger value="saude" className="gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
          <Activity className="w-4 h-4" /> Saúde
        </TabsTrigger>
        <TabsTrigger value="historico" className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
          <History className="w-4 h-4" /> Histórico
        </TabsTrigger>
        <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
          <Settings className="w-4 h-4" /> Configurações
        </TabsTrigger>
        <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white">
          <BarChart3 className="w-4 h-4" /> Analytics
        </TabsTrigger>
      </TabsList>

      <TabsContent value="saude" className="mt-2"><PainelSaudeBroadcast /></TabsContent>
      <TabsContent value="historico" className="mt-2"><HistoricoPromocoes /></TabsContent>
      <TabsContent value="config" className="mt-2"><PainelConfiguracaoBroadcast /></TabsContent>
      <TabsContent value="analytics" className="mt-2"><AnalyticsBroadcast /></TabsContent>
    </Tabs>
  );
}