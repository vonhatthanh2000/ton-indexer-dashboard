"use client";

import type { QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client";
import type { SessionInfo } from "@/lib/types";

export function signIn(role: SessionInfo["role"], key: string) {
  return apiFetch<SessionInfo>("/api/auth/login", { method: "POST", body: { role, key } });
}

/** Clears cached data from the old role, then a full page load. */
export async function signOut(client: QueryClient) {
  try {
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
  } finally {
    client.clear();
    // A full load on purpose: no cached data or client state from the old session survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
}

export function homeFor(role: SessionInfo["role"]): string {
  return role === "admin" ? "/admin" : "/project";
}
