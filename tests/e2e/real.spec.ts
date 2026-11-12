import { expect, test } from "@playwright/test";

// Run on demand against a real local ton-observer: see README "Real smoke test".
// Needs REAL_ADMIN_KEY (the server's ADMIN_API_KEY) and a dashboard running on REAL_DASHBOARD_URL.
const adminKey = process.env.REAL_ADMIN_KEY;

test("@real admin creates a project, registers an address, the PM sees it", async ({ page, browser }) => {
  test.skip(!adminKey, "REAL_ADMIN_KEY is not set");
  const name = `smoke-${Date.now()}`;
  const address = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

  await page.goto("/login");
  await page.locator("#key-admin").fill(adminKey!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/admin/projects/new");
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  const modal = page.getByRole("dialog", { name: "Project API key" });
  const projectKey = (await modal.locator(".mono-box span").first().textContent())!.trim();
  await modal.getByRole("button", { name: "Register addresses now" }).click();

  const drawer = page.getByRole("dialog", { name: "Register addresses" });
  await drawer.getByLabel("Addresses").fill(address);
  await drawer.getByRole("button", { name: "Register addresses" }).click();
  await expect(drawer.getByText("1 address registered.")).toBeVisible();
  await drawer.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Pending start")).toBeVisible();

  const pm = await browser.newPage();
  await pm.goto(new URL("/login", page.url()).toString());
  await pm.getByRole("tab", { name: "Project key" }).click();
  await pm.locator("#key-project").fill(projectKey);
  await pm.getByRole("button", { name: "Sign in" }).click();
  await pm.goto(new URL("/project/addresses", page.url()).toString());
  await expect(pm.getByRole("table", { name: "Tracked addresses" }).locator("tbody tr")).toHaveCount(1);
  await pm.close();
});
