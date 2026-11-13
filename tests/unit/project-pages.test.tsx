// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MembersPage } from "@/features/members/members";
import { AddressesPage } from "@/features/project/addresses";
import { ProjectDashboard } from "@/features/project/dashboard";
import { SYNC_POLL_MS, projectKeys, syncPollInterval } from "@/features/project/hooks";
import { ProjectScope } from "@/features/project/scope";
import { ProjectSettings } from "@/features/project/settings";
import { TransactionsPage } from "@/features/project/transactions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { resetClient } from "@/lib/client";
import type { AddressPage, AdminAddress, Me, Member, ProjectRole } from "@/lib/types";

const router = { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/projects/p1",
  useSearchParams: () => new URLSearchParams(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// jsdom has no ResizeObserver; Radix RadioGroup (register dialog) needs one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const PID = "p1";
const ADDRESS = "0:" + "A".repeat(64);

function me(role: ProjectRole | null, isAdmin = false, userId = "u-me"): Me {
  return {
    user: { id: userId, email: "me@acme.com", name: null, isAdmin, hasPassword: true },
    projects: role ? [{ id: PID, name: "Alpha", role }] : [],
  };
}

function address(overrides: Partial<AdminAddress> = {}): AdminAddress {
  return {
    address: ADDRESS,
    sourceId: "7",
    state: "live",
    startLt: "100",
    lastLt: "200",
    stillSyncing: false,
    lastError: null,
    ...overrides,
  };
}

const MEMBERS: Member[] = [
  { userId: "u-me", email: "me@acme.com", name: null, role: "owner" },
  { userId: "u-2", email: "grace@acme.com", name: "Grace", role: "editor" },
];

function setup(seed: Me, children: ReactNode, data: (client: QueryClient) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["me"], seed);
  data(client);
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ProjectScope projectId={PID}>{children}</ProjectScope>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return client;
}

function projectAddress(value: string) {
  return { address: value, state: "live", startLt: "1", lastLt: "2", stillSyncing: false };
}

function txRow(hash: string, account: string, utime: string, lt: string) {
  return {
    account,
    hash,
    lt,
    utime,
    time: new Date(Number(utime) * 1000).toISOString(),
    traceId: null,
    inMsgOpcode: null,
    sender: null,
    value: null,
    aborted: false,
    fee: "1000",
    outMsgs: [],
  };
}

function withAddresses(rows: AdminAddress[]) {
  return (client: QueryClient) =>
    client.setQueryData<AddressPage>(projectKeys.addressPage(PID, 0), { addresses: rows, limit: 100, offset: 0 });
}

function withMembers(rows: Member[]) {
  return (client: QueryClient) => client.setQueryData(projectKeys.members(PID), { members: rows });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetClient();
});

describe("project layout scope", () => {
  it("a project not in me.projects renders NoAccess", () => {
    setup(me(null), <AddressesPage />);
    expect(screen.getByText("No access")).toBeTruthy();
    expect(screen.getByText(/You're not a member of this project/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Addresses" })).toBeNull();
  });
});

describe("<ProjectDashboard>", () => {
  it("reads project(id:) for the route's project, under [\"project\", id, …]", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { project: { id: PID, name: "Alpha", addresses: [] } } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = setup(me("viewer"), <ProjectDashboard />);
    await waitFor(() => expect(screen.getByText("Ask a project owner or editor to register them.")).toBeTruthy());
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.query).toContain("project(id: $id)");
    expect(body.variables).toEqual({ id: PID });
    expect(client.getQueryData(projectKeys.info(PID))).toMatchObject({ id: PID });
  });
});

