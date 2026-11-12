"use client";

import { Radar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Identicon } from "@/components/chain/identicon";
import { NetworkPill } from "@/components/chain/values";
import { Pill } from "@/components/ui/pill";
import { Tooltip } from "@/components/ui/tooltip";
import type { SessionInfo } from "@/lib/types";
import { ADMIN_NAV, PROJECT_NAV, isActive } from "./nav";

export function SidebarContent({
  session,
  collapsed,
  onNavigate,
}: {
  session: SessionInfo;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = session.role === "admin" ? ADMIN_NAV : PROJECT_NAV;
  return (
    <>
      <div className="flex h-10 items-center gap-3 px-3">
        <Link
          href={session.role === "admin" ? "/admin" : "/project"}
          className="flex items-center gap-3 font-bold"
          onClick={onNavigate}
          aria-label="ton-observer home"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-primary text-surface" aria-hidden="true">
            <Radar size={18} strokeWidth={1.75} />
          </span>
          <span className="collapsible-label text-card-title">ton-observer</span>
        </Link>
        {session.role === "admin" ? (
          <span className="collapsible-label">
            <Pill tone="primary">Admin</Pill>
          </span>
        ) : null}
      </div>

      {session.role === "project" ? (
        <div className="card mt-6 flex items-center gap-3 p-3" aria-label="Project">
          <Identicon seed={session.projectId ?? session.projectName ?? "project"} size={36} />
          <div className="collapsible-label min-w-0">
            <p className="truncate font-semibold">{session.projectName}</p>
            <div className="mt-1">
              <NetworkPill />
            </div>
          </div>
        </div>
      ) : null}

      <nav aria-label="Main">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="nav-group-label">
              {collapsed ? <span aria-hidden="true">···</span> : null}
              <span className="collapsible-label">{group.label}</span>
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const link = (
                  <Link
                    href={item.href}
                    className="nav-item"
                    aria-current={isActive(pathname, item) ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <item.icon size={20} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
                    <span className="collapsible-label">{item.label}</span>
                  </Link>
                );
                return <li key={item.href}>{collapsed ? <Tooltip content={item.label}>{link}</Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
