'use client';

/**
 * NEIMAN Client Providers
 * Sets up TanStack Query and configures the API client with the auth store token.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import { useAuthStore } from '@/store/auth';
import { configureApiClient } from '@/lib/api/client';
import { ThemeProvider } from '@/components/ThemeProvider';

configureApiClient(() => useAuthStore.getState().token);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.LONG,
      gcTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.INACTIVE_GC,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: (failureCount, error: unknown) => {
        // Don't retry on 401/403
        if (error instanceof Error) {
          const msg = error.message;
          if (msg.includes('401') || msg.includes('403')) return false;
        }
        return failureCount < NEIMAN_CONFIG.OPERATIONAL_LIMITS.DEFAULT_RETRY_COUNT;
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