describe("<ProjectDashboard> latest transactions", () => {
  it("reads projectTransactions(id, limit 10) across every address", async () => {
    const OTHER = "0:" + "B".repeat(64);
    const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.query.includes("projectTransactions")) {
        return Response.json({ data: { projectTransactions: [txRow("h1", OTHER, "300", "9"), txRow("h2", ADDRESS, "200", "8")] } });
      }
      return Response.json({ data: { project: { id: PID, name: "Alpha", addresses: [projectAddress(ADDRESS), projectAddress(OTHER)] } } });
    });
    vi.stubGlobal("fetch", fetchMock);
    setup(me("viewer"), <ProjectDashboard />);
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
    const feedCall = fetchMock.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body))).find((body) => body.query.includes("projectTransactions"));
    expect(feedCall.variables).toEqual({ id: PID, limit: 10, before: null });
    expect(screen.getByText("Newest across every address. Updates every 5 seconds.")).toBeTruthy();
  });
});

describe("<TransactionsPage>", () => {
  it("defaults to all addresses with an Address column; Load more sends the last row as the cursor", async () => {
    const OTHER = "0:" + "B".repeat(64);
    const page1 = Array.from({ length: 20 }, (_, index) => txRow(`p1-${index}`, index % 2 ? OTHER : ADDRESS, String(1000 - index), String(500 - index)));
    const bodies: { query: string; variables: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_path: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        bodies.push(body);
        if (body.query.includes("projectTransactions")) {
          return Response.json({ data: { projectTransactions: body.variables.before ? [txRow("old", ADDRESS, "1", "1")] : page1 } });
        }
        return Response.json({ data: { project: { id: PID, name: "Alpha", addresses: [projectAddress(ADDRESS), projectAddress(OTHER)] } } });
      }),
    );
    setup(me("viewer"), <TransactionsPage />);
    await waitFor(() => expect(screen.getByRole("columnheader", { name: "Address" })).toBeTruthy());
    expect((screen.getByLabelText("Address") as HTMLSelectElement).value).toBe("");
    // Addresses on this page are raw `0:HEX`, shortened; the full raw form is the accessible name.
    expect(screen.getAllByText("0:AAAA…AAAA").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: `Address ${ADDRESS}` }).length).toBeGreaterThan(0);
    expect(screen.getByText(/across every address\. Updates every 5 seconds\./)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Load older transactions" }));
    await waitFor(() => expect(screen.getByText("No older transactions.")).toBeTruthy());
    const last = page1[19];
    expect(bodies.at(-1)!.variables).toEqual({ id: PID, limit: 20, before: { utime: last.utime, lt: last.lt, account: last.account } });
    expect(screen.getByText(/Live updates pause while older pages are loaded\./)).toBeTruthy();
  });
});

