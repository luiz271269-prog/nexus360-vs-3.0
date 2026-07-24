import { useState, useCallback, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getInternalMessages } from '@/functions/getInternalMessages';

/**
 * Hook para paginação lazy de mensagens (WhatsApp style)
 * 
 * Busca APENAS mensagens da thread atual.
 * Cada thread é uma conversa independente — sem mesclar com outras threads do contato.
 */
// ⚡ Cache em memória por thread (sessão): reabrir uma conversa mostra as mensagens
// instantaneamente enquanto a busca atualiza em background. Máx 30 threads (LRU simples).
const _msgCache = new Map();
const cacheGet = (threadId) => _msgCache.get(threadId) || null;
const cacheSet = (threadId, msgs) => {
  if (_msgCache.has(threadId)) _msgCache.delete(threadId);
  _msgCache.set(threadId, msgs);
  if (_msgCache.size > 30) _msgCache.delete(_msgCache.keys().next().value);
};

const INITIAL_LIMIT = 10; // Carga inicial enxuta (era 20)
const PAGE_LIMIT = 20;    // Scroll-up carrega blocos maiores

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

  // Busca mensagens via backend (fallback para threads internas — bypass RLS)
  const fetchMessagesBackend = useCallback(async (threadId, before_sent_at = null, limit = PAGE_LIMIT) => {
    const res = await getInternalMessages({ thread_id: threadId, before_sent_at, limit });
    if (!res?.data?.success) throw new Error(res?.data?.error || 'backend_error');
    return res.data.messages || [];
  }, []);

  // ⚡ Threads internas: leitura DIRETA do banco (sem desvio pelo servidor).
  // Se vier vazio (possível bloqueio de visibilidade), cai no backend como fallback.
  const fetchMessagesInterna = useCallback(async (threadId, before_sent_at = null, limit = PAGE_LIMIT) => {
    const filtro = { thread_id: threadId };
    if (before_sent_at) filtro.created_date = { $lt: before_sent_at };
    try {
      const direto = await base44.entities.Message.filter(filtro, '-created_date', limit);
      if (direto.length > 0) return direto;
    } catch (e) {
      console.warn('[PAGINACAO] Leitura direta falhou, usando backend:', e.message);
    }
    return fetchMessagesBackend(threadId, before_sent_at, limit);
  }, [fetchMessagesBackend]);

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

    // ⚡ CACHE HIT: pinta instantaneamente e revalida em background (sem spinner)
    const cached = cacheGet(threadId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setOldestLoadedAt(cached[0]?.created_date || cached[0]?.sent_at || null);
      setHasMore(cached.length >= INITIAL_LIMIT);
    } else {
      setIsInitialLoading(true);
    }

    try {
      console.log('[PAGINACAO] 🔄 Carregando inicial da thread:', threadId.substring(0, 8));

      const msgs = isThreadInterna
        ? await fetchMessagesInterna(threadId, null, INITIAL_LIMIT)
        : await base44.entities.Message.filter(
            { thread_id: threadId },
            '-created_date',
            INITIAL_LIMIT
          );

      const reversed = msgs.reverse();
      setMessages(reversed);
      setOldestLoadedAt(reversed[0]?.created_date || reversed[0]?.sent_at || null);
      setHasMore(msgs.length === INITIAL_LIMIT); // Se trouxe o limite, pode ter mais
      cacheSet(threadId, reversed);

      console.log('[PAGINACAO] ✅ Inicial carregada:', reversed.length, 'msgs');

    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao carregar inicial:', error);
      // ⚡ Se falhou (ex: 429) mas temos cache, mantém o cache na tela
      if (!cached || cached.length === 0) {
        setMessages([]);
        setHasMore(false);
      }
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
        ? await fetchMessagesInterna(threadId, oldestLoadedAt, PAGE_LIMIT)
        : await base44.entities.Message.filter(
            {
              thread_id: threadId,
              created_date: { $lt: oldestLoadedAt }
            },
            '-created_date',
            PAGE_LIMIT
          );

      if (older.length === 0) {
        setHasMore(false);
        console.log('[PAGINACAO] 📭 Sem mais mensagens antigas');
        return;
      }

      const reversed = older.reverse();
      setMessages(prev => {
        const next = [...reversed, ...prev];
        cacheSet(threadId, next);
        return next;
      });
      setOldestLoadedAt(reversed[0]?.created_date || reversed[0]?.sent_at);
      setHasMore(older.length === PAGE_LIMIT);

      console.log('[PAGINACAO] ✅ +', reversed.length, 'mensagens antigas carregadas');

    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao buscar antigas:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [threadId, oldestLoadedAt, hasMore, isLoadingMore]);

  // 🎯 IR PARA MENSAGEM ORIGINAL (citação/reply, igual WhatsApp):
  // O MessageBubble dispara 'nexus:carregar-ate-mensagem' com a mensagem alvo.
  // Carregamos o trecho do histórico a partir dela e mesclamos na lista renderizada
  // (esta lista local É a fonte da tela — não o cache do react-query).
  useEffect(() => {
    const handler = async (e) => {
      const { threadId: alvoThreadId, mensagem } = e.detail || {};
      if (!alvoThreadId || alvoThreadId !== threadId || !mensagem?.id) return;
      try {
        // ⚠️ Filtro em sent_at: $gte/$lt NÃO funcionam em created_date (campo built-in)
        const marco = mensagem.sent_at || mensagem.created_date;
        const trecho = mensagem.sent_at
          ? await base44.entities.Message.filter(
              { thread_id: threadId, sent_at: { $gte: mensagem.sent_at } },
              'sent_at',
              400
            ).catch(() => [])
          : [];
        const lote = [mensagem, ...trecho];
        setMessages(prev => {
          const byId = new Map();
          [...lote, ...prev].forEach(m => { if (m?.id) byId.set(m.id, m); });
          const next = Array.from(byId.values()).sort((a, b) =>
            (a.created_date || a.sent_at || '').localeCompare(b.created_date || b.sent_at || ''));
          cacheSet(threadId, next);
          return next;
        });
        setOldestLoadedAt(prev => (!prev || marco < prev) ? marco : prev);
      } catch (err) {
        console.warn('[PAGINACAO] Falha ao carregar até a mensagem original:', err?.message);
      }
    };
    window.addEventListener('nexus:carregar-ate-mensagem', handler);
    return () => window.removeEventListener('nexus:carregar-ate-mensagem', handler);
  }, [threadId]);

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