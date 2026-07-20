import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bot, Brain, Sparkles, MessageSquare } from 'lucide-react';
import SuperAgente from './SuperAgente';
import AprendizadosSemanais from './AprendizadosSemanais';
import NexusChat from '@/components/global/NexusChat';
import CopilotoIA from '@/components/global/CopilotoIA';

export default function CentralIA() {
  const tabInicial = new URLSearchParams(window.location.search).get('tab') || 'agente';
  const { data: usuario } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Tabs defaultValue={tabInicial} className="flex flex-col h-screen bg-transparent">
      <div className="px-4 pt-3 flex-shrink-0">
        <TabsList className="bg-white/70 border border-purple-200 shadow-sm">
          <TabsTrigger value="agente" className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Bot className="w-4 h-4" /> Super Agente
          </TabsTrigger>
          <TabsTrigger value="aprendizados" className="gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Brain className="w-4 h-4" /> Aprendizados Semanais
          </TabsTrigger>
          <TabsTrigger value="nexus" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Sparkles className="w-4 h-4" /> Nexus AI
          </TabsTrigger>
          <TabsTrigger value="copiloto" className="gap-2 data-[state=active]:bg-violet-700 data-[state=active]:text-white">
            <MessageSquare className="w-4 h-4" /> Copiloto Jarvis
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="agente" className="flex-1 min-h-0 overflow-hidden m-0">
        <SuperAgente />
      </TabsContent>

      <TabsContent value="aprendizados" className="flex-1 min-h-0 overflow-y-auto m-0">
        <AprendizadosSemanais />
      </TabsContent>

      <TabsContent value="nexus" className="flex-1 min-h-0 m-0 p-4">
        <div className="h-full max-w-3xl mx-auto">
          <NexusChat
            isOpen={true}
            onToggle={() => {}}
            embedded
            agentSession={{ status: 'online', activeRuns: 0 }}
            agentContext={{ page: 'CentralIA', path: '/CentralIA' }}
          />
        </div>
      </TabsContent>

      <TabsContent value="copiloto" className="flex-1 min-h-0 m-0 p-4">
        <div className="h-full max-w-3xl mx-auto rounded-2xl border border-purple-200 shadow-sm overflow-hidden">
          <CopilotoIA
            isOpen={true}
            onClose={() => {}}
            embedded
            usuario={usuario}
            contextoAtivo="CentralIA"
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}