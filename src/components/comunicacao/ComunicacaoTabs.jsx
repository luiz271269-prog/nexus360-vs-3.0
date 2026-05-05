import React from 'react';
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Activity, Zap, BarChart3, Bug, Users, Settings } from "lucide-react";

/**
 * UI pura: barra de abas da Central de Comunicação.
 * Nenhuma prop — o controle de valor/troca fica no <Tabs> pai (Comunicacao.jsx).
 */
export default function ComunicacaoTabs() {
  return (
    <div className="bg-slate-700 px-2 md:px-6 border-b border-slate-600 flex-shrink-0 overflow-x-auto">
      <TabsList className="bg-transparent border-0 flex gap-0">
        <TabsTrigger value="conversas" className="gap-1 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all whitespace-nowrap">
          <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span>Conversas</span>
        </TabsTrigger>
        <TabsTrigger value="controle" className="gap-1 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all whitespace-nowrap">
          <Activity className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Controle</span>
        </TabsTrigger>
        <TabsTrigger value="automacao" className="gap-1 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all whitespace-nowrap">
          <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Automação</span>
        </TabsTrigger>
        <TabsTrigger value="diagnostico" className="gap-1 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all whitespace-nowrap">
          <BarChart3 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Diagnóstico</span>
        </TabsTrigger>
        <TabsTrigger value="diagnostico-cirurgico" className="gap-1 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all whitespace-nowrap">
          <Bug className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden md:inline">Cirúrgico</span>
        </TabsTrigger>
        <TabsTrigger value="etiquetas" className="gap-1 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all whitespace-nowrap">
          <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Etiquetas</span>
        </TabsTrigger>
        <TabsTrigger value="configuracoes" className="gap-1 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all whitespace-nowrap">
          <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Config</span>
        </TabsTrigger>
      </TabsList>
    </div>
  );
}