import type { Metadata } from "next";
import { SettingsView } from "@/features/auth/settings-view";
import { getPageSession } from "@/server/page-session";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const session = await getPageSession();
  const project = session?.projectId && session.projectName ? { id: session.projectId, name: session.projectName } : undefined;
  return <SettingsView role="project" project={project} />;
}
