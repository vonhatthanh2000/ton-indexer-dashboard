"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client";
import type { Me } from "@/lib/types";

export const ME_KEY = ["me"] as const;

/**
 * The signed-in user and their projects: the client's source of truth for roles. The workspace
 * layout seeds it from the server; after a role change or a 403, invalidate it and router.refresh().
 */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: () => apiFetch<Me>("/auth/me") });
}
