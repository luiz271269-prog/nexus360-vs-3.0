import React from 'react';

/**
 * SKILL — Auto-abrir tela de chat no mobile quando há seleção múltipla
 *
 * Problema: ao marcar contatos na lista mobile para envio em massa, o usuário
 * fica preso em `mobileView='lista'` e não vê o painel de composição.
 *
 * Solução: assim que a seleção tem ≥1 item OU há broadcast interno definido,
 * alterna para `mobileView='chat'` automaticamente.
 *
 * Uso no Comunicacao.jsx (1 linha):
 *   useAutoAbrirChatMobileNaSelecao({
 *     modoSelecaoMultipla, contatosSelecionados, broadcastInterno, setMobileView
 *   });
 */
export function useAutoAbrirChatMobileNaSelecao({
  modoSelecaoMultipla,
  contatosSelecionados,
  broadcastInterno,
  setMobileView
}) {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Só age no breakpoint mobile (md = 768px no Tailwind)
    if (window.innerWidth >= 768) return;

    const temSelecao = modoSelecaoMultipla && (
      (contatosSelecionados?.length || 0) > 0 || !!broadcastInterno
    );

    if (temSelecao) {
      setMobileView('chat');
    }
  }, [modoSelecaoMultipla, contatosSelecionados?.length, broadcastInterno, setMobileView]);
}