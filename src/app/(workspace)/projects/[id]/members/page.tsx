import type { Metadata } from "next";
import { MembersPage } from "@/features/members/members";

export const metadata: Metadata = { title: "Members" };

export default function Page() {
  return <MembersPage />;
}
