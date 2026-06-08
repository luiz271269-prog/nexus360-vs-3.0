import { useEffect, useRef } from 'react';

/**
 * useMobileBackButton
 * Sincroniza o botão "voltar" físico do Android com as sub-telas mobile da Central.
 *
 * Como funciona:
 * - Quando há QUALQUER sub-tela aberta (chat, kanban, novo contato, painel de contato),
 *   empurra UMA entrada "fantasma" no histórico (history.pushState).
 * - Ao detectar o "voltar" físico (popstate), chama onBack() — que fecha a sub-tela
 *   atual na ordem correta — em vez de deixar o navegador trocar de rota / sair do app.
 * - Na tela "lista" (raiz da Central), não há entrada fantasma: o "voltar" segue normal
 *   (volta de rota / sai do app), como o usuário espera.
 *
 * Não toca em nenhum estado/handler de negócio — apenas observa flags e dispara onBack.
 */
export function useMobileBackButton({
  mobileView,
  mostrarKanbanRequerAtencao,
  mostrarKanbanNaoAtribuidos,
  criandoNovoContato,
  showContactInfo,
  onBack
}) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // Há alguma sub-tela aberta que o "voltar" deve fechar?
  const temSubTelaAberta =
    mostrarKanbanRequerAtencao ||
    mostrarKanbanNaoAtribuidos ||
    criandoNovoContato ||
    showContactInfo ||
    mobileView === 'chat';

  const guardAtivoRef = useRef(false);

  useEffect(() => {
    // Só no mobile (touch / largura pequena)
    if (typeof window === 'undefined') return;
    const ehMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!ehMobile) return;

    if (temSubTelaAberta && !guardAtivoRef.current) {
      // Abriu sub-tela → empurra entrada fantasma no histórico
      window.history.pushState({ nexusBackGuard: true }, '');
      guardAtivoRef.current = true;
    }

    const handlePopState = () => {
      if (guardAtivoRef.current) {
        guardAtivoRef.current = false;
        onBackRef.current?.();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [temSubTelaAberta]);
}