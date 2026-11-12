import type { Metadata } from "next";
import { ProjectDashboard } from "@/features/project/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <ProjectDashboard />;
}
