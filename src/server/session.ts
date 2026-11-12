import { sealData, unsealData } from "iron-session";
import type { NextRequest, NextResponse } from "next/server";
import { getEnv } from "./env";

export const SESSION_COOKIE = "tonobs_session";
export const PKEYS_COOKIE = "tonobs_pkeys";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const MAX_PROJECT_KEYS = 20;

export type Role = "admin" | "project";

export interface SessionData {
  role: Role;
  key: string;
  projectId?: string;
  projectName?: string;
  issuedAt: number; // ms since epoch
}

export interface ProjectKeyEntry {
  projectId: string;
  key: string;
  addedAt: number;
}

export type SessionState =
  | { kind: "none" }
  | { kind: "expired" }
  | { kind: "valid"; session: SessionData };

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

function password(): string {
  return getEnv().SESSION_SECRET;
}

export function isExpired(session: Pick<SessionData, "issuedAt">, now = Date.now()): boolean {
  return now - session.issuedAt > SESSION_TTL_SECONDS * 1000;
}

function isSessionData(value: unknown): value is SessionData {
  const data = value as Partial<SessionData> | null;
  return (
    typeof data === "object" &&
    data !== null &&
    (data.role === "admin" || data.role === "project") &&
    typeof data.key === "string" &&
    typeof data.issuedAt === "number"
  );
}

// iron-session's ttl rejects a seal older than 12 h (it unseals to {}); issuedAt is the second check.
export async function readSession(cookies: CookieReader, now = Date.now()): Promise<SessionState> {
  const sealed = cookies.get(SESSION_COOKIE)?.value;
  if (!sealed) return { kind: "none" };
  let data: unknown;
  try {
    data = await unsealData(sealed, { password: password(), ttl: SESSION_TTL_SECONDS });
  } catch {
    return { kind: "expired" };
  }
  if (!isSessionData(data)) return { kind: "expired" };
  if (isExpired(data, now)) return { kind: "expired" };
  return { kind: "valid", session: data };
}

export function sealSession(session: SessionData): Promise<string> {
  return sealData(session, { password: password(), ttl: SESSION_TTL_SECONDS });
}

export function isHttps(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return request.nextUrl.protocol === "https:";
}

// No maxAge or expires: a browser-session cookie.
export function cookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    secure: isHttps(request),
  };
}

export async function setSessionCookie(
  response: NextResponse,
  request: NextRequest,
  session: SessionData,
): Promise<void> {
  response.cookies.set(SESSION_COOKIE, await sealSession(session), cookieOptions(request));
}

export function clearSessionCookies(response: NextResponse, request: NextRequest): void {
  const options = { ...cookieOptions(request), maxAge: 0 };
  response.cookies.set(SESSION_COOKIE, "", options);
  response.cookies.set(PKEYS_COOKIE, "", options);
}

export function clearProjectKeysCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set(PKEYS_COOKIE, "", { ...cookieOptions(request), maxAge: 0 });
}

// ---- project keys held for an admin -------------------------------------------------------

function isEntry(value: unknown): value is ProjectKeyEntry {
  const entry = value as Partial<ProjectKeyEntry> | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.projectId === "string" &&
    typeof entry.key === "string" &&
    typeof entry.addedAt === "number"
  );
}

export async function readProjectKeys(cookies: CookieReader): Promise<ProjectKeyEntry[]> {
  const sealed = cookies.get(PKEYS_COOKIE)?.value;
  if (!sealed) return [];
  try {
    const data = (await unsealData(sealed, {
      password: password(),
      ttl: SESSION_TTL_SECONDS,
    })) as { entries?: unknown };
    return Array.isArray(data.entries) ? data.entries.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function findProjectKey(entries: ProjectKeyEntry[], projectId: string): string | undefined {
  return entries.find((entry) => entry.projectId === projectId)?.key;
}

// Replaces the project's entry; keeps the newest MAX_PROJECT_KEYS, dropping the oldest first.
export function withProjectKey(
  entries: ProjectKeyEntry[],
  projectId: string,
  key: string,
  now = Date.now(),
): ProjectKeyEntry[] {
  const others = entries.filter((entry) => entry.projectId !== projectId);
  const next = [...others, { projectId, key, addedAt: now }];
  next.sort((a, b) => a.addedAt - b.addedAt);
  return next.slice(Math.max(0, next.length - MAX_PROJECT_KEYS));
}

// Removes only that id from the entries this request read.
export function withoutProjectKey(
  entries: ProjectKeyEntry[],
  projectId: string,
): ProjectKeyEntry[] {
  return entries.filter((entry) => entry.projectId !== projectId);
}

export async function writeProjectKeys(
  response: NextResponse,
  request: NextRequest,
  entries: ProjectKeyEntry[],
): Promise<void> {
  if (entries.length === 0) {
    clearProjectKeysCookie(response, request);
    return;
  }
  const sealed = await sealData({ entries }, { password: password(), ttl: SESSION_TTL_SECONDS });
  response.cookies.set(PKEYS_COOKIE, sealed, cookieOptions(request));
}
