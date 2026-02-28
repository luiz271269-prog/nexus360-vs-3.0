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
  const isKanban = sidebarViewMode === 'kanban';
  const hasActiveChat = (threadAtiva && !criandoNovoContato) || (modoSelecaoMultipla && (contatosSelecionados.length > 0 || broadcastInterno));
  const hasMassaSend = modoEnvioMassa && contatosParaEnvioMassa.length > 0;

  // No modo kanban, o chat flutua sobre as colunas como overlay
  if (isKanban) {
    return (
      <div className="flex-1 flex overflow-hidden relative">
        {/* Kanban sempre visível atrás */}
        <div className="flex-1 overflow-hidden" />

        {/* Overlay do chat sobre o kanban */}
        {(hasActiveChat || hasMassaSend) && (
          <div className="absolute inset-0 z-30 flex pointer-events-none">
            {/* Área transparente à esquerda (1 coluna fixa "Minhas Conversas" ~212px) */}
            <div className="w-[212px] flex-shrink-0 pointer-events-none" />

            {/* Chat flutuando sobre as colunas restantes */}
            <div className="flex-1 flex pointer-events-auto shadow-2xl border-l border-slate-300 bg-white">
              {hasMassaSend ? (
                <ChatWindow thread={null} mensagens={[]} usuario={usuario} contatoPreCarregado={null}
                  onEnviarMensagem={async () => {}} onSendMessageOptimistic={handleEnviarMensagemOtimista}
                  onSendInternalMessageOptimistic={handleEnviarMensagemInternaOtimista} onShowContactInfo={() => {}}
                  onAtualizarMensagens={handleAtualizarMensagens} integracoes={integracoes}
                  selectedCategoria={selectedCategoria} modoSelecaoMultipla={true}
                  contatosSelecionados={contatosParaEnvioMassa} broadcastInterno={null}
                  onCancelarSelecao={() => { setModoEnvioMassa(false); setContatosParaEnvioMassa([]); }}
                  atendentes={atendentes} filterScope={filterScope} selectedIntegrationId={selectedIntegrationId}
                  selectedAttendantId={selectedAttendantId} contatoAtivo={null}
                  onFecharChat={() => { setModoEnvioMassa(false); setContatosParaEnvioMassa([]); }} />
              ) : (
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
                      onFecharChat={() => setThreadAtiva(null)} />
                  </div>
                  {showContactInfo && (contatoAtivo || contatoPreCarregado) &&
                    <ContactInfoPanel contact={contatoAtivo || contatoPreCarregado} threadAtual={threadAtiva}
                      onClose={() => setShowContactInfo(false)} onUpdate={handleAtualizarContato}
                      atendentes={atendentes} />}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Modo normal (lista/sidebar): comportamento original
  return (
    <div className="flex-1 flex overflow-hidden">
      {hasMassaSend ? (
        <ChatWindow thread={null} mensagens={[]} usuario={usuario} contatoPreCarregado={null}
          onEnviarMensagem={async () => {}} onSendMessageOptimistic={handleEnviarMensagemOtimista}
          onSendInternalMessageOptimistic={handleEnviarMensagemInternaOtimista} onShowContactInfo={() => {}}
          onAtualizarMensagens={handleAtualizarMensagens} integracoes={integracoes}
          selectedCategoria={selectedCategoria} modoSelecaoMultipla={true}
          contatosSelecionados={contatosParaEnvioMassa} broadcastInterno={null}
          onCancelarSelecao={() => { setModoEnvioMassa(false); setContatosParaEnvioMassa([]); }}
          atendentes={atendentes} filterScope={filterScope} selectedIntegrationId={selectedIntegrationId}
          selectedAttendantId={selectedAttendantId} contatoAtivo={null} />
      ) : hasActiveChat ? (
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
              onFecharChat={null} />
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