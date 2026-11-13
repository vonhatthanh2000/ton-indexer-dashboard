import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const BASE = "http://localhost:3100";
const SESSION = "__Host-session=s1";

function run(path: string, cookie?: string) {
  return proxy(new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie } : {} }));
}

function location(response: Response): string | null {
  const value = response.headers.get("location");
  return value === null ? null : value.replace(BASE, "");
}

// NextResponse.next({ request: { headers } }) carries the new request headers this way.
function requestHeader(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

describe("proxy", () => {
  it("matches the workspace and /login, never /auth or /api", () => {
    expect(config.matcher).toEqual(["/", "/login", "/projects/:path*", "/admin/:path*", "/account"]);
  });
  it("no cookie on /projects/abc → 307 to /login?next=%2Fprojects%2Fabc", () => {
    const response = run("/projects/abc");
    expect(response.status).toBe(307);
    expect(location(response)).toBe("/login?next=%2Fprojects%2Fabc");
  });
  it("no cookie keeps the query in next", () => {
    expect(location(run("/projects/abc/transactions?address=EQ"))).toBe(
      "/login?next=%2Fprojects%2Fabc%2Ftransactions%3Faddress%3DEQ",
    );
  });
  it("a cookie on /login → redirect to /", () => {
    const response = run("/login", SESSION);
    expect(response.status).toBe(307);
    expect(location(response)).toBe("/");
  });
  it("a cookie on /login?reason=expired → let through, and __Host-session is cleared", () => {
    const response = run("/login?reason=expired&next=%2F", SESSION);
    expect(response.status).toBe(200);
    expect(location(response)).toBeNull();
    expect(response.headers.getSetCookie()).toContain("__Host-session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0");
  });
  it("a cookie on /login?error=… → let through, cleared too", () => {
    const response = run("/login?error=not_invited", SESSION);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith("__Host-session=;"))).toBe(true);
  });
  it("/login?reason=expired without a cookie sets no cookie", () => {
    expect(run("/login?reason=expired").headers.getSetCookie()).toEqual([]);
  });
  it("/login without a cookie → let through", () => {
    expect(run("/login").status).toBe(200);
  });
  it.each([undefined, SESSION])("/?login_error=not_invited (cookie: %s) → /login?error=not_invited", (cookie) => {
    const response = run("/?login_error=not_invited", cookie);
    expect(response.status).toBe(307);
    expect(location(response)).toBe("/login?error=not_invited");
  });
  it("a request carrying tonobs_session → the response clears it (and tonobs_pkeys)", () => {
    const response = run("/projects/abc", `${SESSION}; tonobs_session=old; tonobs_pkeys=old`);
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((cookie) => cookie.startsWith("tonobs_session=;") && cookie.includes("Max-Age=0"))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith("tonobs_pkeys=;") && cookie.includes("Max-Age=0"))).toBe(true);
  });
  it("clears tonobs_session on /login too", () => {
    expect(run("/login", "tonobs_session=old").headers.getSetCookie()[0]).toMatch(/^tonobs_session=;/);
  });
  it("workspace requests get the x-dashboard-path header", () => {
    const response = run("/projects/abc/members?x=1", SESSION);
    expect(response.status).toBe(200);
    expect(requestHeader(response, "x-dashboard-path")).toBe("/projects/abc/members?x=1");
    expect(requestHeader(run("/", SESSION), "x-dashboard-path")).toBe("/");
  });
  it("a workspace request with the cookie sets no cookies", () => {
    expect(run("/admin", SESSION).headers.getSetCookie()).toEqual([]);
  });
});
