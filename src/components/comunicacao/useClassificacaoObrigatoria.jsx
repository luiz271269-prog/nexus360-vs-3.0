import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Gate de classificação obrigatória.
 * Trava o envio quando o contato externo ainda está como "novo" (sem definição)
 * e a conversa já está em andamento (>= 2 mensagens trocadas).
 */
export function useClassificacaoObrigatoria(thread) {
  const queryClient = useQueryClient();

  const isExterna = thread?.thread_type !== 'team_internal' && thread?.thread_type !== 'sector_group';
  const contactId = isExterna ? thread?.contact_id : null;
  const conversaEmAndamento = (thread?.total_mensagens || 0) >= 2;

  const { data: contato } = useQuery({
    queryKey: ['classificacao-obrigatoria', contactId],
    queryFn: () => base44.entities.Contact.get(contactId),
    enabled: !!contactId && conversaEmAndamento,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  const bloqueado = !!contato && conversaEmAndamento && (!contato.tipo_contato || contato.tipo_contato === 'novo');

  const classificar = async (tipo) => {
    if (!contactId) return;
    await base44.entities.Contact.update(contactId, { tipo_contato: tipo });
    await queryClient.invalidateQueries({ queryKey: ['classificacao-obrigatoria', contactId] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  return { bloqueado, contato, classificar };
}