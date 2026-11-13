import type { ReactNode } from "react";
import { AdminScope } from "@/features/admin/admin-scope";

// The admin check follows the client ["me"] query (seeded by the workspace layout), like the
// project layout's membership check.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminScope>{children}</AdminScope>;
}
