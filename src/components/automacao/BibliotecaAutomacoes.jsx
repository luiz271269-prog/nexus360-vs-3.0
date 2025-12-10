import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, MessageSquare, Tag } from "lucide-react";
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
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="playbooks" className="gap-2">
            <Zap className="w-4 h-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="promocoes" className="gap-2">
            <Tag className="w-4 h-4" />
            Promoções & Ofertas
          </TabsTrigger>
          <TabsTrigger value="respostas" className="gap-2">
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