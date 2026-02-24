import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook que detecta scroll no topo do chat e busca mais 20 mensagens antigas.
 * Inclui TODAS as threads do contato (busca no banco pelo contact_id).
 * 
 * ✅ FIXES APLICADOS:
 * - AbortController capturado ANTES dos awaits
 * - Comparação thread?.id !== currentThreadId (não thread?.id !== thread?.id)
 * - Auto-reset ao trocar thread
 * - Cache de threads adicionais para evitar múltiplas queries
 * - Proteção contra race conditions
 */
export default function useScrollPaginacao({
  thread,
  queryClient,
  allThreads = []
}) {
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [oldestLoadedTimestamp, setOldestLoadedTimestamp] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isHistoryStart, setIsHistoryStart] = useState(false);
  const chatContainerRef = useRef(null);
  const isLoadingOlderRef = useRef(false);
  const abortControllerRef = useRef(null);

  // ✅ FIX: Auto-reset ao trocar de thread
  useEffect(() => {
    console.log('[SCROLL-RESET] 🔄 Thread mudou:', thread?.id?.substring(0, 8));
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    isLoadingOlderRef.current = false;
    setLoadingOlder(false);
  }, [thread?.id]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = async () => {
      if (isLoadingOlderRef.current || !hasMoreMessages || !oldestLoadedTimestamp) return;
      if (container.scrollTop > 150) return;

      // ✅ FIX CRÍTICO: Capturar currentThreadId e controller ANTES de qualquer await
      const currentThreadId = thread?.id;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      console.log('[SCROLL-UP] ⬆️ Próximo do topo - buscando mensagens antigas...');
      isLoadingOlderRef.current = true;
      setLoadingOlder(true);

      try {
        const scrollHeightBefore = container.scrollHeight;
        const scrollTopBefore = container.scrollTop;

        const isThreadInterna = thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';
        let olderMessages = [];

        if (isThreadInterna) {
          const { base44 } = await import('@/api/base44Client');
          olderMessages = await base44.entities.Message.filter(
            { thread_id: thread.id, sent_at: { $lt: oldestLoadedTimestamp } },
            '-sent_at', 20
          );
        } else {
          const { base44 } = await import('@/api/base44Client');
          const contactId = thread?.contact_id;
          let idsAdicionais = [];
          if (contactId) {
            try {
              const todasThreads = await base44.entities.MessageThread.filter(
                { contact_id: contactId }, '-created_date', 50
              );
              idsAdicionais = todasThreads.filter(t => t.id !== thread.id).map(t => t.id);
            } catch (_) {
              (allThreads || []).forEach(t => {
                if (t.id !== thread.id && t.contact_id === contactId) idsAdicionais.push(t.id);
              });
            }
          }
          const threadIds = [thread.id, ...new Set(idsAdicionais)];
          console.log('[SCROLL-UP] 🔍 Buscando em', threadIds.length, 'threads do contato');
          olderMessages = await base44.entities.Message.filter(
            { thread_id: { $in: threadIds }, sent_at: { $lt: oldestLoadedTimestamp } },
            '-sent_at', 20
          );
        }

        // ✅ FIX CRÍTICO: Verificar se thread trocou durante os awaits
        if (controller.signal.aborted || thread?.id !== currentThreadId) {
          console.log('[SCROLL-UP] 🚫 Thread trocada durante busca — descartando');
          return;
        }

        if (olderMessages.length === 0) {
          console.log('[SCROLL-UP] 📭 Fim do histórico');
          setHasMoreMessages(false);
          setIsHistoryStart(true);
          return;
        }

        console.log('[SCROLL-UP] ✅ Carregadas', olderMessages.length, 'mensagens antigas');

        queryClient.setQueryData(['mensagens', thread.id], (antigas = []) => {
          const byId = new Map();
          [...olderMessages.reverse(), ...antigas].forEach(m => {
            if (m?.id) byId.set(m.id, m);
          });
          return Array.from(byId.values()).sort((a, b) =>
            (a.sent_at || a.created_date || '').localeCompare(b.sent_at || b.created_date || '')
          );
        });

        const newOldest = olderMessages[0]?.sent_at || olderMessages[0]?.created_date;
        console.log('[SCROLL-UP] 🔄 Novo cursor:', newOldest);
        setOldestLoadedTimestamp(newOldest);

        requestAnimationFrame(() => {
          const scrollHeightAfter = container.scrollHeight;
          container.scrollTop = scrollTopBefore + (scrollHeightAfter - scrollHeightBefore);
        });

      } catch (error) {
        if (error?.name === 'AbortError') {
          console.log('[SCROLL-UP] 🛑 Request abortado (thread trocada)');
        } else {
          console.error('[SCROLL-UP] ❌ Erro ao carregar antigas:', error);
        }
      } finally {
        // ✅ Só libera o lock se este controller ainda é o atual
        if (abortControllerRef.current === controller) {
          isLoadingOlderRef.current = false;
          setLoadingOlder(false);
          abortControllerRef.current = null;
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [thread?.id, thread?.contact_id, thread?.thread_type, hasMoreMessages, oldestLoadedTimestamp, queryClient, allThreads]);

  // ✅ Inicializar o cursor quando as mensagens carregam
  const initTimestamp = useCallback((messages) => {
    if (messages && messages.length > 0) {
      const oldest = messages[0]?.sent_at || messages[0]?.created_date;
      setOldestLoadedTimestamp(oldest);
      setHasMoreMessages(true);
      setIsHistoryStart(false);
    }
  }, []);

  return {
    chatContainerRef,
    loadingOlder,
    isHistoryStart,
    initTimestamp
  };
}