"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { SessionInfo } from "@/lib/types";
import { CommandSearch } from "./command-search";
import { SidebarContent } from "./sidebar";
import { TopBar } from "./topbar";
import { useMediaQuery } from "./use-media";

export function AppShell({ session, children }: { session: SessionInfo; children: ReactNode }) {
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
        <SidebarContent session={session} collapsed={collapsed && !isMobile} />
      </aside>
      <DialogPrimitive.Root open={drawerOpen && isMobile} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="dialog-overlay fade-in" />
          <DialogPrimitive.Content className="drawer-left slide-in" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">Main menu</DialogPrimitive.Title>
            <SidebarContent session={session} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="min-w-0">
        <TopBar
          session={session}
          menuExpanded={isMobile ? drawerOpen : !collapsed}
          onMenu={onMenu}
          onSearch={() => setSearchOpen(true)}
        />
        <main id="main" tabIndex={-1} className="app-content outline-none" data-scroll-margin>
          {children}
        </main>
      </div>
      <CommandSearch session={session} open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
