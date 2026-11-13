import "server-only";
import type { NextRequest } from "next/server";
import { getEnv } from "./env";

// Sends a browser request on to ton-observer unchanged, apart from the header allowlist
// (PLAN.md Decisions › Transport). The API's session cookie and the browser's Origin pass
// through untouched: Origin === DASHBOARD_ORIGIN is the API's CSRF check.

export const MAX_BODY_BYTES = 64 * 1024;
export const UPSTREAM_TIMEOUT_MS = 15_000;

// Everything else is dropped, notably x-api-key and x-admin-key (a key header would override the
// session), host and x-forwarded-*.
const REQUEST_HEADERS = ["cookie", "origin", "content-type", "accept"] as const;

/** A JSON error reply; never cached. */
export function errorReply(status: number, code: string): Response {
  return Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

class BodyTooLarge extends Error {}

// Reads the stream with a cap; Content-Length is not trusted.
async function readBody(request: Request): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

/**
 * Forwards `request` to `{OBSERVER_API_URL}{pathAndSearch}`. `pathAndSearch` is the raw, still
 * encoded path plus query: never rebuilt from decoded params, since addresses can hold `/`, `+`, `:`.
 */
export async function forward(request: Request, pathAndSearch: string): Promise<Response> {
  const method = request.method;
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await readBody(request);
    } catch (error) {
      if (error instanceof BodyTooLarge) return errorReply(413, "payload_too_large");
      return errorReply(400, "invalid_request");
    }
  }

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  let upstream: Response;
  let payload: ArrayBuffer;
  try {
    upstream = await fetch(`${getEnv().OBSERVER_API_URL}${pathAndSearch}`, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    payload = await upstream.arrayBuffer();
  } catch (error) {
    // Name only: a message could carry a URL or a header.
    console.error(`dashboard forward error: ${error instanceof Error ? error.name : "unknown"}`);
    return isTimeout(error) ? errorReply(504, "api_timeout") : errorReply(502, "api_unreachable");
  }

  const reply = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["content-type", "location"]) {
    const value = upstream.headers.get(name);
    if (value !== null) reply.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) reply.append("set-cookie", cookie);

  const empty = upstream.status === 204 || upstream.status === 304;
  return new Response(empty ? null : payload, { status: upstream.status, headers: reply });
}

// A `.` or `..` segment, even percent-encoded, would be resolved away by the URL parser upstream.
function hasDotSegment(path: string): boolean {
  return path.split("/").some((segment) => /^(?:\.|%2e){1,2}$/i.test(segment));
}

// `/api/<rest>` may reach only these upstream paths; anything else is the dashboard's 404.
function isAllowedApiPath(rest: string): boolean {
  if (hasDotSegment(rest)) return false;
  return rest === "/graphql" || rest === "/users" || rest === "/projects" || rest.startsWith("/projects/");
}

/** `/api/<rest>` → `{API}/<rest>` for the allowlisted paths, else 404 `not_found`. */
export function forwardApi(request: NextRequest): Promise<Response> | Response {
  const { pathname, search } = request.nextUrl;
  const rest = pathname.slice("/api".length);
  if (!isAllowedApiPath(rest)) return errorReply(404, "not_found");
  return forward(request, `${rest}${search}`);
}

/** `/auth/<rest>` → `{API}/auth/<rest>`, any sub-path. */
export function forwardAuth(request: NextRequest): Promise<Response> | Response {
  const { pathname, search } = request.nextUrl;
  if (hasDotSegment(pathname)) return errorReply(404, "not_found");
  return forward(request, `${pathname}${search}`);
}
