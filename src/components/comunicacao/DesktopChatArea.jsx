import React from "react";
import ChatWindow from "./ChatWindow";
import ContactInfoPanel from "./ContactInfoPanel";
import EmptyState from "./EmptyState";

function useHeaderHeight() {
  const [top, setTop] = React.useState(0);
  React.useEffect(() => {
    const update = () => {
      const header = document.querySelector('header, [class*="header"], .flex-shrink-0');
      if (header) {
        const rect = header.getBoundingClientRect();
        setTop(rect.bottom);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return top;
}

function useDraggablePanel(initialTop) {
  const [pos, setPos] = React.useState({ top: null, bottom: 0 });
  const dragging = React.useRef(false);
  const startY = React.useRef(0);
  const startTop = React.useRef(0);

  const onMouseDown = React.useCallback((e) => {
    dragging.current = true;
    startY.current = e.clientY;
    const el = e.currentTarget.closest('[data-drag-panel]');
    startTop.current = el ? el.getBoundingClientRect().top : (pos.top ?? initialTop ?? 0);
    e.preventDefault();
  }, [pos.top, initialTop]);

  React.useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientY - startY.current;
      const newTop = Math.max(0, startTop.current + delta);
      setPos({ top: newTop, bottom: 'auto' });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return { pos, onMouseDown };
}

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

  const headerHeight = useHeaderHeight();
  const { pos, onMouseDown } = useDraggablePanel(headerHeight);

  const panelTop = pos.top !== null ? pos.top : (headerHeight || 0);
  // Panel height: 80vh from its top position, leaving some bottom gap
  const panelHeight = `calc(100vh - ${panelTop}px - 32px)`;

  // Modo kanban: chat flutua como painel fixo overlay sobre o kanban
  if (isKanban) {
    return (
      <>
        {showFloating && (
          <div
            data-drag-panel
            className="fixed right-0 z-40 flex flex-col shadow-2xl border-l-2 border-orange-400 bg-white"
            style={{ width: '480px', top: panelTop, height: panelHeight }}
          >
            {/* Drag handle */}
            <div
              onMouseDown={onMouseDown}
              className="absolute top-0 left-0 right-0 h-5 cursor-ns-resize z-20 flex items-center justify-center select-none"
              title="Arrastar"
            >
              <div className="w-12 h-1 bg-orange-300 rounded-full" />
            </div>
            {/* Botão fechar */}
            <button
              onClick={fecharChat}
              className="absolute top-1/2 left-[-28px] z-10 w-7 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-l-lg flex items-center justify-center text-xs shadow-lg -translate-y-1/2"
              title="Fechar chat"
            >✕</button>
            <div className="flex flex-col h-full overflow-hidden pt-5">
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