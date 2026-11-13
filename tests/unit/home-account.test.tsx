// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountView } from "@/features/account/account-view";
import { newPasswordProblem, passwordBody, passwordLength } from "@/features/account/password";
import { homeView } from "@/features/home/home-view";
import { ProjectList } from "@/features/home/project-list";
import type { Me, MyProjectRef } from "@/lib/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function me(isAdmin: boolean, projects: MyProjectRef[], user: Partial<Me["user"]> = {}): Me {
  return { user: { id: "u1", email: "pm@acme.com", name: null, isAdmin, hasPassword: true, ...user }, projects };
}

const ALPHA: MyProjectRef = { id: "p1", name: "Alpha", role: "owner" };
const BETA: MyProjectRef = { id: "p2", name: "Beta", role: "viewer" };

function wrap(children: ReactNode, seed: Me) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["me"], seed);
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("homeView", () => {
  it("one project, not an admin → that project", () => {
    expect(homeView(me(false, [ALPHA]))).toEqual({ kind: "redirect", href: "/projects/p1" });
  });
  it("one project as an admin → the list", () => {
    expect(homeView(me(true, [ALPHA]))).toEqual({ kind: "list" });
  });
  it("zero projects → the member or the admin empty state", () => {
    expect(homeView(me(false, []))).toEqual({ kind: "empty-member" });
    expect(homeView(me(true, []))).toEqual({ kind: "empty-admin" });
  });
  it("several projects → the list", () => {
    expect(homeView(me(false, [ALPHA, BETA]))).toEqual({ kind: "list" });
  });
});

describe("<ProjectList>", () => {
  it("cards link to each project with its role", () => {
    const seed = me(false, [ALPHA, BETA]);
    wrap(<ProjectList initialMe={seed} />, seed);
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/projects/"));
    expect(links.map((link) => [link.getAttribute("href"), link.textContent])).toEqual([
      ["/projects/p1", "AlphaOwner"],
      ["/projects/p2", "BetaViewer"],
    ]);
  });
  it("no projects, member: names the email and links to /account", () => {
    const seed = me(false, []);
    wrap(<ProjectList initialMe={seed} />, seed);
    expect(screen.getByText(/You're not in any project yet\. Ask an admin or a project owner to add/).textContent).toContain("pm@acme.com");
    expect(screen.getByRole("link", { name: "Go to your account" }).getAttribute("href")).toBe("/account");
  });
  it("no projects, admin: links to /admin", () => {
    const seed = me(true, []);
    wrap(<ProjectList initialMe={seed} />, seed);
    expect(screen.getByRole("link", { name: "Create the first project" }).getAttribute("href")).toBe("/admin");
  });
});

describe("password rule", () => {
  it("counts code points", () => {
    expect(passwordLength("😀😀")).toBe(2);
  });
  it("accepts 12–256 code points only", () => {
    expect(newPasswordProblem("a".repeat(11))).not.toBeNull();
    expect(newPasswordProblem("a".repeat(12))).toBeNull();
    expect(newPasswordProblem("😀".repeat(12))).toBeNull(); // 24 UTF-16 units, 12 code points
    expect(newPasswordProblem("😀".repeat(11))).not.toBeNull();
    expect(newPasswordProblem("a".repeat(256))).toBeNull();
    expect(newPasswordProblem("a".repeat(257))).not.toBeNull();
  });
  it("sends currentPassword only once a password exists", () => {
    expect(passwordBody(false, "ignored", "n")).toEqual({ newPassword: "n" });
    expect(passwordBody(true, "c", "n")).toEqual({ currentPassword: "c", newPassword: "n" });
  });
});

describe("<AccountView>", () => {
  it("shows the profile: no name, email, admin badge", () => {
    const seed = me(true, [], { hasPassword: false });
    wrap(<AccountView initialMe={seed} />, seed);
    expect(screen.getByText("No name set")).toBeTruthy();
    expect(screen.getByText("pm@acme.com")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText(/signs you out of every other browser/)).toBeTruthy();
  });

  it("without a password: only the new password, sent as {newPassword}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const seed = me(false, [], { hasPassword: false });
    wrap(<AccountView initialMe={seed} />, seed);
    expect(screen.queryByLabelText("Current password")).toBeNull();
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByText("Use at least 12 characters.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("New password"), " enough now");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    const call = fetchMock.mock.calls.find(([path]) => path === "/auth/password");
    expect(call?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(call?.[1].body)).toEqual({ newPassword: "short enough now" });
  });

  it("with a password: sends both, shows a wrong current password next to it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "invalid_credentials" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const seed = me(false, []);
    wrap(<AccountView initialMe={seed} />, seed);
    await userEvent.type(screen.getByLabelText("Current password"), "old one");
    await userEvent.type(screen.getByLabelText("New password"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currentPassword: "old one", newPassword: "a long enough password" });
    expect(await screen.findByText("The current password is wrong.")).toBeTruthy();
  });

  it("sign out posts /auth/logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    const seed = me(false, []);
    wrap(<AccountView initialMe={seed} />, seed);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(fetchMock).toHaveBeenCalledWith("/auth/logout", expect.objectContaining({ method: "POST" }));
  });
});
