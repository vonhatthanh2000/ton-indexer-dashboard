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
  { path: `${PROJECT}/settings`, name: "project-settings", users: ["owner"] },
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
