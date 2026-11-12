"use client";

import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Menu as MenuIcon, Moon, Search, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Identicon } from "@/components/chain/identicon";
import { Tooltip } from "@/components/ui/tooltip";
import { signOut } from "@/features/auth/session-actions";
import { fetchHealth } from "@/lib/client";
import type { HealthState, SessionInfo } from "@/lib/types";

const HEALTH_TEXT: Record<HealthState, string> = {
  online: "API online",
  database_down: "Database unreachable",
  unreachable: "API unreachable",
};

export function ApiStatusDot() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const text = data ? HEALTH_TEXT[data] : "Checking API";
  const color = data === "online" ? "bg-ok" : data ? "bg-err" : "bg-ink-3";
  return (
    <span className="inline-flex items-center gap-2 text-ink-2" role="status">
      <span className={`status-dot ${color}`} aria-hidden="true" />
      <span className="hidden lg:inline">{text}</span>
      <span className="sr-only lg:hidden">{text}</span>
    </span>
  );
}

function readTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<"light" | "dark" | null>(subscribeTheme, readTheme, () => null);
  function toggle() {
    const next = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("tonobs.theme", next);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
  }
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Tooltip content={label}>
      <button type="button" className="btn btn-secondary btn-icon btn-round" onClick={toggle} aria-label={label}>
        {theme === "dark" ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
      </button>
    </Tooltip>
  );
}

export function UserMenu({ session }: { session: SessionInfo }) {
  const client = useQueryClient();
  const name = session.role === "admin" ? "Admin" : (session.projectName ?? "Project");
  const settingsHref = session.role === "admin" ? "/admin/settings" : "/project/settings";
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger asChild>
        <button type="button" className="flex h-11 items-center gap-3 rounded-control px-2" aria-label={`Account menu, ${name}`}>
          <Identicon seed={session.projectId ?? session.role} size={32} />
          <span className="hidden max-w-40 truncate font-medium md:inline">{name}</span>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="text-ink-2" />
        </button>
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content align="end" sideOffset={8} className="menu-panel fade-in">
          <MenuPrimitive.Label className="px-3 py-2 text-label text-ink-2">Signed in as {name}</MenuPrimitive.Label>
          <MenuPrimitive.Item asChild className="menu-item">
            <Link href={settingsHref}>
              <Settings size={16} strokeWidth={1.5} aria-hidden="true" />
              Settings
            </Link>
          </MenuPrimitive.Item>
          <MenuPrimitive.Item className="menu-item" onSelect={() => void signOut(client)}>
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
            Sign out
          </MenuPrimitive.Item>
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

export function TopBar({
  session,
  menuExpanded,
  onMenu,
  onSearch,
}: {
  session: SessionInfo;
  menuExpanded: boolean;
  onMenu: () => void;
  onSearch: () => void;
}) {
  return (
    <header className="app-topbar">
      <button
        type="button"
        className="btn btn-secondary btn-icon shrink-0"
        onClick={onMenu}
        aria-label="Main menu"
        aria-expanded={menuExpanded}
      >
        <MenuIcon size={20} strokeWidth={1.5} />
      </button>
      <button type="button" className="search-trigger" onClick={onSearch} aria-label="Search" aria-keyshortcuts="Meta+K Control+K">
        <Search size={18} strokeWidth={1.5} aria-hidden="true" />
        <span className="search-text">{session.role === "admin" ? "Search projects…" : "Search addresses…"}</span>
        <span className="kbd" aria-hidden="true">
          ⌘K
        </span>
      </button>
      <div className="ml-auto flex items-center gap-3">
        <ApiStatusDot />
        <ThemeToggle />
        <UserMenu session={session} />
      </div>
    </header>
  );
}
