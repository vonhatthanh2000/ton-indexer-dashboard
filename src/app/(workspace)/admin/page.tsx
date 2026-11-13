import type { Metadata } from "next";
import { AdminProjects } from "@/features/admin/projects";

export const metadata: Metadata = { title: "Admin" };

export default function Page() {
  return <AdminProjects />;
}
