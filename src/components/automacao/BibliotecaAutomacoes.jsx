import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Workflow, Tag, MessageSquare, Zap, BarChart3 } from "lucide-react";
import PlaybookManagerURA from "./PlaybookManagerURA";
import PlaybookManager from "./PlaybookManager";
import QuickRepliesManager from "../comunicacao/QuickRepliesManager";
import GerenciadorPromocoes from "./GerenciadorPromocoes";
import CustoAutomacoesTab from "./CustoAutomacoesTab";

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
        <TabsList className="grid grid-cols-5 w-full bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
          <TabsTrigger 
            value="ura" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Zap className="w-4 h-4" />
            URAs
          </TabsTrigger>
          <TabsTrigger 
            value="playbooks" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Workflow className="w-4 h-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger 
            value="promocoes" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Tag className="w-4 h-4" />
            Promoções
          </TabsTrigger>
          <TabsTrigger 
            value="respostas" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <MessageSquare className="w-4 h-4" />
            Respostas Rápidas
          </TabsTrigger>
          <TabsTrigger 
            value="dashboard" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
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

        {/* TAB 3: PROMOÇÕES & OFERTAS */}
        <TabsContent value="promocoes" className="m-0">
          <GerenciadorPromocoes />
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

        {/* TAB 5: DASHBOARD / CUSTO */}
        <TabsContent value="dashboard" className="m-0">
          <CustoAutomacoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}