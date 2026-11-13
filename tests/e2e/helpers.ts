import { test, expect, type BrowserContext } from "@playwright/test";
import { E2E_URL } from "../../playwright.config";

const HOST = new URL(E2E_URL).hostname;

/** The fake ton-observer's users: the `__Host-session` cookie value is the user. */
export type FakeUser = "admin" | "owner" | "editor" | "viewer" | "none";

export const ALPHA_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Signs in as a fake user by setting the session cookie the API would set. `domain` + `path`, not
 * `url`: with an http `url` Playwright drops `secure`, and Chrome then rejects the `__Host-` name.
 */
export async function signIn(context: BrowserContext, user: FakeUser) {
  await context.addCookies([{ name: "__Host-session", value: user, domain: HOST, path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
}

export { test, expect };
