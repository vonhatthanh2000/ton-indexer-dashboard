// Every browser call goes through here: `/api/*` and `/auth/*` on this origin only, which the
// dashboard forwards to ton-observer (PLAN.md Decisions › Client errors). The session is the API's
// `__Host-session` cookie; the browser sends it and its own `Origin` header, nothing else is added.
import { safeNextPath } from "@/features/auth/next-path";
import type { HealthState } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly field?: string,
    readonly index?: number,
    readonly problem?: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export class GqlError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GqlError";
  }
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /**
   * By default a 404 `project_not_found` refetches ["me"] and leaves for `/`. Admin actions on a
   * project (rename, delete) set this to stay put and refresh their own list instead.
   */
  stayOnProjectGone?: boolean;
}

/** Side effects of an error reply; `ClientEffectsBridge` wires the router and the query client. */
export interface ClientEffects {
  /** A full page load: the client cache goes with it. */
  navigate: (url: string) => void;
  /** A client-side route change. */
  push: (url: string) => void;
  /** Refetch `["me"]`: the user's projects or roles changed. */
  invalidateMe: () => void;
}

const defaultEffects: ClientEffects = {
  navigate: (url) => window.location.assign(url),
  push: (url) => window.location.assign(url),
  invalidateMe: () => {},
};

let effects: ClientEffects = { ...defaultEffects };

/** The app wires the router and the query client here once; tests swap them. */
export function configureClient(next: Partial<ClientEffects>): void {
  effects = { ...effects, ...next };
}

/** Back to the defaults (tests). */
export function resetClient(): void {
  effects = { ...defaultEffects };
}

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

/** `/login?reason=expired`, plus `next` when the current page is a workspace page. */
export function loginUrlForExpiry(path = currentPath()): string {
  const next = safeNextPath(path);
  return next === null ? "/login?reason=expired" : `/login?reason=expired&next=${encodeURIComponent(next)}`;
}

function toApiError(status: number, body: unknown): ApiError {
  const data = (body ?? {}) as { error?: unknown; field?: unknown; index?: unknown; problem?: unknown };
  const code = typeof data.error === "string" ? data.error : status >= 500 ? "internal_error" : "invalid_request";
  return new ApiError(
    status,
    code,
    typeof data.field === "string" ? data.field : undefined,
    typeof data.index === "number" ? data.index : undefined,
    typeof data.problem === "string" ? data.problem : undefined,
  );
}

function signedOut(): void {
  effects.navigate(loginUrlForExpiry());
}

function projectGone(): void {
  effects.invalidateMe();
  effects.push("/");
}

// Any 401 but a wrong password means the session is gone (not_logged_in, missing_api_key and
// missing_admin_key all reach here when the cookie expired).
function handleError(error: ApiError, options: ApiFetchOptions = {}): ApiError {
  if (error.status === 401 && error.code !== "invalid_credentials") signedOut();
  else if (error.status === 404 && error.code === "project_not_found" && !options.stayOnProjectGone) projectGone();
  return error;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function send(path: string, options: ApiFetchOptions): Promise<Response> {
  const method = options.method ?? "GET";
  try {
    return await fetch(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network");
  }
}

/** Throws ApiError on any non-2xx; a lost session or a gone project also navigates. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await send(path, options);
  const body = await readBody(response);
  if (response.ok) return body as T;
  throw handleError(toApiError(response.status, body), options);
}

interface GraphqlReply<T> {
  data?: T | null;
  errors?: { message?: string; extensions?: { code?: string } }[];
}

function toGqlError(code: string, message: string): GqlError {
  if (code === "UNAUTHENTICATED") {
    signedOut();
    return new GqlError(code, message);
  }
  if (code === "FORBIDDEN") {
    if (message === "Origin: not allowed") return new GqlError("bad_origin", message);
    // `project(id:)` on a project the caller can't read: gone, or no longer a member.
    if (message.startsWith("id:")) {
      projectGone();
      return new GqlError("project_not_found", message);
    }
  }
  // FORBIDDEN "address: …" stays FORBIDDEN: the hook refetches the project and retries once.
  return new GqlError(code, message);
}

/** Throws GqlError on the first error, even with HTTP 200; ApiError on a non-GraphQL failure. */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await send("/api/graphql", { method: "POST", body: { query, variables } });
  const body = (await readBody(response)) as GraphqlReply<T> | { error?: string } | undefined;
  if (body && "errors" in body && body.errors && body.errors.length > 0) {
    const first = body.errors[0];
    throw toGqlError(first.extensions?.code ?? "INTERNAL_SERVER_ERROR", first.message ?? "");
  }
  if (!response.ok) throw handleError(toApiError(response.status, body));
  const data = (body as GraphqlReply<T> | undefined)?.data;
  if (data === undefined || data === null) throw new GqlError("INTERNAL_SERVER_ERROR", "");
  return data;
}

/** Health is returned, never thrown. */
export async function fetchHealth(): Promise<HealthState> {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (response.status === 200) return "online";
    if (response.status === 503) return "database_down";
    return "unreachable";
  } catch {
    return "unreachable";
  }
}

export function errorCode(error: unknown): string {
  if (error instanceof ApiError || error instanceof GqlError) return error.code;
  return "internal_error";
}
