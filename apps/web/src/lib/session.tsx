import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CurrentUser, LoginInput, LoginResult, Permission } from "@c26/contracts";
import { api, isApiError, setSessionExpiredHandler } from "./api-client.ts";
import { clearServiceWorkerCaches } from "./service-worker.ts";
import { clearQueue } from "./photo/queue-store.ts";

/**
 * Session state.
 *
 * The token is not here, and cannot be: it lives in an httpOnly cookie that
 * JavaScript cannot read (PLAN/13 §2). This holds only who the user is, which
 * the server tells us.
 */

interface SessionContextValue {
  user: CurrentUser | null;
  loading: boolean;
  /**
   * True when the session could not be determined at all — the API was
   * unreachable or answered 500.
   *
   * This is deliberately NOT the same as `user === null`. Collapsing the two is
   * what made a brief API restart during `pnpm verify` throw the user back to
   * the login screen: a failure to ask was being read as an answer of "no".
   */
  unreachable: boolean;
  error: unknown;
  can: (permission: Permission) => boolean;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): ReactNode {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await api.get<CurrentUser>("/api/auth/me");
      } catch (error) {
        // `null` is a real answer: the server said there is no session. Anything
        // else is a failure to ask, and must not be reported as an answer.
        if (isApiError(error) && (error.code === "SESSION_EXPIRED" || error.code === "NOT_FOUND")) {
          return null;
        }
        throw error;
      }
    },
    // A restarting API — which `pnpm dev` does on every file change — should be
    // ridden out, not treated as a logout.
    retry: (failureCount, error) => {
      if (!isApiError(error)) return false;
      const transient = error.code === "SERVICE_UNAVAILABLE" || error.code === "INTERNAL_ERROR";
      return transient && failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    staleTime: 60_000,
  });

  const user = data ?? null;

  // `undefined` means the query never produced an answer. Paired with an error,
  // that is "we could not ask" — not "you are signed out".
  const unreachable = data === undefined && queryError !== null;

  /**
   * Wipes every trace of the previous session from the device.
   *
   * D-17 found the legacy tab state surviving a logout and a fresh login, which
   * meant the session boundary was not being honoured. A shared phone in a
   * vehicle pool makes that a real exposure, not a tidiness issue.
   */
  const clearClientState = useCallback(async () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    await clearQueue();
    await clearServiceWorkerCaches();
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      // Even if the request fails, the local state goes. A logout that leaves
      // the previous user's data on screen is worse than a logout that could not
      // reach the server.
      await clearClientState();
      window.location.assign("/login");
    }
  }, [clearClientState]);

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await api.post<LoginResult>("/api/auth/login", input);
      await refetch();
      return result;
    },
    [refetch],
  );

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const retry = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.setQueryData(["session"], null);
    });
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      loading: isLoading,
      unreachable,
      error: queryError,
      // Layer 1 of PLAN/04 §2.2: a menu the user has no permission for is not
      // rendered at all (K-07). The server enforces the same rule regardless —
      // hiding is a courtesy, not a control.
      can: (permission) => user?.permissions.includes(permission) ?? false,
      login,
      logout,
      refresh,
      retry,
    }),
    [user, isLoading, unreachable, queryError, login, logout, refresh, retry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
