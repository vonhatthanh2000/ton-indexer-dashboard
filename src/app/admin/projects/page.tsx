import type { Metadata } from "next";
import { ProjectsPage } from "@/features/admin/projects-table";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return <ProjectsPage />;
}
