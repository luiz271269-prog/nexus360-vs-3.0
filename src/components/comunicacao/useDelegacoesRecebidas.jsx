/**
 * Hook que carrega delegações ativas onde o usuário logado é o destino.
 * Retorna a lista de IDs dos usuários que delegaram acesso para mim.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useDelegacoesRecebidas(usuarioId) {
  const { data: delegacoes = [] } = useQuery({
    queryKey: ['delegacoes-recebidas', usuarioId],
    queryFn: async () => {
      if (!usuarioId) return [];
      try {
        return await base44.entities.DelegacaoAcesso.filter(
          { destino_user_id: usuarioId, status: 'ativa' },
          '-created_date',
          50
        );
      } catch (e) {
        console.warn('[DELEGACOES] Erro ao carregar:', e.message);
        return [];
      }
    },
    enabled: !!usuarioId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Retorna apenas os IDs dos usuários que delegaram para mim
  return delegacoes
    .filter(d => d.destino_tipo === 'user' && d.origem_user_id)
    .map(d => d.origem_user_id);
}