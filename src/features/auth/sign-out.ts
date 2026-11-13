"use client";

import type { QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client";

/** Ends the API session, then a full load of /login so no cached data survives. */
export async function signOut(client: QueryClient) {
  try {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  } finally {
    client.clear();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
}
