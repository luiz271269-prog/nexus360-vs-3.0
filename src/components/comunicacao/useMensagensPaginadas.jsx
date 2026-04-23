import { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getInternalMessages } from '@/functions/getInternalMessages';

/**
 * Hook para paginação lazy de mensagens (WhatsApp style)
 * 
 * Busca APENAS mensagens da thread atual.
 * Cada thread é uma conversa independente — sem mesclar com outras threads do contato.
 */
export const useMensagensPaginadas = (threadId, isThreadInterna = false) => {
  const [messages, setMessages] = useState([]);
  const [oldestLoadedAt, setOldestLoadedAt] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const lastThreadId = useRef(null);

  const reset = useCallback(() => {
    setMessages([]);
    setOldestLoadedAt(null);
    setHasMore(true);
    setIsLoadingMore(false);
    setIsInitialLoading(false);
  }, []);

  // Busca mensagens via backend (para threads internas — bypass RLS)
  const fetchMessagesBackend = useCallback(async (threadId, before_sent_at = null) => {
    const res = await getInternalMessages({ thread_id: threadId, before_sent_at, limit: 20 });
    if (!res?.data?.success) throw new Error(res?.data?.error || 'backend_error');
    return res.data.messages || [];
  }, []);

  // Carga inicial - últimas 20 mensagens da thread atual
  const loadInitial = useCallback(async () => {
    if (!threadId) {
      reset();
      return;
    }

    if (lastThreadId.current !== threadId) {
      reset();
      lastThreadId.current = threadId;
    }

    setIsInitialLoading(true);

    try {
      console.log('[PAGINACAO] 🔄 Carregando inicial da thread:', threadId.substring(0, 8));

      const msgs = isThreadInterna
        ? await fetchMessagesBackend(threadId)
        : await base44.entities.Message.filter(
            { thread_id: threadId },
            '-created_date',
            20
          );

      const reversed = msgs.reverse();
      setMessages(reversed);
      setOldestLoadedAt(reversed[0]?.created_date || reversed[0]?.sent_at || null);
      setHasMore(msgs.length === 20); // Se trouxe 20, pode ter mais

      console.log('[PAGINACAO] ✅ Inicial carregada:', reversed.length, 'msgs');

    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao carregar inicial:', error);
      setMessages([]);
      setHasMore(false);
    } finally {
      setIsInitialLoading(false);
    }
  }, [threadId, reset]);

  // Buscar mensagens mais antigas (scroll-up) — APENAS desta thread
  const fetchOlder = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestLoadedAt || !threadId) {
      return;
    }

    setIsLoadingMore(true);

    try {
      console.log('[PAGINACAO] ⬆️ Buscando mensagens antigas antes de', oldestLoadedAt);

      const older = isThreadInterna
        ? await fetchMessagesBackend(threadId, oldestLoadedAt)
        : await base44.entities.Message.filter(
            {
              thread_id: threadId,
              created_date: { $lt: oldestLoadedAt }
            },
            '-created_date',
            20
          );

      if (older.length === 0) {
        setHasMore(false);
        console.log('[PAGINACAO] 📭 Sem mais mensagens antigas');
        return;
      }

      const reversed = older.reverse();
      setMessages(prev => [...reversed, ...prev]);
      setOldestLoadedAt(reversed[0]?.created_date || reversed[0]?.sent_at);
      setHasMore(older.length === 20);

      console.log('[PAGINACAO] ✅ +', reversed.length, 'mensagens antigas carregadas');

    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao buscar antigas:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [threadId, oldestLoadedAt, hasMore, isLoadingMore]);

  return {
    messages,
    hasMore,
    isLoadingMore,
    isInitialLoading,
    fetchOlder,
    loadInitial,
    reset
  };
};