import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { ApiError } from "@/lib/client";
import type { Me } from "@/lib/types";
import { getEnv } from "./env";
import { UPSTREAM_TIMEOUT_MS } from "./forward";

// The digest survives into error.tsx in production, where a server error's message is hidden.
export const DIGEST_PREFIX = "api_error:";

function failure(status: number, code: string): ApiError {
  return Object.assign(new ApiError(status, code), { digest: `${DIGEST_PREFIX}${code}` });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * `GET {API}/auth/me` with the given Cookie header: `Me` on 200, `null` on 401.
 * Anything else throws ApiError (`login_disabled`, 5xx, `api_timeout`, `api_unreachable`).
 */
export async function fetchMe(cookie: string | null): Promise<Me | null> {
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(`${getEnv().OBSERVER_API_URL}/auth/me`, {
      headers: { accept: "application/json", ...(cookie ? { cookie } : {}) },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    body = await readJson(response);
  } catch (error) {
    // Name only: a message could carry a URL or a header.
    console.error(`dashboard me error: ${error instanceof Error ? error.name : "unknown"}`);
    if (error instanceof DOMException && error.name === "TimeoutError") throw failure(504, "api_timeout");
    throw failure(502, "api_unreachable");
  }
  if (response.status === 401) return null;
  if (response.status === 200) {
    const me = body as Partial<Me> | undefined;
    if (!me || typeof me.user !== "object" || !Array.isArray(me.projects)) throw failure(502, "api_unreachable");
    return me as Me;
  }
  const code = (body as { error?: unknown } | undefined)?.error;
  throw failure(response.status, typeof code === "string" ? code : "internal_error");
}

/** The signed-in user for this request; one API call per request (React `cache`). Server only. */
export const getMe = cache(async (): Promise<Me | null> => fetchMe((await headers()).get("cookie")));
