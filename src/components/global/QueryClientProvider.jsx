import React, { useMemo } from 'react';
import { QueryClient, QueryClientProvider as TanstackQueryClientProvider } from '@tanstack/react-query';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  QUERY CLIENT OTIMIZADO PARA RATE LIMIT                     ║
 * ║  Cache agressivo + Retry inteligente + Deduplicação        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// Criar instância lazy para evitar inicialização fora de contexto React
let cachedClient = null;

function getQueryClient() {
  if (!cachedClient) {
    cachedClient = new QueryClient({
      defaultOptions: {
        queries: {
          // CACHE AGRESSIVO - Dados ficam "frescos" por 5 minutos
          staleTime: 5 * 60 * 1000, // 5 minutos
          gcTime: 10 * 60 * 1000, // Renomeado de cacheTime (React Query v5)
          
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
          networkMode: 'always'
        },
      },
    });
  }
  return cachedClient;
}

export default function QueryClientProvider({ children }) {
  // ✅ Usar useMemo para garantir instância única dentro do componente
  const queryClient = useMemo(() => getQueryClient(), []);
  
  return (
    <TanstackQueryClientProvider client={queryClient}>
      {children}
    </TanstackQueryClientProvider>
  );
}

// Exportar função para obter o cliente
export { getQueryClient };