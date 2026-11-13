"use client";

import { Radar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pill } from "@/components/ui/pill";
import { Tooltip } from "@/components/ui/tooltip";
import type { Me } from "@/lib/types";
import { isActive, navFor } from "./nav";
import { ProjectSwitcher } from "./project-switcher";

export function SidebarContent({
  me,
  collapsed,
  onNavigate,
}: {
  me: Me;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Inside /projects/<id>/*: that project's pages and the switcher; elsewhere the top level.
  const { projectId, groups } = navFor(pathname, me.user.isAdmin);
  return (
    <>
      <div className="flex h-10 items-center gap-3 px-3">
        <Link
          href="/"
          className="flex items-center gap-3 font-bold"
          onClick={onNavigate}
          aria-label="ton-observer home"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-primary text-surface" aria-hidden="true">
            <Radar size={18} strokeWidth={1.75} />
          </span>
          <span className="collapsible-label text-card-title">ton-observer</span>
        </Link>
        {me.user.isAdmin ? (
          <span className="collapsible-label">
            <Pill tone="primary">Admin</Pill>
          </span>
        ) : null}
      </div>

      {projectId !== null ? (
        <ProjectSwitcher projectId={projectId} projects={me.projects} collapsed={collapsed} onNavigate={onNavigate} />
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
