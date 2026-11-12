import type { Metadata } from "next";
import { CreateProjectPage } from "@/features/admin/create-project";

export const metadata: Metadata = { title: "Create project" };

export default function Page() {
  return <CreateProjectPage />;
}
