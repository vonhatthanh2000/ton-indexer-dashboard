// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Login, afterLoginPath } from "@/features/auth/login";
import { EXPIRED_TEXT, loginNotice } from "@/features/auth/login-notice";
import { configureClient, resetClient } from "@/lib/client";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetClient();
});

describe("loginNotice", () => {
  it("shows the expiry note for reason=expired", () => {
    expect(loginNotice("expired", null)).toEqual({ tone: "warn", text: EXPIRED_TEXT });
  });
  it.each([
    ["not_invited", "No account for this email. Ask an admin to invite you."],
    ["google_cancelled", "Google sign-in was cancelled."],
    ["bad_state", "Google sign-in didn't complete. Try again."],
    ["google_failed", "Google sign-in didn't complete. Try again."],
    ["login_disabled", "Sign-in isn't configured on this server."],
    ["google_login_disabled", "Sign-in isn't configured on this server."],
  ])("error=%s → its line", (code, text) => {
    expect(loginNotice(null, code)).toEqual({ tone: "err", text });
  });
  it("error wins over reason; nothing for a plain /login", () => {
    expect(loginNotice("expired", "not_invited")?.tone).toBe("err");
    expect(loginNotice(null, null)).toBeNull();
    expect(loginNotice("other", "")).toBeNull();
  });
});

describe("afterLoginPath", () => {
  it("keeps a safe next and falls back to /", () => {
    expect(afterLoginPath("/projects/p1/addresses?offset=100")).toBe("/projects/p1/addresses?offset=100");
    expect(afterLoginPath("//evil")).toBe("/");
    expect(afterLoginPath("/login")).toBe("/");
    expect(afterLoginPath(null)).toBe("/");
  });
});

function renderLogin(props: Partial<Parameters<typeof Login>[0]> = {}) {
  const navigate = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Login reason={null} error={null} next={null} navigate={navigate} {...props} />
    </QueryClientProvider>,
  );
  return navigate;
}

describe("<Login>", () => {
  it("links Google to /auth/google", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: "Continue with Google" }).getAttribute("href")).toBe("/auth/google");
  });

  it("posts email and password, then loads next", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const navigate = renderLogin({ next: "/account" });
    await userEvent.type(screen.getByLabelText("Email"), " pm@acme.com ");
    await userEvent.type(screen.getByLabelText("Password"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(fetchMock).toHaveBeenCalledWith("/auth/login", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "pm@acme.com", password: "a long enough password" });
    expect(navigate).toHaveBeenCalledWith("/account");
  });

  it("shows invalid_credentials without leaving the page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "invalid_credentials" }, { status: 401 })));
    const clientNavigate = vi.fn();
    configureClient({ navigate: clientNavigate });
    const navigate = renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "pm@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Wrong email or password.");
    expect(navigate).not.toHaveBeenCalled();
    expect(clientNavigate).not.toHaveBeenCalled();
  });

  it("asks for the missing field before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert").textContent).toBe("Enter your email.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the ?error message", () => {
    renderLogin({ error: "not_invited" });
    expect(screen.getByRole("alert").textContent).toBe("No account for this email. Ask an admin to invite you.");
  });
});
