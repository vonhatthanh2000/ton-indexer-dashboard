import { defineConfig, devices } from "@playwright/test";

// E2E runs its own production server on :3110 against the fake ton-observer on :3999,
// so it never collides with `pnpm dev` on :3100. Pages are browsed via localhost so Chrome
// keeps the Secure `__Host-session` cookie on http; the readiness checks use 127.0.0.1.
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3110);
export const E2E_URL = `http://localhost:${E2E_PORT}`;
export const FAKE_PORT = Number(process.env.E2E_FAKE_PORT ?? 3999);
export const FAKE_URL = `http://127.0.0.1:${FAKE_PORT}`;

// E2E_REUSE=1 reuses a fake + server already running on :3999/:3110 (e.g. left by an interrupted run).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: E2E_URL,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: [
    {
      command: "node tests/fake-observer/server.mjs",
      url: `${FAKE_URL}/health/ready`,
      reuseExistingServer: process.env.E2E_REUSE === "1",
      env: { FAKE_OBSERVER_PORT: String(FAKE_PORT) },
    },
    {
      command: `pnpm exec next build && pnpm exec next start -H 127.0.0.1 -p ${E2E_PORT}`,
      url: `http://127.0.0.1:${E2E_PORT}/login`,
      reuseExistingServer: process.env.E2E_REUSE === "1",
      timeout: 240_000,
      env: { OBSERVER_API_URL: FAKE_URL },
    },
  ],
});
