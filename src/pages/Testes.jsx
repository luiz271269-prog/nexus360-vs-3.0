import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TestSuite from "../components/tests/TestSuite";
import StressTest from "../components/tests/StressTest";
import { FileText, Zap } from "lucide-react";

export default function Testes() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="funcional" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="funcional" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Testes Funcionais
          </TabsTrigger>
          <TabsTrigger value="carga" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Testes de Carga
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funcional">
          <TestSuite />
        </TabsContent>

        <TabsContent value="carga">
          <StressTest />
        </TabsContent>
      </Tabs>
    </div>
  );
}