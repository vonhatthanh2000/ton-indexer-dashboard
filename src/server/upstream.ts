import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEnv } from "./env";
import {
  type Role,
  type SessionData,
  clearSessionCookies,
  readSession,
} from "./session";

export const CSRF_HEADER = "x-requested-with";
export const CSRF_VALUE = "dashboard";
export const MAX_BODY_BYTES = 64 * 1024;
export const UPSTREAM_TIMEOUT_MS = 15_000;

const PROJECT_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ADMIN_KEY_PATTERN = /^[\x20-\x7E]{1,256}$/;
const uuidSchema = z.uuid();

export class ProxyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "ProxyError";
  }
}

// ---- replies ------------------------------------------------------------------------------

export function json(status: number, body: unknown): NextResponse {
  const response =
    status === 204 || body === undefined
      ? new NextResponse(null, { status })
      : NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function errorReply(status: number, code: string): NextResponse {
  return json(status, { error: code });
}

export function sessionExpiredReply(request: NextRequest): NextResponse {
  const response = errorReply(401, "session_expired");
  clearSessionCookies(response, request);
  return response;
}

// ---- input checks -------------------------------------------------------------------------

export function isValidProjectKey(key: string): boolean {
  return PROJECT_KEY_PATTERN.test(key);
}

export function isValidAdminKey(key: string): boolean {
  return ADMIN_KEY_PATTERN.test(key);
}

export function isValidKey(role: Role, key: string): boolean {
  return role === "admin" ? isValidAdminKey(key) : isValidProjectKey(key);
}

export function requireProjectId(value: string): string {
  if (!uuidSchema.safeParse(value).success) throw new ProxyError(400, "invalid_project_id");
  return value;
}

export function checkCsrf(request: NextRequest): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  if (request.headers.get(CSRF_HEADER) !== CSRF_VALUE) throw new ProxyError(403, "csrf");
}

// Reads the stream with a cap; Content-Length is not trusted.
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  if (!request.body) throw new ProxyError(400, "invalid_request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ProxyError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new ProxyError(400, "invalid_request");
  }
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProxyError(400, "invalid_request");
  }
  return value as Record<string, unknown>;
}

// ---- upstream calls -----------------------------------------------------------------------

export type KeyHeader = { "X-Admin-Key": string } | { "X-API-Key": string } | Record<string, never>;

export interface UpstreamReply {
  status: number;
  body: unknown; // parsed JSON, or undefined for an empty body
}

export async function callUpstream(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  keyHeader: KeyHeader,
  body?: unknown,
): Promise<UpstreamReply> {
  const url = `${getEnv().OBSERVER_API_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Accept: "application/json",
        ...keyHeader,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ProxyError(504, "api_timeout");
    }
    throw new ProxyError(502, "api_unreachable");
  }
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new ProxyError(504, "api_timeout");
    throw new ProxyError(502, "api_unreachable");
  }
  if (text.length === 0) return { status: response.status, body: undefined };
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    throw new ProxyError(502, "api_unreachable");
  }
}

export function passThrough(reply: UpstreamReply): NextResponse {
  return json(reply.status, reply.body);
}

// ---- route wrapper ------------------------------------------------------------------------

export interface RouteOptions {
  /** Session role required; omit for routes that need no session. */
  role?: Role;
}

type Handler<Context> = (
  request: NextRequest,
  context: Context & { session: SessionData | undefined },
) => Promise<NextResponse>;

export function route<Context extends object>(
  options: RouteOptions,
  handler: Handler<Context>,
): (request: NextRequest, context: Context) => Promise<NextResponse> {
  return async (request, context) => {
    try {
      checkCsrf(request);
      let session: SessionData | undefined;
      if (options.role) {
        const state = await readSession(request.cookies);
        if (state.kind !== "valid") return sessionExpiredReply(request);
        if (state.session.role !== options.role) return errorReply(403, "wrong_role");
        session = state.session;
      }
      return await handler(request, { ...context, session });
    } catch (error) {
      if (error instanceof ProxyError) return errorReply(error.status, error.code);
      // Name only: a message could carry a URL or header.
      console.error(`dashboard api error: ${error instanceof Error ? error.name : "unknown"}`);
      return errorReply(500, "internal_error");
    }
  };
}
