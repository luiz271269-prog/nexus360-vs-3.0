import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook que detecta scroll no topo do chat e busca mais 20 mensagens antigas.
 * Inclui TODAS as threads do contato (busca no banco pelo contact_id).
 */
export default function useScrollPaginacao({
  thread,
  queryClient,
  allThreads = []
}) {
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestLoadedTimestamp, setOldestLoadedTimestamp] = useState(null);
  const chatContainerRef = useRef(null);
  const isLoadingOlderRef = useRef(false);

  // Reseta quando muda de thread
  const initTimestamp = (msgs) => {
    if (msgs?.length > 0) {
      setOldestLoadedTimestamp(msgs[0]?.sent_at || msgs[0]?.created_date || null);
      setHasMoreMessages(true); // sempre true ao abrir — pode haver histórico em outras threads
    } else {
      setOldestLoadedTimestamp(null);
      setHasMoreMessages(true);
    }
  };

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = async () => {
      if (isLoadingOlderRef.current || !hasMoreMessages || !oldestLoadedTimestamp) return;
      if (container.scrollTop > 150) return;

      console.log('[SCROLL-UP] ⬆️ Próximo do topo - buscando mensagens antigas...');
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
          // Buscar TODAS as threads do contato no banco — garante histórico completo
          const contactId = thread?.contact_id;
          let idsAdicionais = [];

          if (contactId) {
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
          }

          const threadIds = [thread.id, ...new Set(idsAdicionais)];
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

        // ✅ CURSOR ESTRITO: sempre buscar ANTES do ponto anterior
        setOldestLoadedTimestamp(olderMessages[0]?.sent_at || olderMessages[0]?.created_date);

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
  }, [thread?.id, thread?.contact_id, thread?.thread_type, hasMoreMessages, oldestLoadedTimestamp, queryClient, allThreads]);

  return {
    chatContainerRef,
    loadingOlder,
    hasMoreMessages,
    oldestLoadedTimestamp,
    initTimestamp
  };
}