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
  can: (permission: Permission) => boolean;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): ReactNode {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await api.get<CurrentUser>("/api/auth/me");
      } catch (error) {
        // Not signed in is a normal state, not an error to surface.
        if (isApiError(error) && (error.code === "SESSION_EXPIRED" || error.code === "NOT_FOUND")) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const user = data ?? null;

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

  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.setQueryData(["session"], null);
    });
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      loading: isLoading,
      // Layer 1 of PLAN/04 §2.2: a menu the user has no permission for is not
      // rendered at all (K-07). The server enforces the same rule regardless —
      // hiding is a courtesy, not a control.
      can: (permission) => user?.permissions.includes(permission) ?? false,
      login,
      logout,
      refresh,
    }),
    [user, isLoading, login, logout, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
