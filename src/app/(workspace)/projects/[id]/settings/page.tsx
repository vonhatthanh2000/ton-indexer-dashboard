import type { Metadata } from "next";
import { ProjectSettings } from "@/features/project/settings";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <ProjectSettings />;
}
