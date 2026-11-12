import { expect, test } from "@playwright/test";
import {
  ADMIN_KEY,
  ALPHA_ID,
  ALPHA_KEY,
  CSRF,
  addSealedSession,
  apiSignIn,
  clearCalls,
  fakeCalls,
  resetFake,
  setScenario,
  uiSignIn,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetFake(request);
});

test("a wrong admin or project key shows the error and sets no cookie", async ({ page, context }) => {
  await uiSignIn(page, "admin", "not-the-admin-key");
  await expect(page.locator(".field-error[role=alert]")).toHaveText("That key is not valid.");
  await uiSignIn(page, "project", "x".repeat(43));
  await expect(page.locator(".field-error[role=alert]")).toHaveText("That key is not valid.");
  expect((await context.cookies()).filter((cookie) => cookie.name.startsWith("tonobs_"))).toEqual([]);
});

test("a malformed key is rejected without calling ton-observer", async ({ page, request }) => {
  await page.goto("/login");
  await clearCalls(request);
  for (const key of ["too-short", "bad\nkey"]) {
    const response = await page.request.post("/api/auth/login", { headers: CSRF, data: { role: "project", key } });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_key" });
  }
  expect(await fakeCalls(request)).toEqual([]);
});

test("admin sign-in sets a strict httpOnly session cookie and never returns the key", async ({ page, context }) => {
  const bodies: string[] = [];
  page.on("response", async (response) => {
    if (!response.url().includes("/api/")) return;
    const text = await response.text().catch(() => "");
    bodies.push(text);
  });
  await uiSignIn(page, "admin", ADMIN_KEY);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/admin/projects");
  await expect(page.getByRole("link", { name: "alpha" })).toBeVisible();

  expect(await page.evaluate(() => document.cookie)).not.toContain("tonobs_");
  const session = (await context.cookies()).find((cookie) => cookie.name === "tonobs_session")!;
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe("Strict");
  expect(session.expires).toBe(-1); // browser-session cookie
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) expect(body).not.toContain(ADMIN_KEY);
});

test("signing in as a project after an admin session leaves no project-key cookie", async ({ page, context }) => {
  await apiSignIn(page, "admin", ADMIN_KEY);
  await page.request.put(`/api/admin/projects/${ALPHA_ID}/project-key`, { headers: CSRF, data: { key: ALPHA_KEY } });
  expect((await context.cookies()).some((cookie) => cookie.name === "tonobs_pkeys")).toBe(true);
  await apiSignIn(page, "project", ALPHA_KEY);
  expect((await context.cookies()).some((cookie) => cookie.name === "tonobs_pkeys")).toBe(false);
});

test("a 13 h old session is expired everywhere except health and auth", async ({ page, context, baseURL }) => {
  await addSealedSession(context, baseURL!, { role: "admin", key: ADMIN_KEY, issuedAt: Date.now() - 13 * 3600_000 });
  for (const path of ["/api/admin/projects", `/api/admin/projects/${ALPHA_ID}/addresses`]) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "session_expired" });
    await addSealedSession(context, baseURL!, { role: "admin", key: ADMIN_KEY, issuedAt: Date.now() - 13 * 3600_000 });
  }
  expect((await page.request.get("/api/health")).status()).toBe(200);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?reason=expired&next=%2Fadmin$/);
  await expect(page.getByRole("status").filter({ hasText: "Your session ended" })).toBeVisible();
});

test("without a session a workspace page sends you to login and back", async ({ page }) => {
  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fprojects$/);
  await page.locator("#key-admin").fill(ADMIN_KEY);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/projects$/);
});

test("a project session sees No access on /admin and 403 on admin routes", async ({ page }) => {
  await apiSignIn(page, "project", ALPHA_KEY);
  await page.goto("/admin");
  await expect(page.getByText("No access")).toBeVisible();
  const response = await page.request.post("/api/admin/projects", { headers: CSRF, data: { name: "x" } });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "wrong_role" });
});

test("proxy rules: CSRF, body cap, JSON 404, bad ids", async ({ page, request }) => {
  await apiSignIn(page, "admin", ADMIN_KEY);
  await clearCalls(request);
  const noCsrf = await page.request.post("/api/admin/projects", { data: { name: "x" } });
  expect(noCsrf.status()).toBe(403);
  expect(await noCsrf.json()).toEqual({ error: "csrf" });
  const loginNoCsrf = await page.request.post("/api/auth/login", { data: { role: "admin", key: ADMIN_KEY } });
  expect(await loginNoCsrf.json()).toEqual({ error: "csrf" });

  const big = await page.request.post(`/api/admin/projects/${ALPHA_ID}/addresses`, {
    headers: CSRF,
    data: { addresses: ["a".repeat(65 * 1024)], startLt: "now" },
  });
  expect(big.status()).toBe(413);

  const unknown = await page.request.get("/api/anything-else");
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toEqual({ error: "not_found" });

  const badId = await page.request.delete("/api/admin/projects/not-a-uuid/addresses/x", { headers: CSRF });
  expect(badId.status()).toBe(400);
  expect(await fakeCalls(request)).toEqual([]);
});

test("the top bar shows the API state", async ({ page, request }) => {
  await apiSignIn(page, "admin", ADMIN_KEY);
  await page.goto("/admin");
  await expect(page.getByRole("status").filter({ hasText: "API online" })).toBeVisible();
  await setScenario(request, { health: "down" });
  expect((await page.request.get("/api/health")).status()).toBe(502);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "API unreachable" })).toBeVisible();
  await setScenario(request, { health: "db_down" });
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Database unreachable" })).toBeVisible();
});
