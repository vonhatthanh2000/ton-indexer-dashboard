"use client";

import type { ReactNode } from "react";
import { NoAccess } from "@/components/ui/no-access";
import { useMe } from "@/features/auth/use-me";

export const ADMIN_ONLY_TITLE = "Admins only";
export const ADMIN_ONLY_BODY = "Only dashboard admins can open this page. Ask an admin if you need access.";

/** `/admin/*`: only when `me.user.isAdmin` (the client ["me"] query), else NoAccess. */
export function AdminScope({ children }: { children: ReactNode }) {
  const me = useMe().data;
  if (!me?.user.isAdmin) return <NoAccess title={ADMIN_ONLY_TITLE} body={ADMIN_ONLY_BODY} />;
  return <>{children}</>;
}
