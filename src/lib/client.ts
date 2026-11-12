// Every browser call goes through here: `/api/*` on this origin only (PLAN.md Decisions › Client).
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
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

type Navigate = (url: string) => void;

let navigate: Navigate = (url) => window.location.assign(url);

/** Tests swap the navigation; the app never does. */
export function setNavigate(next: Navigate): void {
  navigate = next;
}

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function loginUrlForExpiry(path = currentPath()): string {
  const next = path.startsWith("/admin") || path.startsWith("/project") ? `&next=${encodeURIComponent(path)}` : "";
  return `/login?reason=expired${next}`;
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
        ...(method === "GET" ? {} : { "X-Requested-With": "dashboard" }),
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

/** Throws ApiError on any non-2xx; handles session_expired and wrong_role by navigating. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await send(path, options);
  const body = await readBody(response);
  if (response.ok) return body as T;
  const error = toApiError(response.status, body);
  if (error.code === "session_expired") navigate(loginUrlForExpiry());
  if (error.code === "wrong_role") navigate("/");
  throw error;
}

interface GraphqlReply<T> {
  data?: T | null;
  errors?: { message?: string; extensions?: { code?: string } }[];
}

/** Throws GqlError on the first error, even with HTTP 200. */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await send("/api/graphql", { method: "POST", body: { query, variables } });
  const body = (await readBody(response)) as GraphqlReply<T> | { error?: string } | undefined;
  if (body && "errors" in body && body.errors && body.errors.length > 0) {
    const first = body.errors[0];
    throw new GqlError(first.extensions?.code ?? "INTERNAL_SERVER_ERROR", first.message ?? "");
  }
  if (!response.ok) {
    const error = toApiError(response.status, body);
    if (error.code === "session_expired") navigate(loginUrlForExpiry());
    if (error.code === "wrong_role") navigate("/");
    throw error;
  }
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
