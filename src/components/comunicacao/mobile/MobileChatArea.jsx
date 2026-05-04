import React from 'react';
import { toast } from 'sonner';
import SearchAndFilter from '../SearchAndFilter';
import ChatSidebar from '../ChatSidebar';
import ChatSidebarKanban from '../ChatSidebarKanban';
import ChatWindow from '../ChatWindow';
import ContactInfoPanel from '../ContactInfoPanel';
import EmptyState from '../EmptyState';
import ContatosNaoAtribuidosKanban from '../ContatosNaoAtribuidosKanban';
import ContatosRequerendoAtencaoKanban from '../ContatosRequerendoAtencaoKanban';

/**
 * MobileChatArea — espelho mobile do DesktopChatArea.
 * UI pura: recebe estado e handlers do Comunicacao.jsx via props.
 * Encapsula a tela única alternante (lista ↔ chat) do mobile.
 */
export default function MobileChatArea({
  // mobile view state
  mobileView, setMobileView,
  // sidebar/filtros
  sidebarViewMode, onSidebarViewModeChange,
  searchTerm, onSearchChange,
  filterScope, onFilterScopeChange,
  selectedAttendantId, onSelectedAttendantChange,
  atendentes, isManager,
  novoContatoTelefone, onNovoContatoTelefoneChange, setNovoContatoTelefone,
  integracoes, selectedIntegrationId, onSelectedIntegrationChange,
  selectedCategoria, onSelectedCategoriaChange,
  selectedTipoContato, onSelectedTipoContatoChange,
  selectedTagContato, onSelectedTagContatoChange,
  modoSelecaoMultipla, setModoSelecaoMultipla,
  // dados
  usuario, threads, threadAtiva,
  threadsParaExibir, loadingTopics,
  contatos, contatosSelecionados, setContatosSelecionados,
  // kanbans
  mostrarKanbanNaoAtribuidos, setMostrarKanbanNaoAtribuidos,
  mostrarKanbanRequerAtencao, setMostrarKanbanRequerAtencao,
  // criação contato
  criandoNovoContato, setCriandoNovoContato,
  setThreadAtiva, setShowContactInfo,
  contatoPreCarregado, contactInitialData, setContactInitialData,
  // mensagens / broadcast
  mensagens, broadcastInterno, setBroadcastInterno,
  contatoAtivo,
  // ui flags
  isPendingFilter, setDuplicataEncontrada,
  // handlers
  handleSelecionarThreadMobile,
  handleVoltarListaMobile,
  handleSelecionarThread,
  handleInternalSelection,
  handleEnviarMensagemOtimista,
  handleEnviarMensagemInternaOtimista,
  handleAtualizarMensagens,
  handleCriarNovoContato
}) {
  return (
    <div className="flex md:hidden h-full flex-col min-h-0">

      {/* TELA: LISTA */}
      {mobileView === 'lista' && (
        <div className="flex flex-col h-full min-h-0 bg-white">
          <SearchAndFilter
            sidebarViewMode={sidebarViewMode}
            onSidebarViewModeChange={onSidebarViewModeChange}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            filterScope={filterScope}
            onFilterScopeChange={onFilterScopeChange}
            selectedAttendantId={selectedAttendantId}
            onSelectedAttendantChange={onSelectedAttendantChange}
            atendentes={atendentes}
            isManager={isManager}
            novoContatoTelefone={novoContatoTelefone}
            onNovoContatoTelefoneChange={onNovoContatoTelefoneChange}
            onCreateContact={() => { setCriandoNovoContato(true); setThreadAtiva(null); setShowContactInfo(true); setMobileView('chat'); }}
            integracoes={integracoes}
            selectedIntegrationId={selectedIntegrationId}
            onSelectedIntegrationChange={onSelectedIntegrationChange}
            selectedCategoria={selectedCategoria}
            onSelectedCategoriaChange={onSelectedCategoriaChange}
            selectedTipoContato={selectedTipoContato}
            onSelectedTipoContatoChange={onSelectedTipoContatoChange}
            selectedTagContato={selectedTagContato}
            onSelectedTagContatoChange={onSelectedTagContatoChange}
            modoSelecaoMultipla={modoSelecaoMultipla}
            onModoSelecaoMultiplaChange={setModoSelecaoMultipla}
            isAdmin={usuario?.role === 'admin'}
            onAbrirDiagnostico={() => toast.info('💡 Use o Unificador Centralizado para corrigir duplicatas')}
            onDuplicataDetectada={setDuplicataEncontrada} />

          <div className={`flex-1 overflow-y-auto transition-opacity duration-200 ${isPendingFilter ? 'opacity-50' : 'opacity-100'}`}>
            {sidebarViewMode === 'kanban' ? (
              <ChatSidebarKanban threads={threads} threadAtiva={threadAtiva}
                onSelecionarThread={(t) => { handleSelecionarThreadMobile(t); setMobileView('chat'); }}
                onVoltar={() => setThreadAtiva(null)} usuarioAtual={usuario}
                integracoes={integracoes} atendentes={atendentes}
                onSelectInternalDestinations={(sel) => { handleInternalSelection(sel); setMobileView('chat'); }}
                onOpenKanbanNaoAtribuidos={() => { setMostrarKanbanNaoAtribuidos(true); setMobileView('chat'); }}
                onOpenKanbanRequerAtencao={() => { setMostrarKanbanRequerAtencao(true); setMobileView('chat'); }} />
            ) : (
              <ChatSidebar threads={threadsParaExibir} threadAtiva={threadAtiva}
                onSelecionarThread={handleSelecionarThreadMobile} loading={loadingTopics}
                usuarioAtual={usuario} integracoes={integracoes} atendentes={atendentes}
                modoSelecaoMultipla={modoSelecaoMultipla} setModoSelecaoMultipla={setModoSelecaoMultipla}
                contatosSelecionados={contatosSelecionados} setContatosSelecionados={setContatosSelecionados}
                onSelectInternalDestinations={(sel) => { handleInternalSelection(sel); setMobileView('chat'); }}
                onFilterScopeChange={onFilterScopeChange} onSelectedIntegrationChange={onSelectedIntegrationChange}
                filterScope={filterScope} contatos={contatos}
                onOpenKanbanNaoAtribuidos={() => { setMostrarKanbanNaoAtribuidos(true); setMobileView('chat'); }}
                onOpenKanbanRequerAtencao={() => { setMostrarKanbanRequerAtencao(true); setMobileView('chat'); }} />
            )}
          </div>
        </div>
      )}

      {/* TELA: CHAT */}
      {mobileView === 'chat' && (
        <div className="flex flex-col h-full min-h-0">
          {/* Barra de voltar */}
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0 safe-area-inset-top">
            {mostrarKanbanRequerAtencao && (
              <button
                onClick={() => setMostrarKanbanRequerAtencao(false)}
                className="flex items-center gap-2 text-white text-sm font-medium"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </button>
            )}
            {!mostrarKanbanRequerAtencao && (
              <button
                onClick={handleVoltarListaMobile}
                className="flex items-center gap-2 text-white text-sm font-medium"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Conversas
              </button>
            )}
            {contatoAtivo && (
              <span className="text-slate-300 text-sm truncate flex-1">
                {contatoAtivo.nome}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            {mostrarKanbanNaoAtribuidos ? (
              <ContatosNaoAtribuidosKanban
                usuario={usuario}
                threads={threads}
                contatos={contatos}
                onSelecionarContato={(t) => {
                  handleSelecionarThread(t);
                  setMostrarKanbanNaoAtribuidos(false);
                }}
                onClose={() => setMostrarKanbanNaoAtribuidos(false)}
              />
            ) : mostrarKanbanRequerAtencao ? (
              <ContatosRequerendoAtencaoKanban
                usuario={usuario}
                onSelecionarContato={(t) => {
                  handleSelecionarThread(t);
                  setMostrarKanbanRequerAtencao(false);
                }}
                onClose={() => setMostrarKanbanRequerAtencao(false)}
              />
            ) : criandoNovoContato ? (
              <ContactInfoPanel contact={null} novoContatoTelefone={novoContatoTelefone}
                defaultValues={contactInitialData}
                onClose={() => { setCriandoNovoContato(false); setNovoContatoTelefone(""); setShowContactInfo(false); setContactInitialData(null); setMobileView('lista'); }}
                onUpdate={handleCriarNovoContato} atendentes={atendentes} />
            ) : threadAtiva || (modoSelecaoMultipla && (contatosSelecionados.length > 0 || broadcastInterno)) ? (
              <ChatWindow thread={threadAtiva} mensagens={mensagens} usuario={usuario}
                contatoPreCarregado={contatoPreCarregado} onEnviarMensagem={async () => {}}
                onSendMessageOptimistic={handleEnviarMensagemOtimista}
                onSendInternalMessageOptimistic={handleEnviarMensagemInternaOtimista}
                onShowContactInfo={() => setShowContactInfo(true)}
                onAtualizarMensagens={handleAtualizarMensagens} integracoes={integracoes}
                selectedCategoria={selectedCategoria} modoSelecaoMultipla={modoSelecaoMultipla}
                contatosSelecionados={contatosSelecionados} broadcastInterno={broadcastInterno}
                onCancelarSelecao={() => { setModoSelecaoMultipla(false); setContatosSelecionados([]); setBroadcastInterno(null); setMobileView('lista'); }}
                atendentes={atendentes} filterScope={filterScope} selectedIntegrationId={selectedIntegrationId}
                selectedAttendantId={selectedAttendantId} contatoAtivo={contatoAtivo} />
            ) : <EmptyState />}
          </div>
        </div>
      )}
    </div>
  );
}