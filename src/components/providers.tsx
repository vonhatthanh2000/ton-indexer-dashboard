"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ApiError, GqlError, configureClient } from "@/lib/client";
import { TooltipProvider } from "@/components/ui/tooltip";

// No retry on 4xx; once on 5xx and network errors.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiError) return error.status === 0 || error.status >= 500;
  if (error instanceof GqlError) return error.code === "INTERNAL_SERVER_ERROR";
  return true;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}

// Lets lib/client.ts route to `/` and refetch ["me"] when a project is gone.
function ClientEffectsBridge() {
  const router = useRouter();
  const client = useQueryClient();
  useEffect(() => {
    configureClient({
      push: (url) => router.push(url),
      invalidateMe: () => void client.invalidateQueries({ queryKey: ["me"] }),
    });
  }, [router, client]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <ClientEffectsBridge />
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster position="bottom-right" toastOptions={{ className: "toast" }} />
    </QueryClientProvider>
  );
}
