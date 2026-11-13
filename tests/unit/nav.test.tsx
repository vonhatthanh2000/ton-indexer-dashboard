// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isActive, navFor, projectIdFromPath, projectNav, switchProjectHref, workspaceNav } from "@/components/shell/nav";
import { SidebarContent } from "@/components/shell/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Me } from "@/lib/types";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

afterEach(cleanup);

const labels = (groups: ReturnType<typeof workspaceNav>) => groups.flatMap((group) => group.items.map((item) => item.label));

describe("nav", () => {
  it("top level: Projects, Admin only for admins, Account", () => {
    expect(labels(workspaceNav(false))).toEqual(["Projects", "Account"]);
    expect(labels(workspaceNav(true))).toEqual(["Projects", "Admin", "Account"]);
  });

  it("project level: the five project pages under /projects/<id>", () => {
    const items = projectNav("p1").flatMap((group) => group.items);
    expect(items.map((item) => [item.label, item.href])).toEqual([
      ["Dashboard", "/projects/p1"],
      ["Addresses", "/projects/p1/addresses"],
      ["Transactions", "/projects/p1/transactions"],
      ["Members", "/projects/p1/members"],
      ["Settings", "/projects/p1/settings"],
    ]);
  });

  it.each([
    ["/projects/p1", "p1"],
    ["/projects/p1/members", "p1"],
    ["/projects/a%20b/settings", "a b"],
    ["/projects", null],
    ["/projects/", null],
    ["/projectsx/p1", null],
    ["/", null],
    ["/admin/users", null],
  ])("projectIdFromPath(%s) = %s", (path, id) => {
    expect(projectIdFromPath(path)).toBe(id);
  });

  it("navFor picks the project nav inside a project, else the top level", () => {
    expect(navFor("/projects/p1/addresses", true).projectId).toBe("p1");
    expect(labels(navFor("/projects/p1/addresses", true).groups)).not.toContain("Admin");
    expect(navFor("/account", true).projectId).toBeNull();
    expect(labels(navFor("/account", true).groups)).toContain("Admin");
  });

  it("selects one item per page", () => {
    const active = (path: string) =>
      navFor(path, true)
        .groups.flatMap((group) => group.items)
        .filter((item) => isActive(path, item))
        .map((item) => item.label);
    expect(active("/")).toEqual(["Projects"]);
    expect(active("/admin")).toEqual(["Admin"]);
    expect(active("/admin/users")).toEqual(["Admin"]);
    expect(active("/account")).toEqual(["Account"]);
    expect(active("/projects/p1")).toEqual(["Dashboard"]);
    expect(active("/projects/p1/addresses")).toEqual(["Addresses"]);
    expect(active("/projects/p1/members")).toEqual(["Members"]);
    expect(active("/projects/p1/settings")).toEqual(["Settings"]);
  });

  it("switchProjectHref keeps the section, drops the rest", () => {
    expect(switchProjectHref("/projects/p1", "p2")).toBe("/projects/p2");
    expect(switchProjectHref("/projects/p1/addresses", "p2")).toBe("/projects/p2/addresses");
    expect(switchProjectHref("/projects/p1/transactions/x", "p2")).toBe("/projects/p2/transactions");
    expect(switchProjectHref("/projects/p1/unknown", "p2")).toBe("/projects/p2");
  });
});

function me(isAdmin: boolean): Me {
  return {
    user: { id: "u1", email: "pm@acme.com", name: null, isAdmin, hasPassword: true },
    projects: [
      { id: "p1", name: "Alpha", role: "owner" },
      { id: "p2", name: "Beta", role: "viewer" },
    ],
  };
}

function renderSidebar(path: string, user: Me) {
  pathname.value = path;
  render(
    <TooltipProvider>
      <SidebarContent me={user} collapsed={false} />
    </TooltipProvider>,
  );
  return within(screen.getByRole("navigation", { name: "Main" }));
}

describe("<SidebarContent>", () => {
  it("top level for a member: no Admin link, no switcher", () => {
    const nav = renderSidebar("/", me(false));
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual(["Projects", "Account"]);
    expect(nav.getByRole("link", { name: "Projects" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: /Switch project/ })).toBeNull();
  });

  it("inside a project: project pages and the switcher on the current project", () => {
    const nav = renderSidebar("/projects/p1/members", me(true));
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Addresses",
      "Transactions",
      "Members",
      "Settings",
    ]);
    expect(nav.getByRole("link", { name: "Members" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Project: Alpha. Switch project" })).toBeTruthy();
  });
});
