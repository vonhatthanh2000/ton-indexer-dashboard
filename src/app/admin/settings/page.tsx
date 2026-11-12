import type { Metadata } from "next";
import { SettingsView } from "@/features/auth/settings-view";
import { getEnv } from "@/server/env";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  const api = new URL(getEnv().OBSERVER_API_URL);
  return <SettingsView role="admin" apiHost={api.host} docsUrl={`${api.origin}/docs`} />;
}
