import { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook para paginação lazy de mensagens (WhatsApp style)
 * 
 * Busca mensagens de TODAS as threads do contato — incluindo threads antigas
 * que nunca foram mergeadas formalmente. Isso garante que o histórico completo
 * seja exibido ao fazer scroll para cima.
 *
 * @param {string} threadId - ID da thread ativa
 * @param {boolean} isThreadInterna - Se é thread interna (team_internal/sector_group)
 * @param {Array} allThreads - Threads já em memória (usado como cache inicial, fallback para DB)
 */
export const useMensagensPaginadas = (threadId, isThreadInterna = false, allThreads = []) => {
  const [messages, setMessages] = useState([]);
  const [oldestLoadedAt, setOldestLoadedAt] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const lastThreadId = useRef(null);

  // Cache dos IDs adicionais para reutilizar no fetchOlder sem repetir queries
  const cachedIdsAdicionais = useRef([]);

  const reset = useCallback(() => {
    setMessages([]);
    setOldestLoadedAt(null);
    setHasMore(true);
    setIsLoadingMore(false);
    setIsInitialLoading(false);
    cachedIdsAdicionais.current = [];
  }, []);

  /**
   * Resolve TODOS os IDs de threads relacionadas ao contato.
   * 
   * Estratégia:
   * 1. Tenta usar allThreads em memória (rápido, zero queries)
   * 2. Se allThreads está vazio ou incompleto, busca NO BANCO todas as threads
   *    do mesmo contact_id — garante que threads antigas sejam incluídas.
   */
  const resolverIdsAdicionais = useCallback(async (threadId) => {
    // Encontrar thread atual
    const threadAtual = allThreads.find(t => t.id === threadId);
    const contactId = threadAtual?.contact_id;

    // Se é thread interna, não há IDs adicionais
    if (!contactId) return [];

    // Tentar resolver em memória primeiro
    const idsEmMemoria = [];
    if (allThreads?.length > 0) {
      allThreads.forEach(t => {
        if (t.id === threadId) return;
        // Threads mergeadas nesta
        if (t.merged_into === threadId && t.status === 'merged') {
          idsEmMemoria.push(t.id);
          return;
        }
        // Qualquer outra thread do mesmo contato (qualquer status)
        if (t.contact_id === contactId) {
          idsEmMemoria.push(t.id);
        }
      });
    }

    // Sempre buscar no banco para garantir threads antigas que podem não estar em memória
    try {
      const todasThreadsContato = await base44.entities.MessageThread.filter(
        { contact_id: contactId },
        '-created_date',
        50
      );

      const idsDB = todasThreadsContato
        .filter(t => t.id !== threadId)
        .map(t => t.id);

      // Unir IDs em memória + IDs do banco (dedup)
      const todos = [...new Set([...idsEmMemoria, ...idsDB])];
      console.log(`[PAGINACAO] 🔍 Threads adicionais para contato ${contactId.substring(0, 8)}: ${todos.length} (${idsEmMemoria.length} mem + ${idsDB.length} db)`);
      return todos;
    } catch (err) {
      console.warn('[PAGINACAO] ⚠️ Falha ao buscar threads no banco, usando memória:', err.message);
      return [...new Set(idsEmMemoria)];
    }
  }, [allThreads]);

  // Carga inicial - últimas 20 mensagens
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
      console.log('[PAGINACAO] 🔄 Carregando inicial:', threadId.substring(0, 8));

      // Thread interna: busca simples
      if (isThreadInterna) {
        const msgs = await base44.entities.Message.filter(
          { thread_id: threadId },
          '-sent_at',
          20
        );
        const reversed = msgs.reverse();
        setMessages(reversed);
        setOldestLoadedAt(reversed[0]?.sent_at || null);
        setHasMore(msgs.length === 20);
        cachedIdsAdicionais.current = [];
        console.log('[PAGINACAO] ✅ Inicial interna:', reversed.length);
        return;
      }

      // Thread externa: Fase 1 - mostrar mensagens da thread ativa imediatamente
      const msgsPrimarias = await base44.entities.Message.filter(
        { thread_id: threadId },
        '-sent_at',
        20
      );

      const reversedPrimarias = msgsPrimarias.reverse();
      setMessages(reversedPrimarias);
      setOldestLoadedAt(reversedPrimarias[0]?.sent_at || null);
      setHasMore(true); // Sempre true inicialmente pois pode ter histórico em outras threads
      setIsInitialLoading(false); // Libera spinner já aqui

      // Fase 2: buscar todas as threads do contato (inclui antigas do DB)
      const idsAdicionais = await resolverIdsAdicionais(threadId);
      cachedIdsAdicionais.current = idsAdicionais;

      if (idsAdicionais.length > 0) {
        console.log('[PAGINACAO] 🔄 Enriquecendo com', idsAdicionais.length, 'threads extras...');

        try {
          const msgsAdicionais = await base44.entities.Message.filter(
            { thread_id: { $in: idsAdicionais } },
            '-sent_at',
            20
          );

          if (msgsAdicionais.length > 0) {
            setMessages(prev => {
              const mapa = new Map(prev.map(m => [m.id, m]));
              msgsAdicionais.forEach(m => mapa.set(m.id, m));
              const merged = Array.from(mapa.values());
              merged.sort((a, b) => new Date(a.sent_at || 0) - new Date(b.sent_at || 0));
              const final = merged.slice(-20);
              setOldestLoadedAt(final[0]?.sent_at || null);
              return final;
            });
          }
        } catch (err) {
          console.warn('[PAGINACAO] ⚠️ Enrich background falhou:', err.message);
        }
      }

      // Verificar se há mais mensagens (considerando todas as threads)
      const totalThreadIds = [threadId, ...idsAdicionais];
      const totalMsgs = await base44.entities.Message.filter(
        { thread_id: { $in: totalThreadIds } },
        '-sent_at',
        1
      );
      setHasMore(totalMsgs.length > 0); // Haverá mais ao paginar

      console.log('[PAGINACAO] ✅ Inicial externa concluída. Threads consideradas:', totalThreadIds.length);

    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao carregar inicial:', error);
      setMessages([]);
      setHasMore(false);
    } finally {
      setIsInitialLoading(false);
    }
  }, [threadId, isThreadInterna, reset, resolverIdsAdicionais]);

  // Buscar mensagens mais antigas (scroll-up)
  const fetchOlder = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestLoadedAt || !threadId) {
      return;
    }

    setIsLoadingMore(true);

    try {
      console.log('[PAGINACAO] ⬆️ Buscando mensagens antigas antes de', oldestLoadedAt);

      if (isThreadInterna) {
        const older = await base44.entities.Message.filter(
          {
            thread_id: threadId,
            sent_at: { $lt: oldestLoadedAt }
          },
          '-sent_at',
          20
        );

        if (older.length === 0) {
          setHasMore(false);
          return;
        }

        const reversed = older.reverse();
        setMessages(prev => [...reversed, ...prev]);
        setOldestLoadedAt(reversed[0]?.sent_at);
        console.log('[PAGINACAO] ✅ +', reversed.length, 'antigas (interna)');

      } else {
        // Reutilizar IDs em cache (já incluem todas as threads do contato do DB)
        // Se cache vazio (ex: após reload), buscar novamente
        let idsAdicionais = cachedIdsAdicionais.current;
        if (idsAdicionais.length === 0) {
          idsAdicionais = await resolverIdsAdicionais(threadId);
          cachedIdsAdicionais.current = idsAdicionais;
        }

        const threadIdsParaBuscar = [threadId, ...idsAdicionais];

        const older = await base44.entities.Message.filter(
          {
            thread_id: { $in: threadIdsParaBuscar },
            sent_at: { $lt: oldestLoadedAt }
          },
          '-sent_at',
          20
        );

        if (older.length === 0) {
          setHasMore(false);
          console.log('[PAGINACAO] 📭 Sem mais mensagens antigas em', threadIdsParaBuscar.length, 'threads');
          return;
        }

        const reversed = older.reverse();
        setMessages(prev => [...reversed, ...prev]);
        setOldestLoadedAt(reversed[0]?.sent_at);
        console.log('[PAGINACAO] ✅ +', reversed.length, 'antigas em', threadIdsParaBuscar.length, 'threads');
      }
    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao buscar antigas:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [threadId, isThreadInterna, oldestLoadedAt, hasMore, isLoadingMore, resolverIdsAdicionais]);

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