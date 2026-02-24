import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook que detecta scroll no topo do chat e busca mais 20 mensagens antigas.
 * Inclui TODAS as threads do contato (busca no banco pelo contact_id).
 *
 * ✅ VERSÃO FINAL — todos os bugs corrigidos:
 * 1. Estado interno do cursor (oldestLoadedTimestamp) — não depende do pai
 * 2. initTimestamp exportado — pai chama ao carregar mensagens iniciais
 * 3. Cache de threads pré-carregado no useEffect (não na hora do scroll)
 * 4. AbortController capturado ANTES dos awaits
 * 5. Verificação correta: thread?.id !== currentThreadId
 * 6. Ordenação explícita [...spread].sort() — sem .reverse() que muta o array
 * 7. Cursor aponta para sortedOlder[0] — mensagem MAIS ANTIGA do lote
 * 8. Proteção de cursor undefined → bloqueia paginação
 * 9. isHistoryStart exposto para o pai renderizar "Início da conversa"
 * 10. Limite de 30 IDs no $in
 */
export default function useScrollPaginacao({
  thread,
  queryClient,
  allThreads = []
}) {
  const [loadingOlder, setLoadingOlder]               = useState(false);
  const [hasMoreMessages, setHasMoreMessages]         = useState(true);
  const [oldestLoadedTimestamp, setOldestLoadedTimestamp] = useState(null);
  const [isHistoryStart, setIsHistoryStart]           = useState(false);

  const chatContainerRef       = useRef(null);
  const isLoadingOlderRef      = useRef(false);
  const abortControllerRef     = useRef(null);
  const cachedThreadIdsRef     = useRef({ contactId: null, threadIds: [] });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Auto-reset ao trocar thread + pré-carregamento do cache de threads
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Cancela qualquer busca em andamento
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isLoadingOlderRef.current  = false;

    // Reset de estado
    setLoadingOlder(false);
    setHasMoreMessages(true);
    setOldestLoadedTimestamp(null);
    setIsHistoryStart(false);

    console.log('[SCROLL] 🔄 Thread trocada:', thread?.id?.substring(0, 8), '— estado resetado');

    const contactId  = thread?.contact_id;
    const isInternal = thread?.thread_type === 'team_internal'
                    || thread?.thread_type === 'sector_group';

    if (!contactId || isInternal || !thread?.id) {
      cachedThreadIdsRef.current = { contactId: null, threadIds: [] };
      return;
    }

    // Se o cache já é válido para este contato, não refaz a query
    if (cachedThreadIdsRef.current.contactId === contactId) {
      console.log('[SCROLL] 💾 Cache já válido para contact:', contactId?.substring(0, 8));
      return;
    }

    const currentThreadId = thread.id;

    const preloadThreadIds = async () => {
      try {
        const todasThreads = await base44.entities.MessageThread.filter(
          { contact_id: contactId },
          '-created_date',
          50
        );

        const ids = todasThreads
          .filter(t => t.id !== currentThreadId)
          .map(t => t.id);

        cachedThreadIdsRef.current = {
          contactId,
          threadIds: [currentThreadId, ...new Set(ids)]
        };
        console.log('[SCROLL] 📦 Cache pré-carregado:', cachedThreadIdsRef.current.threadIds.length, 'threads');
      } catch {
        // Fallback: usar allThreads da memória
        const ids = allThreads
          .filter(t => t.id !== currentThreadId && t.contact_id === contactId)
          .map(t => t.id);

        cachedThreadIdsRef.current = {
          contactId,
          threadIds: [currentThreadId, ...new Set(ids)]
        };
        console.log('[SCROLL] ⚠️ Cache fallback (memória):', cachedThreadIdsRef.current.threadIds.length, 'threads');
      }
    };

    preloadThreadIds();
  }, [thread?.id, thread?.contact_id, thread?.thread_type, allThreads]);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. initTimestamp — chamado pelo pai com as msgs iniciais
  //    Inicializa o cursor para que o scroll saiba de onde paginar
  // ─────────────────────────────────────────────────────────────────────────
  const initTimestamp = useCallback((msgs) => {
    if (msgs?.length > 0) {
      // msgs[0] = mais antiga (array já ordenado ASC pelo pai)
      const cursor = msgs[0]?.sent_at || msgs[0]?.created_date;
      if (cursor) {
        console.log('[SCROLL-INIT] ✅ Cursor=', cursor, '|', msgs.length, 'msgs');
        setOldestLoadedTimestamp(cursor);
        setHasMoreMessages(true);
        setIsHistoryStart(false);
        return;
      }
    }
    // Sem mensagens ou sem timestamp: cursor futuro para scroll funcionar
    const futureTimestamp = new Date().toISOString();
    console.log('[SCROLL-INIT] ⚠️ Sem cursor válido. Usando timestamp futuro:', futureTimestamp);
    setOldestLoadedTimestamp(futureTimestamp);
    setHasMoreMessages(true);
    setIsHistoryStart(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Listener de scroll
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = async () => {
      if (isLoadingOlderRef.current) return;
      if (!hasMoreMessages)          return;
      if (!oldestLoadedTimestamp)    return;
      if (container.scrollTop > 150) return;

      console.log('[SCROLL-UP] ⬆️ ACIONANDO | scrollTop=', container.scrollTop, '| cursor=', oldestLoadedTimestamp);

      // ✅ Capturar currentThreadId e controller ANTES de qualquer await
      const currentThreadId = thread?.id;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      isLoadingOlderRef.current = true;
      setLoadingOlder(true);

      try {
        const scrollHeightBefore = container.scrollHeight;
        const scrollTopBefore    = container.scrollTop;

        const isInternal = thread?.thread_type === 'team_internal'
                        || thread?.thread_type === 'sector_group';
        let olderMessages = [];

        if (isInternal) {
          olderMessages = await base44.entities.Message.filter(
            { thread_id: thread.id, sent_at: { $lt: oldestLoadedTimestamp } },
            '-sent_at',
            20
          );
        } else {
          // Usar cache pré-carregado (limitado a 30 IDs)
          const threadIds = cachedThreadIdsRef.current.threadIds.length > 0
            ? cachedThreadIdsRef.current.threadIds.slice(0, 30)
            : [thread.id];

          console.log('[SCROLL-UP] 🔍 Buscando em', threadIds.length, 'threads');

          olderMessages = await base44.entities.Message.filter(
            { thread_id: { $in: threadIds }, sent_at: { $lt: oldestLoadedTimestamp } },
            '-sent_at',
            20
          );
        }

        // ✅ Descartar resultado se thread trocou durante o await
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

        // ✅ Ordenação explícita sem mutar o array (sem .reverse())
        const sortedOlder = [...olderMessages].sort((a, b) => {
          const aTime = (a.sent_at || a.created_date || '').toString();
          const bTime = (b.sent_at || b.created_date || '').toString();
          return aTime.localeCompare(bTime);
        });
        // sortedOlder[0] = MAIS ANTIGA do lote (correto para o cursor)

        // Deduplicação + merge no cache do React Query
        queryClient.setQueryData(['mensagens', thread.id], (antigas = []) => {
          const byId = new Map();
          [...sortedOlder, ...antigas].forEach(m => {
            if (m?.id) byId.set(m.id, m);
          });
          return Array.from(byId.values()).sort((a, b) => {
            const aTime = (a.sent_at || a.created_date || '').toString();
            const bTime = (b.sent_at || b.created_date || '').toString();
            return aTime.localeCompare(bTime);
          });
        });

        // ✅ Cursor aponta para sortedOlder[0] — MAIS ANTIGA, com proteção
        const newCursor = sortedOlder[0]?.sent_at || sortedOlder[0]?.created_date;
        if (!newCursor) {
          console.warn('[SCROLL-UP] ⚠️ Mensagem sem timestamp — bloqueando paginação');
          setHasMoreMessages(false);
          setIsHistoryStart(true);
        } else {
          setOldestLoadedTimestamp(newCursor);
          console.log('[SCROLL-UP] 🔄 Novo cursor:', newCursor);
        }

        // Manter posição visual após inserir mensagens no topo
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
        // Só libera o lock se este controller ainda é o atual
        if (abortControllerRef.current === controller) {
          isLoadingOlderRef.current = false;
          setLoadingOlder(false);
          abortControllerRef.current = null;
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [thread?.id, thread?.thread_type, hasMoreMessages, oldestLoadedTimestamp, queryClient]);

  return {
    chatContainerRef,
    loadingOlder,
    hasMoreMessages,
    isHistoryStart,
    oldestLoadedTimestamp,
    initTimestamp   // ← pai chama com as msgs iniciais para setar o cursor
  };
}