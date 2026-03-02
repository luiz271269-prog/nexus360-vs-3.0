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

  // Modo kanban: chat flutua como painel fixo overlay sobre o kanban
  if (isKanban) {
    return (
      <>
        {showFloating && (
          <div
            className="fixed right-0 bottom-0 z-40 flex flex-col shadow-2xl border-l-2 border-orange-400 bg-white"
            style={{ width: '480px', top: 0, paddingTop: 0 }}
          >
            {/* Botão fechar */}
            <button
              onClick={fecharChat}
              className="absolute top-1/2 left-[-28px] z-10 w-7 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-l-lg flex items-center justify-center text-xs shadow-lg -translate-y-1/2"
              title="Fechar chat"
            >✕</button>
            <div className="flex flex-col h-full overflow-hidden">
              {chatContent}
            </div>
          </div>
        )}
      </>
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