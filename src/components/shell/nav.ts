import {
  ArrowLeftRight,
  FolderKanban,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The top-level sidebar: Projects, Admin (admins only) and Account. */
export function workspaceNav(isAdmin: boolean): NavGroup[] {
  return [
    {
      label: "Menu",
      items: [
        { href: "/", label: "Projects", icon: FolderKanban, exact: true },
        ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
        { href: "/account", label: "Account", icon: UserRound },
      ],
    },
  ];
}

/** The sidebar inside `/projects/[id]/*`. */
export function projectNav(projectId: string): NavGroup[] {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  return [
    {
      label: "Project",
      items: [
        { href: base, label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: `${base}/addresses`, label: "Addresses", icon: Wallet },
        { href: `${base}/transactions`, label: "Transactions", icon: ArrowLeftRight },
        { href: `${base}/members`, label: "Members", icon: Users },
      ],
    },
    { label: "Support", items: [{ href: `${base}/settings`, label: "Settings", icon: Settings }] },
  ];
}

/** The project id of a `/projects/<id>[/…]` pathname (decoded), else `null`. */
export function projectIdFromPath(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// The project sections the switcher keeps when changing project.
const SECTIONS = ["addresses", "transactions", "members", "settings"];

/**
 * Where the project switcher sends you: the same section of the other project. Deeper paths and
 * the query are dropped, since they belong to the project you leave.
 */
export function switchProjectHref(pathname: string, toProjectId: string): string {
  const base = `/projects/${encodeURIComponent(toProjectId)}`;
  const section = /^\/projects\/[^/]+\/([^/?]+)/.exec(pathname)?.[1];
  return section && SECTIONS.includes(section) ? `${base}/${section}` : base;
}

/** The sidebar for a pathname: the project nav inside a project, else the top level. */
export function navFor(pathname: string, isAdmin: boolean): { projectId: string | null; groups: NavGroup[] } {
  const projectId = projectIdFromPath(pathname);
  return projectId === null
    ? { projectId: null, groups: workspaceNav(isAdmin) }
    : { projectId, groups: projectNav(projectId) };
}

export function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
