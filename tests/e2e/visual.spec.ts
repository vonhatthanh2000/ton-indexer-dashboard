import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { ALPHA_ID, expect, signIn, test, type FakeUser } from "./helpers";

const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const THEMES = ["light", "dark"] as const;
const PROJECT = `/projects/${ALPHA_ID}`;

// PLAN.md Task 17: every route with the users it is shot for.
const ROUTES: { path: string; name: string; users: FakeUser[] }[] = [
  { path: "/login", name: "login", users: ["none"] },
  { path: "/login?error=not_invited", name: "login-not-invited", users: ["none"] },
  { path: "/", name: "home", users: ["owner", "none"] },
  { path: PROJECT, name: "project-dashboard", users: ["owner"] },
  { path: `${PROJECT}/addresses`, name: "project-addresses", users: ["owner", "viewer"] },
  { path: `${PROJECT}/transactions`, name: "project-transactions", users: ["viewer"] },
  { path: `${PROJECT}/members`, name: "project-members", users: ["owner", "viewer", "admin"] },
  { path: `${PROJECT}/settings`, name: "project-settings", users: ["owner", "admin"] },
  { path: "/admin", name: "admin", users: ["admin"] },
  { path: "/admin/users", name: "admin-users", users: ["admin"] },
  { path: "/account", name: "account", users: ["editor"] },
];

mkdirSync("shots/html", { recursive: true });

// Not "networkidle": Next keeps a connection open on app pages, so it never settles.
async function settle(page: Page) {
  await page.waitForLoadState("load");
  await expect(page.locator("main#main")).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 10_000 });
  await page.evaluate(() => document.fonts.ready);
}

for (const route of ROUTES) {
  for (const user of route.users) {
    // "/login" is shot signed out: the proxy sends a signed-in visitor on to "/".
    const signedIn = !route.path.startsWith("/login");
    const name = `${route.name}-${user}`;
    test(`${name}: no sideways scroll, no serious axe findings, screenshots`, async ({ page, context }) => {
      test.setTimeout(90_000);
      if (signedIn) await signIn(context, user);
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const theme of THEMES) {
        await page.addInitScript((value) => {
          try {
            localStorage.setItem("tonobs.theme", value);
          } catch {}
        }, theme);
        for (const size of WIDTHS) {
          await page.setViewportSize(size);
          await page.goto(route.path);
          await settle(page);
          expect(new URL(page.url()).pathname, `${name} stayed on its route`).toBe(route.path.split("?")[0]);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${name} ${size.width} ${theme} sideways scroll`).toBeLessThanOrEqual(0);
          const tag = `${name}-${size.width}-${theme}`;
          await page.screenshot({ path: `shots/${tag}.png`, fullPage: true });
          if (size.width === 1440 && theme === "light") writeFileSync(`shots/html/${name}.html`, await page.content());
          const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
          const serious = axe.violations
            .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
            .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
          expect(serious, `${tag} axe`).toEqual([]);
        }
      }
    });
  }
}

// The register dialog: centered, wide, with a file drop zone (normal, drag-over, after a CSV import).
test("register-dialog-owner: centered dialog, drop zone, CSV import, no serious axe findings", async ({ page, context }) => {
  test.setTimeout(90_000);
  await signIn(context, "owner");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of THEMES) {
    await page.addInitScript((value) => {
      try {
        localStorage.setItem("tonobs.theme", value);
      } catch {}
    }, theme);
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await page.goto(`${PROJECT}/addresses`);
      await settle(page);
      await page.getByRole("button", { name: "Register addresses" }).first().click();
      const dialog = page.getByRole("dialog", { name: "Register addresses" });
      await expect(dialog).toBeVisible();
      const box = (await dialog.boundingBox())!;
      // Centered horizontally, not docked to the right edge.
      expect(Math.abs(box.x + box.width / 2 - size.width / 2), `${size.width} dialog centered`).toBeLessThanOrEqual(2);
      const tag = `register-dialog-owner-${size.width}-${theme}`;
      await page.screenshot({ path: `shots/${tag}.png` });

      await page.getByTestId("register-dropzone").evaluate((zone) => {
        const data = new DataTransfer();
        data.items.add(new File(["address\n"], "list.csv", { type: "text/csv" }));
        zone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: data }));
      });
      await expect(dialog.getByText("Drop a .csv or .json file to add its addresses")).toBeVisible();
      await page.screenshot({ path: `shots/${tag}-dragging.png` });
      await expectNoSeriousAxe(page, `${tag}-dragging`);
      await page.getByTestId("register-dropzone").evaluate((zone) => {
        const data = new DataTransfer();
        data.items.add(new File(["address\n"], "list.csv", { type: "text/csv" }));
        zone.dispatchEvent(new DragEvent("dragleave", { bubbles: true, dataTransfer: data }));
      });

      const raw = `0:${"AB".repeat(32)}`;
      await page.getByTestId("register-file").setInputFiles({ name: "list.csv", mimeType: "text/csv", buffer: Buffer.from(`address,label\n${raw},main\n`) });
      await expect(dialog.getByRole("textbox", { name: "Addresses" })).toHaveValue(raw);
      await page.screenshot({ path: `shots/${tag}-imported.png` });
      if (size.width === 1440 && theme === "light") writeFileSync("shots/html/register-dialog-owner.html", await page.content());
      await expect(dialog.getByText("Drop a .csv or .json file to add its addresses")).toHaveCount(0);
      await expectNoSeriousAxe(page, tag);
    }
  }
});

async function expectNoSeriousAxe(page: Page, tag: string) {
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = axe.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(serious, `${tag} axe`).toEqual([]);
}

// Admin rename and delete dialogs, opened from the /admin table's row menu.
test("admin-project-dialogs-admin: rename and delete dialogs, no serious axe findings", async ({ page, context }) => {
  test.setTimeout(90_000);
  await signIn(context, "admin");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const size of WIDTHS) {
    await page.setViewportSize(size);
    await page.goto("/admin");
    await settle(page);
    for (const action of ["Rename", "Delete"] as const) {
      await page.getByRole("button", { name: /^Actions for / }).first().click();
      await page.getByRole("menuitem", { name: action }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      if (action === "Delete") await expect(dialog.getByRole("button", { name: "Delete project" })).toBeDisabled();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${action} ${size.width} sideways scroll`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `shots/admin-${action.toLowerCase()}-dialog-${size.width}-light.png` });
      if (size.width === 1440) writeFileSync(`shots/html/admin-${action.toLowerCase()}-dialog.html`, await page.content());
      await expectNoSeriousAxe(page, `admin-${action.toLowerCase()}-dialog-${size.width}`);
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
    }
  }
});
