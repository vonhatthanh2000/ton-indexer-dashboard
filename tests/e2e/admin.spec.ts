import { expect, test } from "@playwright/test";
import { ADMIN_KEY, ALPHA_ID, ALPHA_KEY, CSRF, USDT_FRIENDLY, USDT_RAW, apiSignIn, resetFake, setScenario } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetFake(request);
  await apiSignIn(page, "admin", ADMIN_KEY);
});

test("create project shows the key once, then the list and a toast; duplicates are refused", async ({ page }) => {
  await page.goto("/admin/projects/new");
  await page.getByLabel("Project name").fill("demo");
  await page.getByRole("button", { name: "Create project" }).click();

  const modal = page.getByRole("dialog", { name: "Project API key" });
  await expect(modal).toBeVisible();
  await expect(modal.getByText("This key is shown only once.")).toBeVisible();
  await page.mouse.click(5, 5); // outside
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();

  await modal.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/admin\/projects$/);
  await expect(page.getByText("Project demo created.")).toBeVisible();
  await expect(page.getByRole("link", { name: "demo" })).toBeVisible();

  await page.goto("/admin/projects/new");
  await page.getByLabel("Project name").fill("demo");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText("A project with this name already exists.")).toBeVisible();
});

test("rotating a key shows a new one and the old key stops working", async ({ page, browser }) => {
  await page.goto("/admin/projects");
  await page.getByRole("button", { name: "Actions for alpha" }).click();
  await page.getByRole("menuitem", { name: "Rotate API key" }).click();
  await page.getByRole("dialog", { name: "Rotate API key?" }).getByRole("button", { name: "Rotate API key" }).click();
  const modal = page.getByRole("dialog", { name: "Project API key" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Done" }).click();

  const other = await browser.newContext();
  const login = await other.request.post(new URL("/api/auth/login", page.url()).toString(), {
    headers: CSRF,
    data: { role: "project", key: ALPHA_KEY },
  });
  expect(login.status()).toBe(401);
  expect(await login.json()).toEqual({ error: "invalid_key" });
  await other.close();
});

test("a project without a stored key asks for it; wrong then right key", async ({ page }) => {
  await page.goto(`/admin/projects/${ALPHA_ID}`);
  await expect(page.getByText("Enter this project's API key to manage its addresses.")).toBeVisible();
  const input = page.getByLabel("Project API key");
  await input.fill("y".repeat(43));
  await page.getByRole("button", { name: "Use this key" }).click();
  await expect(page.getByText("That key is not valid.")).toBeVisible();
  await input.fill(ALPHA_KEY);
  await page.getByRole("button", { name: "Use this key" }).click();
  await expect(page.getByRole("table", { name: "Addresses of alpha" })).toBeVisible();
  await expect(page.getByText("Pending start")).toBeVisible();
});

test("an unknown project id shows Project not found", async ({ page }) => {
  await page.goto("/admin/projects/99999999-9999-4999-8999-999999999999");
  await expect(page.getByRole("heading", { name: "Project not found" }).first()).toBeVisible();
});

test.describe("addresses of alpha", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.put(`/api/admin/projects/${ALPHA_ID}/project-key`, { headers: CSRF, data: { key: ALPHA_KEY } });
  });

  test("a server index error highlights the mapped line", async ({ page, request }) => {
    await setScenario(request, {
      registerError: { error: "invalid_request", field: "addresses", index: 1, problem: "is not a valid TON address" },
    });
    await page.goto(`/admin/projects/${ALPHA_ID}`);
    await page.getByRole("button", { name: "Register addresses" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Register addresses" });
    // blank line 2 is dropped, so sent index 1 is textarea line 3
    await drawer.getByLabel("Addresses").fill(`0:${"1".repeat(64)}\n\n0:${"2".repeat(64)}`);
    await drawer.getByRole("button", { name: "Register addresses" }).click();
    await expect(drawer.getByText("Line 3 is not a valid TON address.")).toBeVisible();
  });

  test("EQ… and raw forms of one address are flagged before sending", async ({ page }) => {
    await page.goto(`/admin/projects/${ALPHA_ID}`);
    await page.getByRole("button", { name: "Register addresses" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Register addresses" });
    await drawer.getByLabel("Addresses").fill(`${USDT_FRIENDLY}\n${USDT_RAW}`);
    await drawer.getByRole("button", { name: "Register addresses" }).click();
    await expect(drawer.getByText("Line 2 is a duplicate of line 1.")).toBeVisible();
  });

  test("a successful batch lists the result and the table shows Pending start", async ({ page }) => {
    await page.goto(`/admin/projects/${ALPHA_ID}?register=1`);
    const drawer = page.getByRole("dialog", { name: "Register addresses" });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("Addresses").fill(`0:${"3".repeat(64)}`);
    await drawer.getByRole("button", { name: "Register addresses" }).click();
    await expect(drawer.getByText("1 address registered.")).toBeVisible();
    await expect(drawer.getByText("New source")).toBeVisible();
    await expect(drawer.getByText("History syncing")).toBeVisible();
    await drawer.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Pending start")).toHaveCount(2);
  });

  test("unlink removes the row; a 404 restores it with the error", async ({ page, request }) => {
    await page.goto(`/admin/projects/${ALPHA_ID}`);
    const rows = page.getByRole("table", { name: "Addresses of alpha" }).locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await page.getByRole("button", { name: /^Unlink EQCx/ }).click();
    // The row goes at once (optimistic); wait for the real DELETE before changing the fake's scenario.
    const deleted = page.waitForResponse((response) => response.request().method() === "DELETE");
    await page.getByRole("dialog").getByRole("button", { name: "Unlink address" }).click();
    expect((await deleted).status()).toBe(204);
    await expect(rows).toHaveCount(2);

    await setScenario(request, { unlinkNotLinked: true });
    await page.getByRole("button", { name: /^Unlink / }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Unlink address" }).click();
    await expect(page.getByText("This address is no longer linked. The list was refreshed.")).toBeVisible();
    await expect(rows).toHaveCount(2);
  });
});
