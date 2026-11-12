"use client";

import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { MoreVertical, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface MenuAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
}

export function Menu({ label, actions, trigger }: { label: string; actions: MenuAction[]; trigger?: ReactNode }) {
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger asChild>
        {trigger ?? (
          <button type="button" className="btn btn-secondary btn-icon border-0" aria-label={label}>
            <MoreVertical size={18} strokeWidth={1.5} />
          </button>
        )}
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content align="end" sideOffset={6} className="menu-panel fade-in">
          {actions.map((action) => (
            <MenuPrimitive.Item key={action.label} className="menu-item" onSelect={action.onSelect}>
              {action.icon ? <action.icon size={16} strokeWidth={1.5} aria-hidden="true" /> : null}
              {action.label}
            </MenuPrimitive.Item>
          ))}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
