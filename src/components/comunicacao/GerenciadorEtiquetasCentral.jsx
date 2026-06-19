import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, MessageSquare, Copy } from "lucide-react";
import GerenciadorEtiquetasUnificado from "./GerenciadorEtiquetasUnificado";
import GerenciadorEtiquetasConversa from "./GerenciadorEtiquetasConversa";
import DeduplicadorEtiquetas from "./DeduplicadorEtiquetas";

/**
 * FONTE ÚNICA de gerenciamento de etiquetas.
 * Centraliza os 3 níveis em um só lugar (Automações):
 *  - Contato (EtiquetaContato → Contact.tags) por setor
 *  - Conversa (EtiquetaConversa → MessageThread.tags) por setor
 *  - Deduplicação (funde duplicadas dos dois níveis)
 * Reaproveita os componentes existentes sem duplicar lógica.
 */
export default function GerenciadorEtiquetasCentral({ usuarioAtual }) {
  return (
    <Tabs defaultValue="contato" className="space-y-4">
      <TabsList className="bg-slate-100">
        <TabsTrigger value="contato" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
          <Tag className="w-3.5 h-3.5 mr-1.5" /> Contato
        </TabsTrigger>
        <TabsTrigger value="conversa" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
          <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Conversa
        </TabsTrigger>
        <TabsTrigger value="deduplicacao" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Deduplicação
        </TabsTrigger>
      </TabsList>

      <TabsContent value="contato">
        <GerenciadorEtiquetasUnificado usuarioAtual={usuarioAtual} />
      </TabsContent>
      <TabsContent value="conversa">
        <GerenciadorEtiquetasConversa usuarioAtual={usuarioAtual} />
      </TabsContent>
      <TabsContent value="deduplicacao">
        <DeduplicadorEtiquetas usuarioAtual={usuarioAtual} />
      </TabsContent>
    </Tabs>
  );
}