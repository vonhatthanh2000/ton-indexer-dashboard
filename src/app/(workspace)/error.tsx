"use client";

import { WorkspaceError } from "@/features/auth/workspace-error";
import { ApiError, GqlError } from "@/lib/client";

// Must match DIGEST_PREFIX in src/server/me.ts (a server-only module).
const DIGEST_PREFIX = "api_error:";

// A server error arrives with its message hidden in production; getMe puts the code in the digest.
function codeOf(error: unknown): string {
  if (error instanceof ApiError || error instanceof GqlError) return error.code;
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && digest.startsWith(DIGEST_PREFIX)) return digest.slice(DIGEST_PREFIX.length);
  return "internal_error";
}

// Errors from pages under the workspace layout (the layout itself renders WorkspaceError).
export default function WorkspaceErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  return <WorkspaceError code={codeOf(error)} onRetry={retry} />;
}
