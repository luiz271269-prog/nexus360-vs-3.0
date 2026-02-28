import React from "react";
import ChatWindow from "./ChatWindow";
import ContactInfoPanel from "./ContactInfoPanel";
import EmptyState from "./EmptyState";

export default function DesktopChatArea({
  modoEnvioMassa, contatosParaEnvioMassa, modoSelecaoMultipla, contatosSelecionados, broadcastInterno,
  threadAtiva, criandoNovoContato, mensagens, usuario, contatoPreCarregado,
  handleEnviarMensagemOtimista, handleEnviarMensagemInternaOtimista, handleAtualizarMensagens,
  integracoes, selectedCategoria, atendentes, filterScope, selectedIntegrationId, selectedAttendantId,
  contatoAtivo, showContactInfo, handleAtualizarContato, novoContatoTelefone, contactInitialData,
  handleCriarNovoContato, setModoEnvioMassa, setContatosParaEnvioMassa, setModoSelecaoMultipla,
  setContatosSelecionados, setBroadcastInterno, setShowContactInfo, setThreadAtiva, sidebarViewMode,
}) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {modoEnvioMassa && contatosParaEnvioMassa.length > 0 ? (
        <ChatWindow thread={null} mensagens={[]} usuario={usuario} contatoPreCarregado={null}
          onEnviarMensagem={async () => {}} onSendMessageOptimistic={handleEnviarMensagemOtimista}
          onSendInternalMessageOptimistic={handleEnviarMensagemInternaOtimista} onShowContactInfo={() => {}}
          onAtualizarMensagens={handleAtualizarMensagens} integracoes={integracoes}
          selectedCategoria={selectedCategoria} modoSelecaoMultipla={true}
          contatosSelecionados={contatosParaEnvioMassa} broadcastInterno={null}
          onCancelarSelecao={() => { setModoEnvioMassa(false); setContatosParaEnvioMassa([]); }}
          atendentes={atendentes} filterScope={filterScope} selectedIntegrationId={selectedIntegrationId}
          selectedAttendantId={selectedAttendantId} contatoAtivo={null} />
      ) : threadAtiva && !criandoNovoContato || modoSelecaoMultipla && (contatosSelecionados.length > 0 || broadcastInterno) ? (
        <>
          <div className="flex-1 overflow-hidden relative">
            <ChatWindow thread={threadAtiva} mensagens={mensagens} usuario={usuario}
              contatoPreCarregado={contatoPreCarregado} onEnviarMensagem={async () => {}}
              onSendMessageOptimistic={handleEnviarMensagemOtimista}
              onSendInternalMessageOptimistic={handleEnviarMensagemInternaOtimista}
              onShowContactInfo={() => setShowContactInfo(!showContactInfo)}
              onAtualizarMensagens={handleAtualizarMensagens} integracoes={integracoes}
              selectedCategoria={selectedCategoria} modoSelecaoMultipla={modoSelecaoMultipla}
              contatosSelecionados={contatosSelecionados} broadcastInterno={broadcastInterno}
              onCancelarSelecao={() => { setModoSelecaoMultipla(false); setContatosSelecionados([]); setBroadcastInterno(null); }}
              atendentes={atendentes} filterScope={filterScope} selectedIntegrationId={selectedIntegrationId}
              selectedAttendantId={selectedAttendantId} contatoAtivo={contatoAtivo}
              onFecharChat={sidebarViewMode === 'kanban' ? () => setThreadAtiva(null) : null} />
          </div>
          {showContactInfo && (contatoAtivo || contatoPreCarregado) &&
            <ContactInfoPanel contact={contatoAtivo || contatoPreCarregado} threadAtual={threadAtiva}
              onClose={() => setShowContactInfo(false)} onUpdate={handleAtualizarContato}
              atendentes={atendentes} />}
        </>
      ) : criandoNovoContato ? (
        <>
          <EmptyState message={contactInitialData ? "Criar Contato do Cliente" : "Criar Novo Contato"}
            subtitle={contactInitialData ? `Cliente: ${contactInitialData.empresa || contactInitialData.nome}` : "Preencha as informações ao lado"} />
          <ContactInfoPanel contact={null} novoContatoTelefone={novoContatoTelefone}
            defaultValues={contactInitialData}
            onClose={() => {}}
            onUpdate={handleCriarNovoContato} atendentes={atendentes} />
        </>
      ) : <EmptyState />}
    </div>
  );
}