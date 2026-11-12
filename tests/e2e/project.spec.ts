import { FAKE_URL } from "../../playwright.config";
import { ALPHA_KEY, EMPTY_KEY, USDT_FRIENDLY, USDT_RAW, apiSignIn, resetFake, setScenario, expect, test } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetFake(request);
});

test("a PM sees only their project, and the feed is one request of at most 10 rows", async ({ page }) => {
  const graphql: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/graphql")) graphql.push(request.postData() ?? "");
  });
  await apiSignIn(page, "project", ALPHA_KEY);
  await page.goto("/project");
  await expect(page.getByLabel("Project").getByText("alpha")).toBeVisible();
  const feed = page.getByRole("table", { name: "Latest transactions" });
  await expect(feed).toBeVisible();
  await expect(feed.locator("tbody tr")).toHaveCount(10);
  const times = await feed.locator("tbody time").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime")!));
  expect(times).toEqual([...times].sort().reverse());
  expect(graphql.filter((body) => body.includes("DashboardFeed"))).toHaveLength(1);
  await expect(page.getByText("empty-project")).toHaveCount(0);
  await expect(page.getByLabel("Tracked addresses")).toContainText("3");
});

test("with no addresses there is no feed request and an empty state", async ({ page }) => {
  const graphql: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/graphql")) graphql.push(request.postData() ?? "");
  });
  await apiSignIn(page, "project", EMPTY_KEY);
  await page.goto("/project");
  await expect(page.getByText("Ask your admin to register them.")).toBeVisible();
  expect(graphql.filter((body) => body.includes("DashboardFeed"))).toHaveLength(0);
});

test("Load older transactions pages with beforeLt and stops after a short page", async ({ page }) => {
  const bodies: { beforeLt?: string | null }[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/graphql") && request.postData()?.includes("DashboardTransactions")) {
      bodies.push(JSON.parse(request.postData()!).variables);
    }
  });
  await apiSignIn(page, "project", ALPHA_KEY);
  await page.goto(`/project/transactions?address=${USDT_FRIENDLY}`);
  const rows = page.locator("table.data-table > tbody > tr");
  await expect(rows).toHaveCount(20);
  const more = page.getByRole("button", { name: "Load older transactions" });
  await more.click();
  await expect(rows).toHaveCount(40);
  await more.click();
  await expect(rows).toHaveCount(45);
  await expect(page.getByText("No older transactions.")).toBeVisible();
  await expect(more).toHaveCount(0);
  const state = await (await page.request.get(`${FAKE_URL}/__state`)).json();
  const fixture: { lt: string }[] = state.transactions[USDT_RAW];
  expect(bodies[0].beforeLt ?? null).toBeNull();
  expect(bodies[1].beforeLt).toBe(fixture[19].lt);
  expect(bodies[2].beforeLt).toBe(fixture[39].lt);
});

test("addresses show as EQ… with tonviewer links; hashes link by hex", async ({ page }) => {
  await apiSignIn(page, "project", ALPHA_KEY);
  await page.goto(`/project/transactions?address=${USDT_FRIENDLY}`);
  await expect(page.getByText("Showing")).toBeVisible();
  const addressLink = page.getByRole("link", { name: "Open address in Tonviewer (new tab)" }).first();
  await expect(addressLink).toHaveAttribute("href", `https://tonviewer.com/${USDT_FRIENDLY}`);
  const txLink = page.getByRole("link", { name: "Open transaction in Tonviewer (new tab)" }).first();
  await expect(txLink).toHaveAttribute("href", /^https:\/\/tonviewer\.com\/transaction\/[0-9a-f]{64}$/);
  await expect(page.getByText(`${USDT_FRIENDLY.slice(0, 4)}…${USDT_FRIENDLY.slice(-4)}`).first()).toBeVisible();
});

test("a FORBIDDEN feed refetches the project and retries once", async ({ page, request }) => {
  const operations: string[] = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/api/graphql")) operations.push(/query (\w+)/.exec(req.postData() ?? "")?.[1] ?? "?");
  });
  await setScenario(request, { forbiddenFeedOnce: true });
  await apiSignIn(page, "project", ALPHA_KEY);
  await page.goto("/project");
  await expect(page.getByRole("table", { name: "Latest transactions" }).locator("tbody tr")).toHaveCount(10);
  const feedCalls = operations.filter((name) => name === "DashboardFeed").length;
  expect(feedCalls).toBeGreaterThanOrEqual(2);
  expect(operations.indexOf("DashboardProject", operations.indexOf("DashboardFeed"))).toBeGreaterThan(-1);
});

test("an address that is not linked shows the inline error on Transactions", async ({ page }) => {
  await apiSignIn(page, "project", ALPHA_KEY);
  await page.goto(`/project/transactions?address=${encodeURIComponent("0:" + "9".repeat(64))}`);
  await expect(page.getByRole("alert").filter({ hasText: "This address is not linked to your project." })).toBeVisible();
});

test("text uses Manrope; addresses, hashes and lt use JetBrains Mono", async ({ page }) => {
  await apiSignIn(page, "project", ALPHA_KEY);
  await page.goto(`/project/transactions?address=${USDT_FRIENDLY}`);
  await expect(page.locator("table.data-table")).toBeVisible();
  const family = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await family("h1")).toMatch(/Manrope/);
  expect(await family("td")).toMatch(/Manrope/);
  for (const selector of ["[aria-label^='Address ']", "[aria-label^='Transaction hash ']"]) {
    expect(await family(selector), selector).toMatch(/JetBrains Mono/);
  }
  await page.getByRole("button", { name: "Show details" }).first().click();
  expect(await family("[title='Logical time']")).toMatch(/JetBrains Mono/);
});
