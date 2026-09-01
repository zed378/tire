import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./api-client.ts";

/**
 * TanStack Query replaces what a fullstack framework would give for free:
 * caching, retries, and invalidation (PLAN/01 §4.1).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 403 or a 422 accomplishes nothing except delaying the error
      // the user needs to see. Only transient failures are worth a second go.
      retry: (failureCount, error) => {
        if (!isApiError(error)) return false;
        const retryable = error.code === "SERVICE_UNAVAILABLE" || error.code === "INTERNAL_ERROR";
        return retryable && failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
