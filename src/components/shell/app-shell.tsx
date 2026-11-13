"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useMe } from "@/features/auth/use-me";
import type { Me } from "@/lib/types";
import { CommandSearch } from "./command-search";
import { SidebarContent } from "./sidebar";
import { TopBar } from "./topbar";
import { useMediaQuery } from "./use-media";

/**
 * `initialMe` comes from the server layout; the shell follows the client ["me"] query (seeded with
 * the same value), so a role or project change shows up after an invalidation.
 */
export function AppShell({ me: initialMe, children }: { me: Me; children: ReactNode }) {
  const me = useMe().data ?? initialMe;
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1279px)");
  // null = follow the width: icon rail on tablet, full sidebar on desktop.
  const [collapsedChoice, setCollapsedChoice] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const collapsed = collapsedChoice ?? isTablet;

  // Close the drawer when the route changes (state adjusted during render, not in an effect).
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onMenu() {
    if (isMobile) setDrawerOpen((open) => !open);
    else setCollapsedChoice(!collapsed);
  }

  return (
    <div className="app-shell" data-collapsed={collapsed && !isMobile ? "true" : "false"}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="app-sidebar" aria-label="Sidebar">
        <div className="app-sidebar-inner">
          <SidebarContent me={me} collapsed={collapsed && !isMobile} />
        </div>
      </aside>
      <DialogPrimitive.Root open={drawerOpen && isMobile} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="dialog-overlay fade-in" />
          <DialogPrimitive.Content className="drawer-left slide-in" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">Main menu</DialogPrimitive.Title>
            <SidebarContent me={me} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="min-w-0">
        <TopBar
          me={me}
          menuExpanded={isMobile ? drawerOpen : !collapsed}
          onMenu={onMenu}
          onSearch={() => setSearchOpen(true)}
        />
        <main id="main" tabIndex={-1} className="app-content outline-none" data-scroll-margin>
          {children}
        </main>
      </div>
      <CommandSearch me={me} open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
