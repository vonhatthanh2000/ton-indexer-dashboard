"use client";

import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Identicon } from "@/components/chain/identicon";
import { RolePill } from "@/components/ui/role-pill";
import { Tooltip } from "@/components/ui/tooltip";
import type { MyProjectRef } from "@/lib/types";
import { switchProjectHref } from "./nav";

/** The current project in the sidebar; opens a menu of `me.projects` and "All projects". */
export function ProjectSwitcher({
  projectId,
  projects,
  collapsed,
  onNavigate,
}: {
  projectId: string;
  projects: MyProjectRef[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const current = projects.find((project) => project.id === projectId);
  const name = current?.name ?? "Unknown project";

  const trigger = (
    <MenuPrimitive.Trigger asChild>
      <button
        type="button"
        className="card mt-6 flex w-full items-center gap-3 p-3 text-left hover:border-line-strong"
        aria-label={`Project: ${name}. Switch project`}
      >
        <Identicon seed={projectId} size={36} />
        <span className="collapsible-label min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          {current ? (
            <span className="mt-1 block">
              <RolePill role={current.role} />
            </span>
          ) : null}
        </span>
        <ChevronsUpDown size={16} strokeWidth={1.5} aria-hidden="true" className="collapsible-label shrink-0 text-ink-2" />
      </button>
    </MenuPrimitive.Trigger>
  );

  return (
    <MenuPrimitive.Root>
      {collapsed ? <Tooltip content={name}>{trigger}</Tooltip> : trigger}
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content align="start" sideOffset={6} className="menu-panel fade-in max-h-96 overflow-y-auto">
          <MenuPrimitive.Label className="px-3 py-2 text-label text-ink-2">Switch project</MenuPrimitive.Label>
          {projects.map((project) => {
            const selected = project.id === projectId;
            return (
              <MenuPrimitive.Item key={project.id} asChild className="menu-item">
                <Link
                  href={switchProjectHref(pathname, project.id)}
                  onClick={onNavigate}
                  aria-current={selected ? "true" : undefined}
                >
                  <Identicon seed={project.id} size={20} />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {selected ? <Check size={16} strokeWidth={1.5} aria-hidden="true" className="text-primary-text" /> : null}
                </Link>
              </MenuPrimitive.Item>
            );
          })}
          <MenuPrimitive.Separator className="my-1 h-px bg-line" />
          <MenuPrimitive.Item asChild className="menu-item">
            <Link href="/" onClick={onNavigate}>
              <FolderKanban size={16} strokeWidth={1.5} aria-hidden="true" />
              All projects
            </Link>
          </MenuPrimitive.Item>
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
