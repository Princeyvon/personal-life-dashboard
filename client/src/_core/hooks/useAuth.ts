import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(_options?: UseAuthOptions) {
  const utils = trpc.useUtils();
  const [pinLoginLoading, setPinLoginLoading] = useState(false);
  const [pinLoginError, setPinLoginError] = useState<string | null>(null);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const loginWithPin = useCallback(async (pin: string) => {
    setPinLoginLoading(true);
    setPinLoginError(null);
    try {
      const response = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "The dashboard could not be unlocked. Please try again.");
      }
      await utils.auth.me.invalidate();
    } catch (error) {
      setPinLoginError(error instanceof Error ? error.message : "The dashboard could not be unlocked. Please try again.");
      throw error;
    } finally {
      setPinLoginLoading(false);
    }
  }, [utils]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      try {
        sessionStorage.removeItem("manus-cookie");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    try {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(meQuery.data)
      );
    } catch {}
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending || pinLoginLoading,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    pinLoginLoading,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
    loginWithPin,
    pinLoginLoading,
    pinLoginError,
  };
}
