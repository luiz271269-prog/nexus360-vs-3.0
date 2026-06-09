import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Workflow, MessageSquare, Zap, BarChart3, Activity } from "lucide-react";
import PlaybookManagerURA from "./PlaybookManagerURA";
import PlaybookManager from "./PlaybookManager";
import QuickRepliesManager from "../comunicacao/QuickRepliesManager";
import CustoAutomacoesTab from "./CustoAutomacoesTab";
import HubBroadcast from "./HubBroadcast";

/**
 * Biblioteca de Automações 2.0
 * Centraliza o gerenciamento de:
 * - Playbooks (FlowTemplate)
 * - Promoções & Ofertas (Promotion)
 * - Respostas Rápidas (QuickReply)
 * 
 * Nota: Pré-Atendimento agora é gerenciado exclusivamente pelo Motor de Decisão
 */
export default function BibliotecaAutomacoes() {
  const [activeTab, setActiveTab] = useState("ura");
  const [categoriaFiltro, setCategoriaFiltro] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        setCategoriaFiltro("all");
        setSearchTerm("");
      }} className="space-y-6">
        <TabsList className="flex md:grid md:grid-cols-5 w-full overflow-x-auto md:overflow-visible no-scrollbar bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 h-auto p-1 gap-1">
          <TabsTrigger 
            value="ura" 
            className="shrink-0 gap-1.5 px-3 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Zap className="w-4 h-4" />
            URAs
          </TabsTrigger>
          <TabsTrigger 
            value="playbooks" 
            className="shrink-0 gap-1.5 px-3 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Workflow className="w-4 h-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger 
            value="respostas" 
            className="shrink-0 gap-1.5 px-3 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <MessageSquare className="w-4 h-4" />
            Respostas
          </TabsTrigger>
          <TabsTrigger 
            value="saude" 
            className="shrink-0 gap-1.5 px-3 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Activity className="w-4 h-4" />
            Saúde
          </TabsTrigger>
          <TabsTrigger 
            value="dashboard" 
            className="shrink-0 gap-1.5 px-3 text-xs md:text-sm whitespace-nowrap data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: URAs PRÉ-ATENDIMENTO */}
        <TabsContent value="ura" className="space-y-6 m-0">
          <PlaybookManagerURA />
        </TabsContent>

        {/* TAB 2: PLAYBOOKS GENÉRICOS */}
        <TabsContent value="playbooks" className="space-y-6 m-0">
          <PlaybookManager />
        </TabsContent>

        {/* TAB 4: RESPOSTAS RÁPIDAS */}
        <TabsContent value="respostas" className="m-0">
          <QuickRepliesManager 
            categoriaFiltro={categoriaFiltro}
            searchTerm={searchTerm}
            onCategoriaChange={setCategoriaFiltro}
            onSearchChange={setSearchTerm}
          />
        </TabsContent>

        {/* TAB 5: SAÚDE DE BROADCAST (Hub: Saúde + Config + Analytics) */}
        <TabsContent value="saude" className="m-0">
          <HubBroadcast />
        </TabsContent>

        {/* TAB 6: DASHBOARD / CUSTO */}
        <TabsContent value="dashboard" className="m-0">
          <CustoAutomacoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}