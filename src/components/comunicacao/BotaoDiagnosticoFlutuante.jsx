import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DiagnosticoBuscaGlobal from './DiagnosticoBuscaGlobal';
import DiagnosticoVisibilidadeRealtime from './DiagnosticoVisibilidadeRealtime';

export default function BotaoDiagnosticoFlutuante({ usuario, contatoAtivo, threadAtiva, mensagens, filterScope, selectedIntegrationId, selectedAttendantId }) {
  const [showDiagnostico, setShowDiagnostico] = useState(false);

  if (usuario?.role !== 'admin' || !threadAtiva) {
    return null;
  }

  return (
    <div className="absolute bottom-24 right-6 z-50">
      <div className="relative">
        <Button
          onClick={() => setShowDiagnostico(!showDiagnostico)}
          variant="outline"
          className="bg-red-500 hover:bg-red-600 text-white rounded-full w-14 h-14 shadow-lg border-2 border-white/50 focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition-all duration-300 transform hover:scale-110"
        >
          <Bug className="w-7 h-7" />
        </Button>
        {showDiagnostico && (
          <div className="absolute bottom-16 right-0 w-96 max-h-96 bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden z-50">
            <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-sm text-slate-700">Diagnósticos</h3>
              <button onClick={() => setShowDiagnostico(false)} className="p-1 hover:bg-slate-200 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-80">
              <Tabs defaultValue="visibilidade" className="w-full">
                <TabsList className="w-full rounded-none border-b bg-transparent p-0">
                  <TabsTrigger value="visibilidade" className="rounded-none flex-1 border-b-2 border-transparent data-[state=active]:border-red-500">
                    <span className="text-xs">Visibilidade</span>
                  </TabsTrigger>
                  <TabsTrigger value="busca" className="rounded-none flex-1 border-b-2 border-transparent data-[state=active]:border-red-500">
                    <span className="text-xs">Busca</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="visibilidade" className="p-3 m-0">
                  <DiagnosticoVisibilidadeRealtime
                    threadId={threadAtiva?.id}
                    ultimaMensagemRecebida={mensagens[mensagens.length - 1]}
                    filtros={{
                      scope: filterScope,
                      integracaoId: selectedIntegrationId,
                      atendente: selectedAttendantId
                    }}
                    realTimeActive={true}
                  />
                </TabsContent>
                <TabsContent value="busca" className="p-3 m-0">
                  <DiagnosticoBuscaGlobal
                    contactId={contatoAtivo?.id}
                    threadId={threadAtiva?.id}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}