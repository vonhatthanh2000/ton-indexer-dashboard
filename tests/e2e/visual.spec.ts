import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { ADMIN_KEY, ALPHA_ID, ALPHA_KEY, CSRF, apiSignIn, resetFake } from "./helpers";

const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const THEMES = ["light", "dark"] as const;

const ROUTES: { role: "none" | "admin" | "project"; path: string; name: string }[] = [
  { role: "none", path: "/login", name: "login" },
  { role: "admin", path: "/admin", name: "admin-dashboard" },
  { role: "admin", path: "/admin/projects", name: "admin-projects" },
  { role: "admin", path: "/admin/projects/new", name: "admin-new" },
  { role: "admin", path: `/admin/projects/${ALPHA_ID}`, name: "admin-project" },
  { role: "admin", path: "/admin/settings", name: "admin-settings" },
  { role: "project", path: "/project", name: "pm-dashboard" },
  { role: "project", path: "/project/addresses", name: "pm-addresses" },
  { role: "project", path: "/project/transactions", name: "pm-transactions" },
  { role: "project", path: "/project/settings", name: "pm-settings" },
];

mkdirSync("shots/html", { recursive: true });

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 10_000 });
}

for (const route of ROUTES) {
  test(`${route.name}: no sideways scroll, no serious axe findings, screenshots`, async ({ page, request }) => {
    test.setTimeout(90_000);
    await resetFake(request);
    if (route.role === "admin") {
      await apiSignIn(page, "admin", ADMIN_KEY);
      await page.request.put(`/api/admin/projects/${ALPHA_ID}/project-key`, { headers: CSRF, data: { key: ALPHA_KEY } });
    }
    if (route.role === "project") await apiSignIn(page, "project", ALPHA_KEY);

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
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route.name} ${size.width} ${theme} sideways scroll`).toBeLessThanOrEqual(0);
        const tag = `${route.name}-${size.width}-${theme}`;
        await page.screenshot({ path: `shots/${tag}.png`, fullPage: true });
        if (size.width === 1440 && theme === "light") writeFileSync(`shots/html/${route.name}.html`, await page.content());
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const serious = axe.violations
          .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
          .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
        expect(serious, `${tag} axe`).toEqual([]);
      }
    }
  });
}
