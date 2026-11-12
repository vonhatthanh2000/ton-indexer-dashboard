import { ADMIN_KEY, ALPHA_ID, ALPHA_KEY, CSRF, apiSignIn, expect, resetFake, test } from "./helpers";

// Keyboard alone: Tab, Shift+Tab, Enter, Space, typing. No mouse.
test.beforeEach(async ({ request }) => {
  await resetFake(request);
});

async function tabTo(page: import("@playwright/test").Page, matches: () => Promise<boolean>, max = 40) {
  for (let step = 0; step < max; step += 1) {
    await page.keyboard.press("Tab");
    if (await matches()) return;
  }
  throw new Error("target not reached by Tab");
}

test("sign in with the keyboard", async ({ page }) => {
  await page.goto("/login");
  await tabTo(page, () => page.locator("#key-admin").evaluate((el) => el === document.activeElement));
  await page.keyboard.type(ADMIN_KEY);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin$/);
});

test("the skip link is the first Tab stop", async ({ page }) => {
  await apiSignIn(page, "admin", ADMIN_KEY);
  await page.goto("/admin");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("create a project with the keyboard", async ({ page }) => {
  await apiSignIn(page, "admin", ADMIN_KEY);
  await page.goto("/admin/projects/new");
  await tabTo(page, () => page.getByLabel("Project name").evaluate((el) => el === document.activeElement));
  await page.keyboard.type("keyboard-made");
  await page.keyboard.press("Enter");
  const modal = page.getByRole("dialog", { name: "Project API key" });
  await expect(modal).toBeVisible();
  await tabTo(page, () => modal.getByRole("button", { name: "Done" }).evaluate((el) => el === document.activeElement), 10);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/projects$/);
});

test("register addresses with the keyboard", async ({ page }) => {
  await apiSignIn(page, "admin", ADMIN_KEY);
  await page.request.put(`/api/admin/projects/${ALPHA_ID}/project-key`, { headers: CSRF, data: { key: ALPHA_KEY } });
  await page.goto(`/admin/projects/${ALPHA_ID}`);
  await expect(page.getByRole("table", { name: "Addresses of alpha" })).toBeVisible();
  await tabTo(page, () => page.getByRole("button", { name: "Register addresses" }).evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Register addresses" });
  await expect(drawer).toBeVisible();
  await tabTo(page, () => drawer.getByLabel("Addresses").evaluate((el) => el === document.activeElement), 10);
  await page.keyboard.type(`0:${"4".repeat(64)}`);
  await tabTo(page, () => drawer.getByRole("button", { name: "Register addresses" }).evaluate((el) => el === document.activeElement), 10);
  await page.keyboard.press("Enter");
  await expect(drawer.getByText("1 address registered.")).toBeVisible();
});
