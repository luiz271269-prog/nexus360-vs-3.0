import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings2, LayoutGrid } from 'lucide-react';
import GerenciadorPromocoes from '../components/automacao/GerenciadorPromocoes';
import VisaoCombinadaPromocoes from '../components/automacao/VisaoCombinadaPromocoes';

export default function Promocoes() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-red-50">
      <div className="p-6">
        <Tabs defaultValue="gestao" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="gestao" className="gap-2">
              <Settings2 className="w-4 h-4" /> Gestão
            </TabsTrigger>
            <TabsTrigger value="combinada" className="gap-2">
              <LayoutGrid className="w-4 h-4" /> Visão Combinada
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gestao" className="mt-0">
            <GerenciadorPromocoes />
          </TabsContent>

          <TabsContent value="combinada" className="mt-0">
            <VisaoCombinadaPromocoes />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}