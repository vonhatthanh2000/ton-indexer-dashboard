import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { sealData } from "iron-session";
import { E2E_SECRET, FAKE_URL } from "../../playwright.config";

export const ADMIN_KEY = "test-admin-key";
export const ALPHA_ID = "11111111-1111-4111-8111-111111111111";
export const ALPHA_KEY = "alphaKey_0123456789-ABCDEFGHIJKLMNOPQRSTUVW";
export const EMPTY_KEY = "emptyKey_0123456789-ABCDEFGHIJKLMNOPQRSTUVW";
export const USDT_RAW = "0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE";
export const USDT_FRIENDLY = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
export const CSRF = { "x-requested-with": "dashboard" };

export interface FakeCall {
  method: string;
  path: string;
  search: string;
  adminKey: boolean;
  apiKey: boolean;
  body: unknown;
}

export async function resetFake(request: APIRequestContext) {
  await request.post(`${FAKE_URL}/__reset`);
}

export async function setScenario(request: APIRequestContext, scenario: Record<string, unknown>) {
  await request.post(`${FAKE_URL}/__scenario`, { data: scenario });
}

export async function fakeCalls(request: APIRequestContext): Promise<FakeCall[]> {
  return (await request.get(`${FAKE_URL}/__calls`)).json();
}

export async function clearCalls(request: APIRequestContext) {
  await request.delete(`${FAKE_URL}/__calls`);
}

/** Signs in through the API; the context keeps the cookie. */
export async function apiSignIn(page: Page, role: "admin" | "project", key: string) {
  const response = await page.request.post("/api/auth/login", { headers: CSRF, data: { role, key } });
  expect(response.status()).toBe(200);
}

export async function uiSignIn(page: Page, role: "admin" | "project", key: string) {
  await page.goto("/login");
  if (role === "project") await page.getByRole("tab", { name: "Project key" }).click();
  await page.locator(`#key-${role}`).fill(key);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** A sealed session cookie with a chosen issuedAt, the way the server makes it. */
export async function addSealedSession(context: BrowserContext, baseURL: string, data: Record<string, unknown>) {
  const value = await sealData(data, { password: E2E_SECRET, ttl: 12 * 3600 });
  await context.addCookies([{ name: "tonobs_session", value, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
}

// Upstream paths the proxy may call (PLAN.md Decisions › Proxy allowlist).
const ALLOWED_UPSTREAM = [
  /^GET \/health\/ready$/,
  /^(GET|POST) \/projects$/,
  /^POST \/projects\/[0-9a-f-]{36}\/api-key$/,
  /^(GET|POST) \/projects\/[0-9a-f-]{36}\/addresses$/,
  /^DELETE \/projects\/[0-9a-f-]{36}\/addresses\/[^/]+$/,
  /^POST \/graphql$/,
];
const SECRET_KEYS = [ADMIN_KEY, ALPHA_KEY, EMPTY_KEY];
const ISSUED_KEY = /issued\d{2}_x+/;

/**
 * Every test gets these checks for free:
 * no /api reply body carries a key (except create/rotate), every /api reply is no-store,
 * and ton-observer was only called on allowlisted paths.
 */
export const test = base.extend<{ apiGuard: void }>({
  apiGuard: [
    async ({ page, request }, use) => {
      const problems: string[] = [];
      const pending: Promise<void>[] = [];
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (!url.pathname.startsWith("/api/")) return;
        const method = response.request().method();
        if (response.headers()["cache-control"] !== "no-store") problems.push(`no-store missing: ${method} ${url.pathname}`);
        const issuesKey = method === "POST" && (url.pathname === "/api/admin/projects" || url.pathname.endsWith("/api-key"));
        if (!(response.headers()["content-type"] ?? "").includes("application/json")) return;
        // A body Playwright can no longer read (page navigated) resolves to "" after 2 s instead of hanging.
        const body = Promise.race([response.text(), new Promise<string>((resolve) => setTimeout(() => resolve(""), 2000))]);
        pending.push(
          body
            .then((body) => {
              const leaked = SECRET_KEYS.some((key) => body.includes(key)) || (!issuesKey && ISSUED_KEY.test(body));
              if (leaked) problems.push(`key in body: ${method} ${url.pathname}`);
            })
            .catch(() => {}),
        );
      });
      await use();
      await Promise.all(pending);
      for (const call of await fakeCalls(request)) {
        const line = `${call.method} ${call.path}`;
        if (!ALLOWED_UPSTREAM.some((pattern) => pattern.test(line))) problems.push(`upstream call outside allowlist: ${line}`);
      }
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
