import { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook para paginação lazy de mensagens (WhatsApp style)
 * 
 * OTIMIZAÇÕES APLICADAS:
 * 1. Abertura rápida: busca mensagens da thread ativa imediatamente,
 *    merge/histórico chegam em background e atualizam via setMessages.
 * 2. Reutiliza threads já carregadas em memória (prop allThreads) para
 *    descobrir threadsMerged e threadsContato — elimina 2 queries ao DB.
 * 3. Memoiza idsAdicionais para scroll-up sem repetir queries de threads.
 *
 * @param {string} threadId - ID da thread ativa
 * @param {boolean} isThreadInterna - Se é thread interna (team_internal/sector_group)
 * @param {Array} allThreads - Todas as threads já carregadas em memória (de Comunicacao.jsx)
 */
export const useMensagensPaginadas = (threadId, isThreadInterna = false, allThreads = []) => {
  const [messages, setMessages] = useState([]);
  const [oldestLoadedAt, setOldestLoadedAt] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const lastThreadId = useRef(null);

  // ✅ OT #3: Memorizar idsAdicionais para não recalcular no fetchOlder
  const cachedIdsAdicionais = useRef([]);

  // Reset quando troca thread
  const reset = useCallback(() => {
    setMessages([]);
    setOldestLoadedAt(null);
    setHasMore(true);
    setIsLoadingMore(false);
    setIsInitialLoading(false);
    cachedIdsAdicionais.current = [];
  }, []);

  /**
   * ✅ OT #2: Derivar IDs de threads relacionadas DO ARRAY EM MEMÓRIA
   * Evita 2 queries ao banco (threadsMerged + threadsContato)
   */
  const resolverIdsAdicionaisEmMemoria = useCallback((threadId) => {
    if (!allThreads?.length) return [];

    const threadAtual = allThreads.find(t => t.id === threadId);
    const contactId = threadAtual?.contact_id;

    const idsAdicionais = [];

    allThreads.forEach(t => {
      if (t.id === threadId) return;

      // Threads merged nesta (merged_into === threadId)
      if (t.merged_into === threadId && t.status === 'merged') {
        idsAdicionais.push(t.id);
        return;
      }

      // Outras threads do mesmo contato (aberta/fechada)
      if (contactId && t.contact_id === contactId &&
          (t.status === 'aberta' || t.status === 'fechada')) {
        idsAdicionais.push(t.id);
      }
    });

    return [...new Set(idsAdicionais)]; // dedup
  }, [allThreads]);

  // Carga inicial - últimas 20 mensagens
  const loadInitial = useCallback(async () => {
    if (!threadId) {
      reset();
      return;
    }

    // Se trocou de thread, resetar
    if (lastThreadId.current !== threadId) {
      reset();
      lastThreadId.current = threadId;
    }

    setIsInitialLoading(true);

    try {
      console.log('[PAGINACAO] 🔄 Carregando inicial:', threadId.substring(0, 8));

      // ─── Thread interna: busca simples, sem merge ───────────────────────
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

      // ─── Thread externa: ✅ OT #1 ABERTURA RÁPIDA ────────────────────────
      // Fase 1: buscar mensagens da thread ativa IMEDIATAMENTE (0 overhead)
      const msgsPrimarias = await base44.entities.Message.filter(
        { thread_id: threadId },
        '-sent_at',
        20
      );

      // Mostrar as mensagens primárias já na tela sem esperar merges
      const reversedPrimarias = msgsPrimarias.reverse();
      setMessages(reversedPrimarias);
      setOldestLoadedAt(reversedPrimarias[0]?.sent_at || null);
      setHasMore(msgsPrimarias.length === 20);
      setIsInitialLoading(false); // ← libera spinner já aqui

      // ✅ OT #2: Resolver IDs adicionais em MEMÓRIA (sem queries ao banco)
      const idsAdicionaisMemoria = resolverIdsAdicionaisEmMemoria(threadId);

      // Fase 2: se há threads adicionais, buscar em background e enriquecer
      if (idsAdicionaisMemoria.length > 0) {
        console.log('[PAGINACAO] 🔄 Background enrich:', idsAdicionaisMemoria.length, 'threads extras');

        try {
          const msgsAdicionais = await base44.entities.Message.filter(
            { thread_id: { $in: idsAdicionaisMemoria } },
            '-sent_at',
            20
          );

          if (msgsAdicionais.length > 0) {
            // Mesclar com primárias, dedup por id, ordenar e cortar em 20
            setMessages(prev => {
              const mapa = new Map(prev.map(m => [m.id, m]));
              msgsAdicionais.forEach(m => mapa.set(m.id, m));
              const merged = Array.from(mapa.values());
              merged.sort((a, b) => new Date(a.sent_at || 0) - new Date(b.sent_at || 0));
              const final = merged.slice(-20);
              setOldestLoadedAt(final[0]?.sent_at || null);
              setHasMore(final.length === 20);
              return final;
            });
          }
        } catch (err) {
          console.warn('[PAGINACAO] ⚠️ Enrich background falhou (não crítico):', err.message);
        }
      }

      // ✅ OT #3: Salvar IDs para reutilizar no fetchOlder (sem refazer queries)
      cachedIdsAdicionais.current = idsAdicionaisMemoria;

      console.log('[PAGINACAO] ✅ Inicial externa concluída. IDs extras:', idsAdicionaisMemoria.length);

    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao carregar inicial:', error);
      setMessages([]);
      setHasMore(false);
    } finally {
      setIsInitialLoading(false);
    }
  }, [threadId, isThreadInterna, reset, resolverIdsAdicionaisEmMemoria]);

  // Buscar mensagens mais antigas (scroll-up)
  const fetchOlder = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestLoadedAt || !threadId) {
      return;
    }

    setIsLoadingMore(true);

    try {
      console.log('[PAGINACAO] ⬆️ Buscando mensagens antigas...');

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
        // ✅ OT #3: Reutilizar cachedIdsAdicionais — sem queries extras de thread
        const threadIdsParaBuscar = [threadId, ...cachedIdsAdicionais.current];

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
          console.log('[PAGINACAO] 📭 Sem mais mensagens antigas');
          return;
        }

        const reversed = older.reverse();
        setMessages(prev => [...reversed, ...prev]);
        setOldestLoadedAt(reversed[0]?.sent_at);
        console.log('[PAGINACAO] ✅ +', reversed.length, 'antigas (externa)');
      }
    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao buscar antigas:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [threadId, isThreadInterna, oldestLoadedAt, hasMore, isLoadingMore]);

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