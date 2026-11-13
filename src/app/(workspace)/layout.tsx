import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { safeNextPath } from "@/features/auth/next-path";
import { WorkspaceError } from "@/features/auth/workspace-error";
import { ApiError } from "@/lib/client";
import type { Me } from "@/lib/types";
import { getMe } from "@/server/me";

// The shared signed-in layout. error.tsx in this folder does not wrap this layout itself (it
// wraps the pages below it), so an API failure here renders WorkspaceError directly.
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  let me: Me | null;
  try {
    me = await getMe();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <main id="main" className="min-h-screen p-6">
        <WorkspaceError code={error.code} />
      </main>
    );
  }

  if (me === null) {
    // Set by src/proxy.ts on every workspace request.
    const next = safeNextPath((await headers()).get("x-dashboard-path"));
    redirect(next === null ? "/login?reason=expired" : `/login?reason=expired&next=${encodeURIComponent(next)}`);
  }

  // Seeds the client's ["me"] query; router.refresh() re-renders this with fresh data.
  const client = new QueryClient();
  client.setQueryData(["me"], me);
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <AppShell me={me}>{children}</AppShell>
    </HydrationBoundary>
  );
}
