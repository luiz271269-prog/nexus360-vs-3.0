import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook que detecta scroll no topo do chat e busca mais 20 mensagens antigas.
 * Inclui TODAS as threads do contato (busca no banco pelo contact_id).
 * 
 * ✅ FIXES:
 * - Auto-reset ao trocar thread
 * - Cache de threads adicionais para evitar múltiplas queries
 * - Proteção contra cursor undefined
 * - Ordenação explícita para evitar inconsistência
 */
export default function useScrollPaginacao({
  thread,
  queryClient,
  allThreads = []
}) {
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestLoadedTimestamp, setOldestLoadedTimestamp] = useState(null);
  const [isHistoryStart, setIsHistoryStart] = useState(false); // ✅ FIX 6: Flag para "início do histórico"
  const chatContainerRef = useRef(null);
  const isLoadingOlderRef = useRef(false);
  const cachedThreadIdsRef = useRef({ contactId: null, threadIds: [] });
  const abortControllerRef = useRef(null); // ✅ FIX 7: Cancelar requests ao trocar thread

  // ✅ FIX 1: Auto-reset ao trocar de thread (não depende do pai chamar initTimestamp)
  useEffect(() => {
    console.log('[SCROLL-THREAD-CHANGE] 🔄 Thread mudou:', thread?.id?.substring(0, 8));
    
    // ✅ FIX 7: Cancelar qualquer request pendente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setHasMoreMessages(true);
    setOldestLoadedTimestamp(null);
    setIsHistoryStart(false);
    cachedThreadIdsRef.current = { contactId: null, threadIds: [] }; // Limpar cache
  }, [thread?.id, thread?.contact_id]);

  // ✅ FIX 2: Função para inicializar cursor (ainda pode ser chamada pelo pai)
  const initTimestamp = (msgs) => {
    if (msgs?.length > 0) {
      const cursor = msgs[0]?.sent_at || msgs[0]?.created_date;
      console.log('[SCROLL-INIT] ✅ Cursor=', cursor, '|', msgs.length, 'mensagens');
      setOldestLoadedTimestamp(cursor);
      setHasMoreMessages(true);
    } else {
      // ✅ CRÍTICO: Se sem mensagens, usar timestamp FUTURO para scroll-up funcionar
      const futureTimestamp = new Date().toISOString();
      console.log('[SCROLL-INIT] ⚠️ Sem msgs iniciais. Cursor=', futureTimestamp);
      setOldestLoadedTimestamp(futureTimestamp);
      setHasMoreMessages(true);
    }
  };

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = async () => {
      // ✅ DEBUG COMPLETO: Log cada condição
      if (isLoadingOlderRef.current) {
        console.log('[SCROLL] ⏸️ Já carregando...');
        return;
      }
      if (!hasMoreMessages) {
        console.log('[SCROLL] 📭 hasMoreMessages=false');
        setIsHistoryStart(true); // ✅ FIX 6: Sinalizar início do histórico
        return;
      }
      if (!oldestLoadedTimestamp) {
        console.log('[SCROLL] ❌ oldestLoadedTimestamp=null, ignorando');
        return;
      }
      if (container.scrollTop > 150) {
        console.log('[SCROLL] 📏 scrollTop=', container.scrollTop, '> 150');
        return;
      }

      console.log('[SCROLL-UP] ⬆️ ACIONANDO busca | scrollTop=', container.scrollTop, '| cursor=', oldestLoadedTimestamp);
      
      // ✅ FIX 7: Criar novo AbortController para este request
      abortControllerRef.current = new AbortController();
      
      isLoadingOlderRef.current = true;
      setLoadingOlder(true);

      try {
        const scrollHeightBefore = container.scrollHeight;
        const scrollTopBefore = container.scrollTop;

        const isThreadInterna = thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';
        let olderMessages = [];

        if (isThreadInterna) {
          olderMessages = await base44.entities.Message.filter(
            { thread_id: thread.id, sent_at: { $lt: oldestLoadedTimestamp } },
            '-sent_at',
            20
          );
        } else {
          // ✅ FIX 3: Cache de threads adicionais — não fazer query a cada scroll
          const contactId = thread?.contact_id;
          let threadIds = [thread.id];

          if (contactId) {
            // Verificar se o cache é válido para este contact
            if (cachedThreadIdsRef.current.contactId === contactId && cachedThreadIdsRef.current.threadIds.length > 0) {
              console.log('[SCROLL-UP] 💾 Usando cache de threads');
              threadIds = cachedThreadIdsRef.current.threadIds;
            } else {
              // Buscar threads do contato UMA VEZ
              let idsAdicionais = [];
              try {
                const todasThreads = await base44.entities.MessageThread.filter(
                  { contact_id: contactId },
                  '-created_date',
                  50
                );
                idsAdicionais = todasThreads
                  .filter(t => t.id !== thread.id)
                  .map(t => t.id);
              } catch (_) {
                // fallback: usar memória
                allThreads.forEach(t => {
                  if (t.id !== thread.id && t.contact_id === contactId) idsAdicionais.push(t.id);
                });
              }

              threadIds = [thread.id, ...new Set(idsAdicionais)];
              cachedThreadIdsRef.current = { contactId, threadIds };
            }
          }

          console.log('[SCROLL-UP] 🔍 Buscando em', threadIds.length, 'threads');

          olderMessages = await base44.entities.Message.filter(
            { thread_id: { $in: threadIds }, sent_at: { $lt: oldestLoadedTimestamp } },
            '-sent_at',
            20
          );
        }

        if (olderMessages.length === 0) {
          console.log('[SCROLL-UP] 📭 Fim do histórico');
          setHasMoreMessages(false);
          setIsHistoryStart(true); // ✅ FIX 6: Marcar início do histórico
          return;
        }

        console.log('[SCROLL-UP] ✅ Carregadas', olderMessages.length, 'mensagens antigas');

        // ✅ DEDUPLICAÇÃO CIRÚRGICA: Merge por ID sem duplicatas
        queryClient.setQueryData(['mensagens', thread.id], (antigas = []) => {
          const byId = new Map();
          const novos = olderMessages.reverse();

          [...novos, ...antigas].forEach(m => {
            if (!m?.id) return;
            byId.set(m.id, m);
          });

          // Manter ordenado por sent_at ASC (mais antigas primeiro)
          return Array.from(byId.values()).sort((a, b) => {
            const aTime = (a.sent_at || a.created_date || '').toString();
            const bTime = (b.sent_at || b.created_date || '').toString();
            return aTime.localeCompare(bTime);
          });
        });

        // ✅ FIX 4: Cursor com proteção — validar que existe timestamp válido
        const newCursor = olderMessages[0]?.sent_at || olderMessages[0]?.created_date;
        if (!newCursor) {
          console.warn('[SCROLL-UP] ⚠️ Mensagem sem timestamp! Fim do histórico.');
          setHasMoreMessages(false);
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
        console.error('[SCROLL-UP] ❌ Erro ao carregar antigas:', error);
      } finally {
        isLoadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
    // ✅ FIX 5: Dependências mais completas para recriar listener quando thread muda
  }, [thread, hasMoreMessages, oldestLoadedTimestamp, queryClient, allThreads]);

  return {
    chatContainerRef,
    loadingOlder,
    hasMoreMessages,
    oldestLoadedTimestamp,
    initTimestamp
  };
}