describe("<AddressesPage>", () => {
  it("as viewer: no Register or Unlink controls", () => {
    setup(me("viewer"), <AddressesPage />, withAddresses([address()]));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Register addresses/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Unlink/ })).toBeNull();
  });

  it("as editor: Register and Unlink", () => {
    setup(me("editor"), <AddressesPage />, withAddresses([address()]));
    expect(screen.getByRole("button", { name: /Register addresses/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Unlink/ })).toBeTruthy();
  });

  it("register opens a centered dialog; an imported CSV file fills the list", async () => {
    setup(me("editor"), <AddressesPage />, withAddresses([address()]));
    await userEvent.click(screen.getByRole("button", { name: /Register addresses/ }));
    const dialog = await screen.findByRole("dialog", { name: "Register addresses" });
    expect(dialog.className).toContain("dialog-panel-wide");
    const csv = new File([`address,label\n${ADDRESS},main\n`], "list.csv", { type: "text/csv" });
    await userEvent.upload(within(dialog).getByTestId("register-file"), csv);
    await waitFor(() => expect((within(dialog).getByLabelText("Addresses") as HTMLTextAreaElement).value).toBe(ADDRESS));
    expect(within(dialog).getByText(/Added 1 line from list\.csv/)).toBeTruthy();
  });

  it("dropping a JSON file appends its addresses; a bad file shows why", async () => {
    setup(me("owner"), <AddressesPage />, withAddresses([address()]));
    await userEvent.click(screen.getByRole("button", { name: /Register addresses/ }));
    const dialog = await screen.findByRole("dialog", { name: "Register addresses" });
    const textarea = within(dialog).getByLabelText("Addresses") as HTMLTextAreaElement;
    await userEvent.type(textarea, "EQfirst");
    const zone = within(dialog).getByTestId("register-dropzone");
    const drop = (file: File) => {
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.assign(event, { dataTransfer: { types: ["Files"], files: [file] } });
      zone.dispatchEvent(event);
    };
    drop(new File([JSON.stringify({ addresses: [{ address: ADDRESS }] })], "list.json", { type: "application/json" }));
    await waitFor(() => expect(textarea.value).toBe(`EQfirst\n${ADDRESS}`));
    drop(new File(["not json"], "broken.json"));
    await waitFor(() => expect(within(dialog).getByText("broken.json: That file is not valid JSON.")).toBeTruthy());
    expect(textarea.value).toBe(`EQfirst\n${ADDRESS}`);
  });

  it("unlink sends DELETE with the encoded address after the confirm", async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) =>
      init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ addresses: [], limit: 100, offset: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setup(me("owner"), <AddressesPage />, withAddresses([address()]));
    await userEvent.click(screen.getByRole("button", { name: /^Unlink/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Unlink address" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true));
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(call?.[0]).toBe(`/api/projects/p1/addresses/${encodeURIComponent(ADDRESS)}`);
  });

  it("polls every 10 s only while a row is still syncing", () => {
    expect(syncPollInterval(undefined)).toBe(false);
    expect(syncPollInterval({ addresses: [address()], limit: 100, offset: 0 })).toBe(false);
    expect(syncPollInterval({ addresses: [address(), address({ stillSyncing: true })], limit: 100, offset: 0 })).toBe(SYNC_POLL_MS);
    expect(SYNC_POLL_MS).toBe(10_000);
  });
});

