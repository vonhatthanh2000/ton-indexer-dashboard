import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { NoAccess } from "@/components/ui/no-access";
import { getPageSession } from "@/server/page-session";

export default async function ProjectLayout({ children }: { children: ReactNode }) {
  const session = await getPageSession();
  if (!session) redirect("/login");
  if (session.role !== "project") return <NoAccess />;
  return <AppShell session={session}>{children}</AppShell>;
}
