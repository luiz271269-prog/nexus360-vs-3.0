import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

// Componente invisível: busca a contagem de e-mails pendentes via listarEmailsPendentes
// e reporta ao Layout (via onCount) para exibir como badge no ícone "Central de Comunicação".
export default function EmailsPendentesBadge({ usuario, onCount }) {
  const { data: total = 0 } = useQuery({
    queryKey: ['emails-pendentes-layout'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('listarEmailsPendentes', {});
        const lista = res?.data?.emails || res?.data || [];
        return Array.isArray(lista) ? lista.length : 0;
      } catch {
        return 0;
      }
    },
    staleTime: 60 * 1000,
    refetchInterval: 120 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!usuario
  });

  useEffect(() => {
    onCount?.(total);
  }, [total, onCount]);

  return null;
}