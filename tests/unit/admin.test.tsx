// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ADMIN_ONLY_TITLE, AdminScope } from "@/features/admin/admin-scope";
import { adminKeys } from "@/features/admin/hooks";
import { AdminProjects, validateProjectName } from "@/features/admin/projects";
import { AdminUsers } from "@/features/admin/users";
import { resetClient } from "@/lib/client";
import type { AdminProject, Me } from "@/lib/types";

const router = { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function me(isAdmin: boolean): Me {
  return { user: { id: "u-me", email: "me@acme.com", name: null, isAdmin, hasPassword: true }, projects: [] };
}

const PROJECTS: AdminProject[] = [
  {
    id: "p1",
    name: "Alpha",
    createdAt: "2026-10-01T00:00:00.000Z",
    owners: [{ userId: "u-1", email: "ada@acme.com" }],
    activeAccounts: 3,
    hasApiKey: true,
  },
  { id: "p2", name: "Beta", createdAt: "2026-11-01T00:00:00.000Z", owners: [], activeAccounts: 0, hasApiKey: false },
];

function setup(seed: Me, children: ReactNode, projects?: AdminProject[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["me"], seed);
  if (projects) client.setQueryData(adminKeys.projects, { projects });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AdminScope>{children}</AdminScope>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetClient();
});

describe("<AdminScope>", () => {
  it("a non-admin gets NoAccess with the admin copy", () => {
    setup(me(false), <AdminProjects />, PROJECTS);
    expect(screen.getByText(ADMIN_ONLY_TITLE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /New project/ })).toBeNull();
  });
});

describe("<AdminProjects>", () => {
  it("lists every project with owners, addresses, key and a link to /projects/<id>", () => {
    setup(me(true), <AdminProjects />, PROJECTS);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole("link", { name: /Alpha/ }).getAttribute("href")).toBe("/projects/p1");
    expect(within(rows[1]).getByText("ada@acme.com")).toBeTruthy();
    expect(within(rows[1]).getByText("Issued")).toBeTruthy();
    expect(within(rows[2]).getByText("No owner")).toBeTruthy();
    expect(within(rows[2]).getByText("None")).toBeTruthy();
  });

  it("new project: POST {name, ownerEmail}, invalidates admin projects and me, invite toast", async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === "/api/projects" && init?.method === "POST") {
        return Response.json(
          {
            project: { id: "p3", name: "Gamma", createdAt: "2026-11-13T00:00:00.000Z" },
            owner: { userId: "u-3", email: "grace@acme.com" },
            invite: { sent: false },
          },
          { status: 201 },
        );
      }
      if (path === "/auth/me") return Response.json(me(true));
      return Response.json({ projects: PROJECTS });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = setup(me(true), <AdminProjects />, PROJECTS);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await userEvent.click(screen.getByRole("button", { name: /New project/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Project name"), "  Gamma ");
    await userEvent.type(within(dialog).getByLabelText("Owner email"), "grace@acme.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ name: "Gamma", ownerEmail: "grace@acme.com" });
    expect(toast.warning.mock.calls[0][0]).toBe("Saved. The invite email wasn't sent.");
    expect(toast.warning.mock.calls[0][1].action.label).toBe("Resend");
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(["admin", "projects"]));
    expect(keys).toContain(JSON.stringify(["me"]));
  });

  it("new project: project_exists shows next to the name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "project_exists" }, { status: 409 })),
    );
    setup(me(true), <AdminProjects />, PROJECTS);
    await userEvent.click(screen.getByRole("button", { name: /New project/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Project name"), "Alpha");
    await userEvent.type(within(dialog).getByLabelText("Owner email"), "ada@acme.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create project" }));
    expect(await within(dialog).findByText("A project with this name already exists.")).toBeTruthy();
  });

  it("validateProjectName follows the API rule", () => {
    expect(validateProjectName("  ")).not.toBeNull();
    expect(validateProjectName("a".repeat(64))).toBeNull();
    expect(validateProjectName("a".repeat(65))).not.toBeNull();
    expect(validateProjectName("a\u0007b")).not.toBeNull();
  });
});

describe("<AdminUsers>", () => {
  it.each([201, 200])("add admin: POST {email, isAdmin: true}; %i counts as success", async (status) => {
    const fetchMock = vi.fn(async () =>
      Response.json({ user: { id: "u-9", email: "new@acme.com", isAdmin: true } }, { status }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setup(me(true), <AdminUsers />);
    await userEvent.type(screen.getByLabelText("Email"), "new@acme.com");
    await userEvent.click(screen.getByRole("button", { name: /Add admin/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("new@acme.com is now an admin."));
    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/users");
    expect(JSON.parse(String(init.body))).toEqual({ email: "new@acme.com", isAdmin: true });
  });

  it("a non-admin gets NoAccess", () => {
    setup(me(false), <AdminUsers />);
    expect(screen.getByText(ADMIN_ONLY_TITLE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add admin/ })).toBeNull();
  });
});
