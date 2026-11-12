import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as listAddresses } from "@/app/api/admin/projects/[id]/addresses/route";
import { PUT as putProjectKey } from "@/app/api/admin/projects/[id]/project-key/route";
import { GET as listProjects } from "@/app/api/admin/projects/route";
import { POST as graphql } from "@/app/api/graphql/route";
import {
  PKEYS_COOKIE,
  SESSION_COOKIE,
  cookieOptions,
  readProjectKeys,
  sealSession,
  withProjectKey,
} from "@/server/session";
import { sealData } from "iron-session";
import { callUpstream } from "@/server/upstream";

const BASE = "http://127.0.0.1:3100";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const KEY_A = "a".repeat(43);
const KEY_B = "b".repeat(43);
const CSRF = { "x-requested-with": "dashboard" };

afterEach(() => vi.unstubAllGlobals());

async function cookieHeader(extra: Record<string, string> = {}, role: "admin" | "project" = "admin") {
  const session = await sealSession({ role, key: role === "admin" ? "admin-key" : KEY_A, issuedAt: Date.now() });
  return Object.entries({ [SESSION_COOKIE]: session, ...extra })
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function sealedKeys(entries: [string, string][]) {
  let list = withProjectKey([], entries[0][0], entries[0][1], 1);
  for (const [index, [id, key]] of entries.slice(1).entries()) list = withProjectKey(list, id, key, index + 2);
  return sealData({ entries: list }, { password: process.env.SESSION_SECRET!, ttl: 43200 });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function cleared(response: Response, name: string): boolean {
  return setCookies(response).some((cookie) => cookie.startsWith(`${name}=;`) && /Max-Age=0/i.test(cookie));
}

function req(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest(`${BASE}${path}`, init);
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

describe("admin-key 401", () => {
  it("ends the session and clears both cookies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "invalid_admin_key" }, { status: 401 })));
    const reply = await listProjects(req("/api/admin/projects", { headers: { cookie: await cookieHeader() } }), {});
    expect(reply.status).toBe(401);
    expect(await reply.json()).toEqual({ error: "session_expired" });
    expect(cleared(reply, SESSION_COOKIE)).toBe(true);
    expect(cleared(reply, PKEYS_COOKIE)).toBe(true);
  });
});

describe("project-key 401 from an admin route", () => {
  it("drops only that project's key and answers project_key_invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "invalid_api_key" }, { status: 401 })));
    const pkeys = await sealedKeys([
      [A, KEY_A],
      [B, KEY_B],
    ]);
    const reply = await listAddresses(
      req(`/api/admin/projects/${A}/addresses`, { headers: { cookie: await cookieHeader({ [PKEYS_COOKIE]: pkeys }) } }),
      params({ id: A }),
    );
    expect(reply.status).toBe(401);
    expect(await reply.json()).toEqual({ error: "project_key_invalid" });
    const written = setCookies(reply).find((cookie) => cookie.startsWith(`${PKEYS_COOKIE}=`))!;
    const value = written.split(";")[0].slice(PKEYS_COOKIE.length + 1);
    const left = await readProjectKeys({ get: () => ({ value }) });
    expect(left.map((entry) => entry.projectId)).toEqual([B]);
  });

  it("answers project_key_invalid without calling upstream when no key is stored", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const reply = await listAddresses(req(`/api/admin/projects/${A}/addresses`, { headers: { cookie: await cookieHeader() } }), params({ id: A }));
    expect(await reply.json()).toEqual({ error: "project_key_invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("graphql", () => {
  it("UNAUTHENTICATED inside a 200 ends the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: null, errors: [{ message: "x", extensions: { code: "UNAUTHENTICATED" } }] })),
    );
    const reply = await graphql(
      req("/api/graphql", {
        method: "POST",
        headers: { ...CSRF, cookie: await cookieHeader({}, "project") },
        body: JSON.stringify({ query: "{ project { id } }" }),
      }),
      {},
    );
    expect(reply.status).toBe(401);
    expect(await reply.json()).toEqual({ error: "session_expired" });
    expect(cleared(reply, SESSION_COOKIE)).toBe(true);
  });

  it("passes other errors through with their status", async () => {
    const body = { data: null, errors: [{ message: "address: is not linked", extensions: { code: "FORBIDDEN" } }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    const reply = await graphql(
      req("/api/graphql", {
        method: "POST",
        headers: { ...CSRF, cookie: await cookieHeader({}, "project") },
        body: JSON.stringify({ query: "{ x }" }),
      }),
      {},
    );
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual(body);
  });
});

describe("PUT project-key", () => {
  it("passes a 400 through and stores nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "invalid_project_id" }, { status: 400 })));
    const reply = await putProjectKey(
      req(`/api/admin/projects/${A}/project-key`, {
        method: "PUT",
        headers: { ...CSRF, cookie: await cookieHeader() },
        body: JSON.stringify({ key: KEY_A }),
      }),
      params({ id: A }),
    );
    expect(reply.status).toBe(400);
    expect(setCookies(reply).some((cookie) => cookie.startsWith(`${PKEYS_COOKIE}=`))).toBe(false);
  });

  it("a wrong key answers invalid_key and stores nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "invalid_api_key" }, { status: 401 })));
    const reply = await putProjectKey(
      req(`/api/admin/projects/${A}/project-key`, {
        method: "PUT",
        headers: { ...CSRF, cookie: await cookieHeader() },
        body: JSON.stringify({ key: KEY_A }),
      }),
      params({ id: A }),
    );
    expect(await reply.json()).toEqual({ error: "invalid_key" });
    expect(setCookies(reply)).toEqual([]);
  });
});

describe("login", () => {
  it("passes admin_disabled through", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "admin_disabled" }, { status: 503 })));
    const reply = await login(
      req("/api/auth/login", { method: "POST", headers: CSRF, body: JSON.stringify({ role: "admin", key: "admin-key" }) }),
      {},
    );
    expect(reply.status).toBe(503);
    expect(await reply.json()).toEqual({ error: "admin_disabled" });
  });
});

describe("upstream details", () => {
  it("maps a non-JSON body to 502 api_unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    await expect(callUpstream("GET", "/projects", {})).rejects.toMatchObject({ status: 502, code: "api_unreachable" });
  });
  it("maps a timeout while reading the body to 504", async () => {
    const response = new Response("x");
    vi.spyOn(response, "text").mockRejectedValue(new DOMException("t", "TimeoutError"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(callUpstream("GET", "/projects", {})).rejects.toMatchObject({ status: 504, code: "api_timeout" });
  });
  it("sets Secure only on https", () => {
    expect(cookieOptions(req("/x")).secure).toBe(false);
    expect(cookieOptions(new NextRequest("https://dash.example/x")).secure).toBe(true);
    expect(cookieOptions(req("/x", { headers: { "x-forwarded-proto": "https" } })).secure).toBe(true);
  });
});