describe("<MembersPage>", () => {
  it("as viewer: the list, with a null name as the email only; no Add, Remove or Resend", () => {
    setup(me("viewer", false, "u-3"), <MembersPage />, withMembers(MEMBERS));
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("me@acme.com")).toBeTruthy();
    expect(within(rows[2]).getByText("Grace")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add member/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Resend invite/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add owner/ })).toBeNull();
  });

  it("as owner: Add, Remove and Resend (no Add owner)", () => {
    setup(me("owner"), <MembersPage />, withMembers(MEMBERS));
    expect(screen.getByRole("button", { name: /Add member/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Resend invite/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Add owner/ })).toBeNull();
  });

  it("as admin: Add owner and Resend only", () => {
    setup(me("admin", true, "u-admin"), <MembersPage />, withMembers(MEMBERS));
    expect(screen.getByRole("button", { name: /Add owner/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Resend invite/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Add member/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  it("add member: PUT {email, role}; invite.sent false → the toast with Resend", async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.endsWith("/invite")) return Response.json({ invite: { sent: true } });
      if (init?.method === "PUT") {
        return Response.json({ member: { userId: "u-9", email: "new@acme.com", role: "editor" }, invite: { sent: false } });
      }
      return Response.json({ members: MEMBERS });
    });
    vi.stubGlobal("fetch", fetchMock);
    setup(me("owner"), <MembersPage />, withMembers(MEMBERS));
    await userEvent.click(screen.getByRole("button", { name: /Add member/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Email"), "new@acme.com");
    await userEvent.selectOptions(within(dialog).getByLabelText("Role"), "editor");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save member" }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(put?.[0]).toBe("/api/projects/p1/members");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ email: "new@acme.com", role: "editor" });
    const [text, options] = toast.warning.mock.calls[0];
    expect(text).toBe("Saved. The invite email wasn't sent.");
    expect(options.action.label).toBe("Resend");
    options.action.onClick();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Invite sent."));
    expect(fetchMock.mock.calls.some(([path]) => path === "/api/projects/p1/members/u-9/invite")).toBe(true);
  });

  it("role change of an existing member: PUT, then 'Role updated' and no invite toast", async () => {
    const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Response.json({ member: { userId: "u-2", email: "grace@acme.com", role: "viewer" }, invite: { sent: false } });
      }
      return Response.json({ members: MEMBERS });
    });
    vi.stubGlobal("fetch", fetchMock);
    setup(me("owner"), <MembersPage />, withMembers(MEMBERS));
    await userEvent.selectOptions(screen.getByLabelText("Role of grace@acme.com"), "viewer");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Role updated"));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ email: "grace@acme.com", role: "viewer" });
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("add member with an email already in the list (any case): 'Role updated', no invite toast", async () => {
    const fetchMock = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Response.json({ member: { userId: "u-2", email: "grace@acme.com", role: "owner" }, invite: { sent: false } });
      }
      return Response.json({ members: MEMBERS });
    });
    vi.stubGlobal("fetch", fetchMock);
    setup(me("owner"), <MembersPage />, withMembers(MEMBERS));
    await userEvent.click(screen.getByRole("button", { name: /Add member/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Email"), "Grace@Acme.com");
    await userEvent.selectOptions(within(dialog).getByLabelText("Role"), "owner");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save member" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Role updated"));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("removing yourself: DELETE, refresh ['me'], and go to / when the project is gone", async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (path === "/auth/me") return Response.json(me(null));
      return Response.json({ members: MEMBERS.slice(1) });
    });
    vi.stubGlobal("fetch", fetchMock);
    setup(me("owner"), <MembersPage />, withMembers(MEMBERS));
    await userEvent.click(screen.getByRole("button", { name: "Remove me@acme.com" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Leave this project?")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Leave project" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
    expect(fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")?.[0]).toBe("/api/projects/p1/members/u-me");
    expect(router.refresh).toHaveBeenCalled();
  });
});

describe("<ProjectSettings>", () => {
  it("shows the project id and network to every role", () => {
    setup(me("viewer"), <ProjectSettings />);
    expect(screen.getByText(PID)).toBeTruthy();
    expect(screen.getByText("Network")).toBeTruthy();
  });

  it("Manage project (rename, delete) shows only for admins", () => {
    setup(me("owner"), <ProjectSettings />);
    expect(screen.queryByRole("heading", { name: "Manage project" })).toBeNull();
    cleanup();
    setup(me("admin", true), <ProjectSettings />);
    expect(screen.getByRole("heading", { name: "Manage project" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rename" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete project" })).toBeTruthy();
  });

  it("deleting from inside the project leaves for /admin", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path: string) => (path === "/auth/me" ? Response.json(me(null, true)) : new Response(null, { status: 204 }))));
    setup(me("admin", true), <ProjectSettings />);
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Type Alpha to confirm"), "Alpha");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete project" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin"));
    expect(toast.success).toHaveBeenCalledWith("Project Alpha deleted.");
  });

  it("as editor: no Generate API key", () => {
    setup(me("editor"), <ProjectSettings />);
    expect(screen.queryByRole("button", { name: /Generate API key/ })).toBeNull();
  });

  it("as owner: confirm, POST, then the key once", async () => {
    const fetchMock = vi.fn(async () => Response.json({ apiKey: "tok_secret_123" }));
    vi.stubGlobal("fetch", fetchMock);
    setup(me("owner"), <ProjectSettings />);
    await userEvent.click(screen.getByRole("button", { name: /Generate API key/ }));
    const confirm = screen.getByRole("dialog");
    expect(within(confirm).getByText("Replaces any existing key; systems using the old key stop working.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole("button", { name: "Generate API key" }));
    await waitFor(() => expect(screen.getByText("tok_secret_123")).toBeTruthy());
    expect(fetchMock.mock.calls[0]).toEqual(["/api/projects/p1/api-key", expect.objectContaining({ method: "POST" })]);
  });
});
