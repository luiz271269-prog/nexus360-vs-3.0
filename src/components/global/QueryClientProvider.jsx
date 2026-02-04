import { QueryClient, QueryClientProvider as TanstackQueryClientProvider } from '@tanstack/react-query';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  QUERY CLIENT OTIMIZADO PARA RATE LIMIT                     ║
 * ║  Cache agressivo + Retry inteligente + Deduplicação        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// Configuração otimizada para evitar rate limit
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // CACHE AGRESSIVO - Dados ficam "frescos" por 5 minutos
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      
      // Não refetch automaticamente para reduzir chamadas
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      
      // Retry com backoff exponencial
      retry: (failureCount, error) => {
        // Se for rate limit (429), tentar 3 vezes
        if (error?.response?.status === 429 || error?.message?.includes('Rate limit')) {
          return failureCount < 3;
        }
        // Outros erros: 1 retry
        return failureCount < 1;
      },
      
      retryDelay: (attemptIndex) => {
        // Backoff exponencial: 1s, 2s, 4s, 8s...
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
      
      // Deduplicação automática de requests
      structuralSharing: true,
    },
  },
});

export default function QueryClientProvider({ children }) {
  return (
    <TanstackQueryClientProvider client={queryClient}>
      {children}
    </TanstackQueryClientProvider>
  );
}

// Exportar o queryClient para uso direto se necessário
export { queryClient };