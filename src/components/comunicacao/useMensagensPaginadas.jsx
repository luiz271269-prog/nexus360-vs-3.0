import { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook para paginação lazy de mensagens (WhatsApp style)
 * Carrega mensagens sob demanda ao scrollar para cima
 * 
 * @param {string} threadId - ID da thread ativa
 * @param {boolean} isThreadInterna - Se é thread interna (team_internal/sector_group)
 * @returns {object} { messages, hasMore, isLoadingMore, fetchOlder, reset }
 */
export const useMensagensPaginadas = (threadId, isThreadInterna = false) => {
  const [messages, setMessages] = useState([]);
  const [oldestLoadedAt, setOldestLoadedAt] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const lastThreadId = useRef(null);

  // Reset quando troca thread
  const reset = useCallback(() => {
    setMessages([]);
    setOldestLoadedAt(null);
    setHasMore(true);
    setIsLoadingMore(false);
    setIsInitialLoading(false);
  }, []);

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

      // ✅ BRANCH: Interno vs Externo (mesma lógica de Comunicacao.jsx)
      if (isThreadInterna) {
        // Thread interna: busca simples
        const msgs = await base44.entities.Message.filter(
          { thread_id: threadId },
          '-sent_at',
          20
        );
        
        const reversed = msgs.reverse();
        setMessages(reversed);
        setOldestLoadedAt(reversed[0]?.sent_at || null);
        setHasMore(msgs.length === 20); // Se chegou 20, pode ter mais
        
        console.log('[PAGINACAO] ✅ Inicial interna:', reversed.length);
      } else {
        // Thread externa: buscar merged + mesmo contato
        let threadIdsParaBuscar = [threadId];

        try {
          // Buscar threads merged
          const threadsMerged = await base44.entities.MessageThread.filter(
            { merged_into: threadId, status: 'merged' },
            '-created_date',
            20
          );

          if (threadsMerged.length > 0) {
            threadIdsParaBuscar.push(...threadsMerged.map(t => t.id));
          }

          // Buscar thread atual para pegar contact_id
          const threadAtual = await base44.entities.MessageThread.filter(
            { id: threadId },
            '-created_date',
            1
          );

          if (threadAtual.length > 0 && threadAtual[0].contact_id) {
            // Buscar todas threads do mesmo contato
            const todasThreadsDoContato = await base44.entities.MessageThread.filter(
              {
                contact_id: threadAtual[0].contact_id,
                status: { $in: ['aberta', 'fechada'] }
              },
              '-created_date',
              50
            );

            if (todasThreadsDoContato.length > 1) {
              const idsAdicionais = todasThreadsDoContato.map(t => t.id).filter(id => !threadIdsParaBuscar.includes(id));
              threadIdsParaBuscar.push(...idsAdicionais);
            }
          }
        } catch (err) {
          console.warn('[PAGINACAO] ⚠️ Erro ao buscar threads para merge:', err.message);
        }

        // Buscar mensagens de todas as threads consolidadas
        const msgs = await base44.entities.Message.filter(
          { thread_id: { $in: threadIdsParaBuscar } },
          '-sent_at',
          20
        );

        const reversed = msgs.reverse();
        setMessages(reversed);
        setOldestLoadedAt(reversed[0]?.sent_at || null);
        setHasMore(msgs.length === 20);

        console.log('[PAGINACAO] ✅ Inicial externa:', reversed.length, 'de', threadIdsParaBuscar.length, 'threads');
      }
    } catch (error) {
      console.error('[PAGINACAO] ❌ Erro ao carregar inicial:', error);
      setMessages([]);
      setHasMore(false);
    } finally {
      setIsInitialLoading(false);
    }
  }, [threadId, isThreadInterna, reset]);

  // Buscar mensagens mais antigas (scroll-up)
  const fetchOlder = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestLoadedAt || !threadId) {
      return;
    }

    setIsLoadingMore(true);

    try {
      console.log('[PAGINACAO] ⬆️ Buscando mensagens antigas...');

      if (isThreadInterna) {
        // Thread interna: busca simples com filtro de timestamp
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
          console.log('[PAGINACAO] 📭 Sem mais mensagens internas');
          return;
        }

        const reversed = older.reverse();
        setMessages(prev => [...reversed, ...prev]); // Inserir NO INÍCIO
        setOldestLoadedAt(reversed[0]?.sent_at);

        console.log('[PAGINACAO] ✅ +', reversed.length, 'antigas carregadas (interna)');
      } else {
        // Thread externa: buscar de todas as threads consolidadas
        let threadIdsParaBuscar = [threadId];

        // Buscar merged + mesmo contato (igual inicial)
        try {
          const threadsMerged = await base44.entities.MessageThread.filter(
            { merged_into: threadId, status: 'merged' },
            '-created_date',
            20
          );

          if (threadsMerged.length > 0) {
            threadIdsParaBuscar.push(...threadsMerged.map(t => t.id));
          }

          const threadAtual = await base44.entities.MessageThread.filter(
            { id: threadId },
            '-created_date',
            1
          );

          if (threadAtual.length > 0 && threadAtual[0].contact_id) {
            const todasThreadsDoContato = await base44.entities.MessageThread.filter(
              {
                contact_id: threadAtual[0].contact_id,
                status: { $in: ['aberta', 'fechada'] }
              },
              '-created_date',
              50
            );

            if (todasThreadsDoContato.length > 1) {
              const idsAdicionais = todasThreadsDoContato.map(t => t.id).filter(id => !threadIdsParaBuscar.includes(id));
              threadIdsParaBuscar.push(...idsAdicionais);
            }
          }
        } catch (err) {
          console.warn('[PAGINACAO] ⚠️ Erro ao buscar threads para merge (paginação):', err.message);
        }

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
        setMessages(prev => [...reversed, ...prev]); // Inserir NO INÍCIO
        setOldestLoadedAt(reversed[0]?.sent_at);

        console.log('[PAGINACAO] ✅ +', reversed.length, 'antigas carregadas (externa)');
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