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
  const showFloating = hasActiveChat || hasMassaSend;

  const fecharChat = () => {
    setThreadAtiva(null);
    setModoSelecaoMultipla(false);
    setContatosSelecionados([]);
    setBroadcastInterno(null);
    setModoEnvioMassa(false);
    setContatosParaEnvioMassa([]);
  };

  const chatContent = (
    <>
      <div className="flex-1 overflow-hidden relative">
        {hasMassaSend ? (
          <ChatWindow thread={null} mensagens={[]} usuario={usuario} contatoPreCarregado={null}
            onEnviarMensagem={async () => {}} onSendMessageOptimistic={handleEnviarMensagemOtimista}
            onSendInternalMessageOptimistic={handleEnviarMensagemInternaOtimista} onShowContactInfo={() => {}}
            onAtualizarMensagens={handleAtualizarMensagens} integracoes={integracoes}
            selectedCategoria={selectedCategoria} modoSelecaoMultipla={true}
            contatosSelecionados={contatosParaEnvioMassa} broadcastInterno={null}
            onCancelarSelecao={fecharChat}
            atendentes={atendentes} filterScope={filterScope} selectedIntegrationId={selectedIntegrationId}
            selectedAttendantId={selectedAttendantId} contatoAtivo={null}
            onFecharChat={fecharChat} />
        ) : (
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
            onFecharChat={fecharChat} />
        )}
      </div>
      {!hasMassaSend && showContactInfo && (contatoAtivo || contatoPreCarregado) && (
        <ContactInfoPanel contact={contatoAtivo || contatoPreCarregado} threadAtual={threadAtiva}
          onClose={() => setShowContactInfo(false)} onUpdate={handleAtualizarContato}
          atendentes={atendentes} />
      )}
    </>
  );

  // Modo kanban: Kanban ocupa tudo, chat flutua lado a lado SEM cobrir o kanban
  if (isKanban) {
    return (
      <div className="flex-1 flex overflow-hidden relative">
        {/* Kanban sempre visível e acessível - ocupa todo o espaço */}
        <div className="flex-1 overflow-hidden" />

        {/* Chat flutuante fixo à direita, sem backdrop, kanban continua acessível */}
        {showFloating && (
          <div
            className="absolute top-0 right-0 bottom-0 z-30 flex shadow-2xl border-l-2 border-orange-400 rounded-l-xl overflow-hidden"
            style={{ width: '480px' }}
          >
            {chatContent}
          </div>
        )}
      </div>
    );
  }

  // Modo lista: layout normal lado a lado
  return (
    <div className="flex-1 flex overflow-hidden">
      {hasMassaSend ? (
        <div className="flex-1 flex">{chatContent}</div>
      ) : showFloating ? (
        <div className="flex-1 flex">{chatContent}</div>
      ) : criandoNovoContato ? (
        <>
          <EmptyState message={contactInitialData ? "Criar Contato do Cliente" : "Criar Novo Contato"}
            subtitle={contactInitialData ? `Cliente: ${contactInitialData.empresa || contactInitialData.nome}` : "Preencha as informações ao lado"} />
          <ContactInfoPanel contact={null} novoContatoTelefone={novoContatoTelefone}
            defaultValues={contactInitialData}
            onClose={() => {}}
            onUpdate={handleCriarNovoContato} atendentes={atendentes} />
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}