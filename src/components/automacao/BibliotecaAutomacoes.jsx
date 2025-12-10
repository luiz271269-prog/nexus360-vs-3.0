import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Workflow, Tag, MessageSquare } from "lucide-react";
import PlaybookManager from "./PlaybookManager";
import QuickRepliesManager from "../comunicacao/QuickRepliesManager";
import GerenciadorPromocoes from "./GerenciadorPromocoes";

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
  const [activeTab, setActiveTab] = useState("playbooks");
  const [categoriaFiltro, setCategoriaFiltro] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Biblioteca de Automações 2.0</h2>
          <p className="text-slate-600 mt-1">Gerencie Playbooks, Promoções e Respostas Rápidas</p>
        </div>
      </div>

      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        setCategoriaFiltro("all");
        setSearchTerm("");
      }} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
          <TabsTrigger 
            value="playbooks" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Workflow className="w-4 h-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger 
            value="promocoes" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <Tag className="w-4 h-4" />
            Promoções & Ofertas
          </TabsTrigger>
          <TabsTrigger 
            value="respostas" 
            className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
          >
            <MessageSquare className="w-4 h-4" />
            Respostas Rápidas
          </TabsTrigger>
        </TabsList>

        {/* TAB: PLAYBOOKS */}
        <TabsContent value="playbooks" className="space-y-6 m-0">
          <PlaybookManager />
        </TabsContent>

        {/* TAB: PROMOÇÕES & OFERTAS */}
        <TabsContent value="promocoes" className="m-0">
          <GerenciadorPromocoes />
        </TabsContent>

        {/* TAB: RESPOSTAS RÁPIDAS */}
        <TabsContent value="respostas" className="m-0">
          <QuickRepliesManager 
            categoriaFiltro={categoriaFiltro}
            searchTerm={searchTerm}
            onCategoriaChange={setCategoriaFiltro}
            onSearchChange={setSearchTerm}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}