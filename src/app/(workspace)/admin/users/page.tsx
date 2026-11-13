import type { Metadata } from "next";
import { AdminUsers } from "@/features/admin/users";

export const metadata: Metadata = { title: "Admin users" };

export default function Page() {
  return <AdminUsers />;
}
