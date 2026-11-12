import { ArrowLeftRight, FolderKanban, LayoutDashboard, Settings, Wallet, type LucideIcon } from "lucide-react";

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

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Menu",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban },
    ],
  },
  { label: "Support", items: [{ href: "/admin/settings", label: "Settings", icon: Settings }] },
];

export const PROJECT_NAV: NavGroup[] = [
  {
    label: "Menu",
    items: [
      { href: "/project", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/project/addresses", label: "Addresses", icon: Wallet },
      { href: "/project/transactions", label: "Transactions", icon: ArrowLeftRight },
    ],
  },
  { label: "Support", items: [{ href: "/project/settings", label: "Settings", icon: Settings }] },
];

export function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
