import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import LogsFiltragemViewer from "./LogsFiltragemViewer";
import DiagnosticoComparativoThreads from "./DiagnosticoComparativoThreads";
import DiagnosticoThreadsInvisiveis from "./DiagnosticoThreadsInvisiveis";
import DiagnosticoInbound from "./DiagnosticoInbound";
import DiagnosticoUnificadoPanel from "./DiagnosticoUnificadoPanel";
import GerenciadorEtiquetasUnificado from "./GerenciadorEtiquetasUnificado";
import ConfiguracaoCanaisComunicacao from "./ConfiguracaoCanaisComunicacao";
import GoToConnectionSetup from "./GoToConnectionSetup";

/**
 * UI pura: agrupa as 4 abas finais da Central de Comunicação
 * (diagnóstico, diagnóstico cirúrgico, etiquetas, configurações).
 * Sem state próprio. Apenas renderiza componentes filhos com props recebidas.
 */
export default function ComunicacaoTabsContent({
  usuario,
  todasIntegracoes,
  integracoes,
  gotoIntegracoes,
  queryClient,
  filterScope,
  selectedIntegrationId,
  selectedAttendantId,
  selectedTipoContato,
  selectedTagContato,
  threadsFiltradas,
  contatos,
  duplicataEncontrada
}) {
  return (
    <>
      <TabsContent value="diagnostico" className="h-full m-0 overflow-hidden">
        <div className="h-full overflow-y-auto p-6 space-y-6">
          <LogsFiltragemViewer />

          <DiagnosticoComparativoThreads
            usuario={usuario}
            filtros={{
              scope: filterScope,
              integracaoId: selectedIntegrationId,
              atendenteId: selectedAttendantId,
              tipoContato: selectedTipoContato,
              tagContato: selectedTagContato
            }}
            contatos={contatos}
            duplicataEncontrada={duplicataEncontrada}
            threadsUnicas={undefined}
            threadsNaoAtribuidasVisiveis={undefined} />

          <DiagnosticoThreadsInvisiveis
            usuario={usuario}
            filtros={{
              scope: filterScope,
              integracaoId: selectedIntegrationId,
              atendenteId: selectedAttendantId
            }}
            threads={threadsFiltradas}
            contatos={contatos} />

          <DiagnosticoInbound integracoes={integracoes} />
        </div>
      </TabsContent>

      <TabsContent value="diagnostico-cirurgico" className="h-full m-0 overflow-hidden">
        <div className="h-full overflow-y-auto p-6">
          <DiagnosticoUnificadoPanel />
        </div>
      </TabsContent>

      <TabsContent value="etiquetas" className="h-full m-0 overflow-hidden">
        <div className="h-full overflow-y-auto p-6">
          <GerenciadorEtiquetasUnificado usuarioAtual={usuario} />
        </div>
      </TabsContent>

      <TabsContent value="configuracoes" className="h-full m-0 overflow-hidden">
        <div className="h-full overflow-y-auto p-6 space-y-6">
          <ConfiguracaoCanaisComunicacao
            integracoes={integracoes}
            usuarioAtual={usuario}
            onRecarregar={() => {
              queryClient.invalidateQueries({ queryKey: ['integracoes'] });
              queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
            }} />

          <GoToConnectionSetup
            integracoes={gotoIntegracoes}
            onRecarregar={() => queryClient.invalidateQueries({ queryKey: ['goto-integrations'] })} />
        </div>
      </TabsContent>
    </>
  );
}