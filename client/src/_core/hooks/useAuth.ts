import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(_options?: UseAuthOptions) {
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.pinLogin.useMutation({
    onSuccess: (result) => {
      utils.auth.me.setData(undefined, result.user);
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const login = useCallback(async (pin: string) => {
    await loginMutation.mutateAsync({ pin });
    await utils.auth.me.invalidate();
  }, [loginMutation, utils]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return;
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  return useMemo(() => {
    const user = meQuery.data ?? null;
    try {
      localStorage.setItem("life-dashboard-user-info", JSON.stringify(user));
    } catch {}
    return {
      user,
      loading: meQuery.isLoading || loginMutation.isPending || logoutMutation.isPending,
      error: meQuery.error ?? loginMutation.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(user),
      login,
      refresh: () => meQuery.refetch(),
      logout,
    };
  }, [login, loginMutation.error, loginMutation.isPending, logout, logoutMutation.error, logoutMutation.isPending, meQuery.data, meQuery.error, meQuery.isLoading, meQuery.refetch]);
}
